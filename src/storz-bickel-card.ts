/**
 * `<storz-bickel-card>` — companion Lovelace card for the Storz & Bickel
 * integration.
 *
 * A pixel-identical port of the design prototype vendored at
 * docs/design/vaporizer-card-final.dc.html (see docs/design/README.md for the
 * prototype-line ↔ render-method mapping). The template lays out at a fixed
 * 1328px design width and scales uniformly to its container — it never
 * reflows. Static inline styles are transcribed verbatim from the prototype;
 * dynamic styles come from src/view-model.ts, the port of the prototype's
 * `renderVals()`.
 *
 * Configured with a device registry id; every entity is derived from the
 * registry (see entities.ts). Missing entities degrade to `---`/`—` in the
 * same DOM slots so the layout never shifts.
 */

import { html, LitElement, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { createRef, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { CARD_TAG, CARD_VERSION, DESIGN_WIDTH, EDITOR_TAG } from "./const";
import { StorzBickelCardEditor } from "./editor";
import { type DeviceEntityIds, deviceEntities } from "./entities";
import { ensureFonts } from "./fonts";
import {
  asNumber,
  computeScale,
  convertAbsolute,
  formatRuntime,
  formatTime,
  type NiceAxis,
  toDisplayTemp,
  todayIso,
  unitCode,
  viewportHeight,
} from "./format";
import { TemperatureHistory } from "./history";
import { bucketSessions, sessionRecords } from "./sessions";
import { cardStyles } from "./styles";
import type { CardConfig, HassEntity, HomeAssistant, LovelaceCardEditor, TempUnit } from "./types";
import { buildViewModel, DEFAULT_EFFECTS, type EffectConfig, type ViewModel } from "./view-model";

/** Climate attributes the card reads (all set by the integration). */
interface ClimateAttributes {
  currentTemperature?: number;
  targetTemperature?: number;
  minTemp: number;
  maxTemp: number;
  hvacAction?: string;
}

interface SelectOption {
  value: number;
  label: string;
}

function climateAttributes(entity: HassEntity): ClimateAttributes {
  return {
    currentTemperature: asNumber(entity.attributes.current_temperature),
    targetTemperature: asNumber(entity.attributes.temperature),
    minTemp: asNumber(entity.attributes.min_temp) ?? 40,
    maxTemp: asNumber(entity.attributes.max_temp) ?? 230,
    hvacAction:
      typeof entity.attributes.hvac_action === "string" ? entity.attributes.hvac_action : undefined,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** How long an unacknowledged optimistic target may pin the UI. */
const PENDING_TARGET_TIMEOUT_MS = 5000;

/** How close (native °) the HA echo must be to release the optimistic target. */
const PENDING_TARGET_EPSILON = 0.25;

/** Companion card for Storz & Bickel vaporizers. */
export class StorzBickelCard extends LitElement {
  /** The Home Assistant state object, set by Lovelace on every update. */
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config?: CardConfig;

  /**
   * Optimistic target shown from first stepper/drag input until Home
   * Assistant echoes the value back (or a timeout passes). Clearing it any
   * earlier makes the knob snap back to the stale entity target mid-drag.
   */
  @state() private pendingTarget?: number;

  /** When the pending target's service call was sent (undefined = not yet). */
  private pendingSentAt?: number;

  /** View-only display unit override from the °F/°C toggle (not persisted). */
  @state() private displayUnitOverride?: TempUnit;

  /** Draft text while the target input is focused (prototype lines 594–598). */
  @state() private targetDraft: string | null = null;

  /** Selected temperature-history chart window, in minutes. */
  @state() private chartWindowMin = 30;

  /** Selected sessions chart window, in hours. */
  @state() private sessionWindowH = 24;

  /** Card-local stepper increments per display unit (prototype line 225). */
  @state() private stepF = 10;
  @state() private stepC = 5;

  /** Uniform scale applied to the fixed-width stage. */
  @state() private scale = 1;

  /** The stage's layout height, px (transform doesn't affect layout). */
  @state() private stageHeight = 0;

  /** Debounce window for stepper/drag input before calling the service (ms). */
  debounceMs = 500;

  private debounceTimer?: ReturnType<typeof setTimeout>;
  private liveTickTimer?: ReturnType<typeof setInterval>;
  private hostObserver?: ResizeObserver;
  private stageObserver?: ResizeObserver;
  private stageRef = createRef<HTMLDivElement>();
  private knobRef = createRef<HTMLDivElement>();
  private dragging = false;
  private history = new TemperatureHistory(() => this.requestUpdate());
  private lastAppendedTempState?: string;

  /** Previous frame's chart axis, held for hysteresis (see view-model). */
  private chartAxis?: NiceAxis;

  static override styles = cardStyles;

  override connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
    this.liveTickTimer = setInterval(() => this.requestUpdate(), 1000);
    this.history.start();
    if (typeof ResizeObserver !== "undefined") {
      this.hostObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? 0;
        this.scale = computeScale(width, DESIGN_WIDTH);
      });
      this.hostObserver.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this.liveTickTimer);
    clearTimeout(this.debounceTimer);
    this.history.stop();
    this.hostObserver?.disconnect();
    this.hostObserver = undefined;
    this.stageObserver?.disconnect();
    this.stageObserver = undefined;
    this.handleDragEnd();
  }

  override willUpdate(changed: PropertyValues): void {
    this.releasePendingTargetIfAcknowledged();
    if (changed.has("hass") || changed.has("config")) {
      const ids = this.entityIds;
      this.history.setSource(this.hass, ids.temperature);
      const sensor = this.entityState(ids.temperature);
      if (sensor && sensor.state !== this.lastAppendedTempState) {
        this.lastAppendedTempState = sensor.state;
        const value = asNumber(sensor.state);
        if (value !== undefined) {
          this.history.append(value);
        }
      }
    }
  }

  protected override updated(): void {
    // The stage appears only once entities resolve; observe it when it does.
    const stage = this.stageRef.value;
    if (stage && !this.stageObserver && typeof ResizeObserver !== "undefined") {
      this.stageObserver = new ResizeObserver((entries) => {
        this.stageHeight = entries[0]?.contentRect.height ?? 0;
      });
      this.stageObserver.observe(stage);
    }
  }

  /** Lovelace: provide the visual config editor. */
  static getConfigElement(): LovelaceCardEditor {
    return document.createElement(EDITOR_TAG) as LovelaceCardEditor;
  }

  /** Lovelace: seed the card picker with the first configured device. */
  static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
    const entry = hass
      ? Object.values(hass.entities).find(
          (candidate) => candidate.platform === "storz_bickel" && candidate.device_id,
        )
      : undefined;
    return { device: entry?.device_id ?? "" };
  }

  /** Lovelace: validate and store the card configuration. */
  setConfig(config: CardConfig): void {
    if (!config.device) {
      throw new Error("storz-bickel-card: 'device' is required (a Storz & Bickel device)");
    }
    this.config = config;
  }

  /** Lovelace: approximate masonry height in rows (~50px each). */
  getCardSize(): number {
    const px = this.stageHeight * this.scale;
    return px > 0 ? Math.ceil(px / 50) : 14;
  }

  /** Lovelace: request the full row in sections view (HA ≥2024.11). */
  getGridOptions(): { columns: number | "full" } {
    return { columns: "full" };
  }

  private get entityIds(): DeviceEntityIds {
    if (!this.hass || !this.config) {
      return {};
    }
    return deviceEntities(this.hass, this.config.device);
  }

  private entityState(entityId?: string): HassEntity | undefined {
    return entityId ? this.hass?.states[entityId] : undefined;
  }

  private get effects(): EffectConfig {
    return {
      heatEffect: this.config?.heat_effect ?? DEFAULT_EFFECTS.heatEffect,
      emberIntensity: this.config?.ember_intensity ?? DEFAULT_EFFECTS.emberIntensity,
      airEffect: this.config?.air_effect ?? DEFAULT_EFFECTS.airEffect,
      windIntensity: this.config?.wind_intensity ?? DEFAULT_EFFECTS.windIntensity,
      idleBreeze: this.config?.idle_breeze ?? DEFAULT_EFFECTS.idleBreeze,
    };
  }

  // ---- services -----------------------------------------------------------

  private callService(domain: string, service: string, data: Record<string, unknown>): void {
    this.hass?.callService(domain, service, data);
  }

  private setTargetTemperature(entityId: string, temperature: number): void {
    this.callService("climate", "set_temperature", { entity_id: entityId, temperature });
  }

  private debounceTarget(value: number, entityId: string): void {
    this.pendingTarget = value;
    this.pendingSentAt = undefined;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.sendPendingTarget(entityId), this.debounceMs);
  }

  /** Send the optimistic target now; keep displaying it until HA echoes it. */
  private sendPendingTarget(entityId: string): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
    if (this.pendingTarget === undefined) {
      return;
    }
    this.pendingSentAt = Date.now();
    this.setTargetTemperature(entityId, this.pendingTarget);
  }

  /** Drop the optimistic target once HA confirms it (or after a timeout). */
  private releasePendingTargetIfAcknowledged(): void {
    if (this.pendingTarget === undefined || this.pendingSentAt === undefined) {
      return;
    }
    const climate = this.entityState(this.entityIds.climate);
    const echoed = climate ? asNumber(climate.attributes.temperature) : undefined;
    const acknowledged =
      echoed !== undefined && Math.abs(echoed - this.pendingTarget) <= PENDING_TARGET_EPSILON;
    if (acknowledged || Date.now() - this.pendingSentAt > PENDING_TARGET_TIMEOUT_MS) {
      this.pendingTarget = undefined;
      this.pendingSentAt = undefined;
    }
  }

  private toggleHeat(climate: HassEntity): void {
    this.callService("climate", "set_hvac_mode", {
      entity_id: climate.entity_id,
      hvac_mode: climate.state === "heat" ? "off" : "heat",
    });
  }

  private toggleSwitch(entity: HassEntity): void {
    this.callService("switch", entity.state === "on" ? "turn_off" : "turn_on", {
      entity_id: entity.entity_id,
    });
  }

  private setNumber(entityId: string, value: number): void {
    this.callService("number", "set_value", { entity_id: entityId, value });
  }

  // ---- target input (stepper / text field / knob) --------------------------

  private get native(): TempUnit {
    return this.hass ? unitCode(this.hass.config.unit_system.temperature) : "C";
  }

  private get display(): TempUnit {
    return this.displayUnitOverride ?? this.native;
  }

  /** Prototype `nudgeTarget` (lines 276–281), stepping in display units. */
  private nudgeTarget(direction: number, climate: HassEntity): void {
    const attrs = climateAttributes(climate);
    const native = this.native;
    const display = this.display;
    const step = display === "C" ? this.stepC : this.stepF;
    const baseNative = this.pendingTarget ?? attrs.targetTemperature ?? attrs.minTemp;
    const nextDisplay = convertAbsolute(baseNative, native, display) + direction * step;
    const nextNative = round1(convertAbsolute(nextDisplay, display, native));
    const clamped = Math.min(attrs.maxTemp, Math.max(attrs.minTemp, nextNative));
    this.debounceTarget(clamped, climate.entity_id);
  }

  /** Prototype `commitTarget` (lines 283–290); commits immediately. */
  private commitTarget(climate: HassEntity): void {
    const draft = this.targetDraft;
    this.targetDraft = null;
    if (draft == null) {
      return;
    }
    const value = Number.parseFloat(draft);
    if (Number.isNaN(value)) {
      return;
    }
    const attrs = climateAttributes(climate);
    const native = round1(convertAbsolute(value, this.display, this.native));
    const clamped = Math.min(attrs.maxTemp, Math.max(attrs.minTemp, native));
    this.pendingTarget = clamped;
    this.sendPendingTarget(climate.entity_id);
  }

  private handleTargetFocus(event: FocusEvent, dTarget: number | undefined): void {
    const input = event.target as HTMLInputElement;
    this.targetDraft = dTarget === undefined ? "" : String(dTarget);
    this.updateComplete.then(() => input.select());
  }

  private handleTargetKey(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    if (event.key === "Enter") {
      input.blur();
    } else if (event.key === "Escape") {
      this.targetDraft = null;
      input.blur();
    }
  }

  // ---- knob drag (prototype lines 292–330) ---------------------------------

  private handleKnobDown(event: MouseEvent | TouchEvent, climate: HassEntity): void {
    event.preventDefault();
    this.dragging = true;
    this.dragClimate = climate;
    const point = "touches" in event ? event.touches[0] : event;
    if (!point) {
      return;
    }
    this.updateFromClient(point.clientX, point.clientY);
    window.addEventListener("mousemove", this.handleDragMove);
    window.addEventListener("mouseup", this.handleDragEnd);
    window.addEventListener("touchmove", this.handleDragMove, { passive: false });
    window.addEventListener("touchend", this.handleDragEnd);
  }

  private dragClimate?: HassEntity;

  private handleDragMove = (event: MouseEvent | TouchEvent): void => {
    if (!this.dragging) {
      return;
    }
    event.preventDefault();
    const point = "touches" in event ? event.touches[0] : event;
    if (!point) {
      return;
    }
    this.updateFromClient(point.clientX, point.clientY);
  };

  private handleDragEnd = (): void => {
    // Flush the debounced call on release so letting go feels instant.
    if (this.dragging && this.dragClimate && this.debounceTimer !== undefined) {
      this.sendPendingTarget(this.dragClimate.entity_id);
    }
    this.dragging = false;
    this.dragClimate = undefined;
    window.removeEventListener("mousemove", this.handleDragMove);
    window.removeEventListener("mouseup", this.handleDragEnd);
    window.removeEventListener("touchmove", this.handleDragMove);
    window.removeEventListener("touchend", this.handleDragEnd);
  };

  private updateFromClient(clientX: number, clientY: number): void {
    const el = this.knobRef.value;
    const climate = this.dragClimate;
    if (!el || !climate) {
      return;
    }
    // Angle-only math relative to the knob's center: immune to the uniform
    // transform: scale() on the stage.
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle > 180) {
      angle -= 360;
    }
    if (angle < -180) {
      angle += 360;
    }
    if (angle > 150 && angle <= 180) {
      angle = 150;
    }
    if (angle < -150 && angle >= -180) {
      angle = -150;
    }
    const pct = (angle + 150) / 300;
    const attrs = climateAttributes(climate);
    const native = this.native;
    const display = this.display;
    // Snap to 5° multiples in the display unit like the prototype (line 328).
    const minD = convertAbsolute(attrs.minTemp, native, display);
    const maxD = convertAbsolute(attrs.maxTemp, native, display);
    const displayValue = Math.round((minD + pct * (maxD - minD)) / 5) * 5;
    const nextNative = round1(convertAbsolute(displayValue, display, native));
    const clamped = Math.min(attrs.maxTemp, Math.max(attrs.minTemp, nextNative));
    this.debounceTarget(clamped, climate.entity_id);
  }

  // ---- render ---------------------------------------------------------------

  protected override render() {
    if (!this.hass || !this.config) {
      return nothing;
    }
    const ids = this.entityIds;
    const climate = this.entityState(ids.climate);
    if (!climate) {
      return html`<ha-card><div class="body">Device entities not found.</div></ha-card>`;
    }

    const attrs = climateAttributes(climate);
    const native = this.native;
    const display = this.display;
    const pump = this.entityState(ids.pump);
    const sessionHistory = this.entityState(ids.sessionHistory);
    const now = Date.now();
    const sessions = bucketSessions(
      sessionRecords(sessionHistory?.attributes.sessions),
      this.sessionWindowH,
      now,
    );

    const v = buildViewModel({
      temp: attrs.currentTemperature,
      target: this.pendingTarget ?? attrs.targetTemperature,
      heating: climate.state === "heat",
      pump: pump?.state === "on",
      native,
      display,
      minT: attrs.minTemp,
      maxT: attrs.maxTemp,
      targetDraft: this.targetDraft,
      series: this.history.series(this.chartWindowMin, now),
      now,
      axisHint: this.chartAxis,
      chartWindowMin: this.chartWindowMin,
      sessionWindowH: this.sessionWindowH,
      sessionBuckets: sessions.buckets,
      sessionCount: sessions.count,
      effects: this.effects,
    });
    this.chartAxis = v.chartAxis;

    const viewportStyle =
      this.stageHeight > 0
        ? `height:${viewportHeight(this.stageHeight, this.scale)}px;`
        : undefined;

    // Shell: prototype line 28 minus the 72px sidebar (lines 29–33), hence
    // 1328px. The inner column is line 35.
    return html`
      <ha-card>
        <div class="scale-viewport" style=${viewportStyle ?? nothing}>
          <div
            class="scale-stage"
            ${ref(this.stageRef)}
            style="width:${DESIGN_WIDTH}px;transform:scale(${this.scale});"
          >
            <div
              style="width:${DESIGN_WIDTH}px;background:#15130f;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 40px 90px rgba(0,0,0,0.55);display:flex;"
            >
              <div style="flex:1;padding:36px 40px 40px;display:flex;flex-direction:column;gap:26px;">
                ${this.renderHeader(v, ids)}
                <div style="display:grid;grid-template-columns:560px 1fr;gap:24px;align-items:start;">
                  <div
                    style="background:linear-gradient(180deg,#1e1b16,#17140f);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:36px;display:flex;flex-direction:column;align-items:center;gap:22px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);"
                  >
                    ${this.renderLcd(v, climate, attrs)}
                    ${this.renderKnob(v, climate)}
                    ${this.renderStepper(v, climate)}
                    ${this.renderHeatAir(v, climate, pump)}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:20px;">
                    ${this.renderSessionPanel(ids)}
                    ${this.renderTempChart(v)}
                    ${this.renderSessionsChart(v)}
                    ${this.renderDeviceInfo(v, ids)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  /** Prototype lines 36–53: kicker/title, heat LEDs, online pill. */
  private renderHeader(v: ViewModel, ids: DeviceEntityIds) {
    const device = this.config ? this.hass?.devices[this.config.device] : undefined;
    const kicker = device?.name ?? "Storz & Bickel";
    const name = this.config?.name ?? device?.name_by_user ?? device?.name ?? "Storz & Bickel";
    const connection = this.entityState(ids.connection);
    const connected = connection ? connection.state === "on" : true;

    return html`
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div
            style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.16em;color:#6b6459;text-transform:uppercase;margin-bottom:6px;"
          >
            ${kicker}
          </div>
          <div style="font-size:32px;font-weight:600;color:#f2ede4;letter-spacing:-0.01em;">
            ${name}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div
            title="Heat progress toward target"
            style="display:flex;flex-direction:column;align-items:center;gap:5px;"
          >
            <div style="display:flex;gap:6px;">
              ${v.ledStyles.map((led) => html`<div style=${styleMap(led)}></div>`)}
            </div>
            <span
              style="font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:0.12em;color:#6b6459;text-transform:uppercase;"
              >Heat</span
            >
          </div>
          <div
            style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:#1c1a15;border:1px solid rgba(255,255,255,0.08);border-radius:100px;"
          >
            <div
              style=${
                connected
                  ? "width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 8px rgba(52,211,153,0.6);"
                  : "width:8px;height:8px;border-radius:50%;background:#f87171;box-shadow:0 0 8px rgba(248,113,113,0.6);"
              }
            ></div>
            <span
              style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;color:#a39a8c;text-transform:uppercase;"
              >${connected ? "Online" : "Offline"}</span
            >
          </div>
        </div>
      </div>
    `;
  }

  /** Prototype lines 57–73: DSEG7 LCD, °F/°C toggle, status label. */
  private renderLcd(v: ViewModel, climate: HassEntity, attrs: ClimateAttributes) {
    const heaterOn = climate.state === "heat";
    const heating = attrs.hvacAction === "heating";
    const targetNative = this.pendingTarget ?? attrs.targetTemperature;
    const statusLabel = !heaterOn
      ? "IDLE"
      : heating
        ? "HEATING"
        : attrs.currentTemperature !== undefined &&
            targetNative !== undefined &&
            attrs.currentTemperature >= targetNative - 1
          ? "HOLDING"
          : "HEATING";

    return html`
      <div style="display:flex;align-items:center;gap:10px;">
        <div
          style="background:#0d0b08;border-radius:8px;padding:12px 26px;box-shadow:inset 0 2px 8px rgba(0,0,0,0.8),0 0 0 1px rgba(255,255,255,0.05);display:flex;flex-direction:column;align-items:center;line-height:1;"
        >
          <div
            style="position:relative;font-family:'DSEG7 Classic',monospace;font-size:46px;font-weight:400;letter-spacing:0.01em;line-height:1;"
          >
            <div style="color:rgba(255,106,61,0.09);">888</div>
            <div
              style="position:absolute;inset:0;text-align:right;color:#ff6a3d;text-shadow:0 0 18px rgba(255,106,61,0.6);"
            >
              ${v.tempNum}
            </div>
          </div>
          <div style=${styleMap(v.targetLineStyle)}>
            <div style=${styleMap(v.targetGhostStyle)}>888</div>
            <div style=${styleMap(v.targetDigitsStyle)}>${v.targetNum}</div>
          </div>
        </div>
        <div
          style="display:flex;flex-direction:column;border:1px solid rgba(255,255,255,0.1);border-radius:8px;overflow:hidden;"
        >
          <button
            class="unit-f"
            style=${styleMap(v.unitFStyle)}
            @click=${() => {
              this.displayUnitOverride = "F";
            }}
          >
            °F
          </button>
          <button
            class="unit-c"
            style=${styleMap(v.unitCStyle)}
            @click=${() => {
              this.displayUnitOverride = "C";
            }}
          >
            °C
          </button>
        </div>
      </div>
      <div
        class="status-label"
        style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#6b6459;text-transform:uppercase;"
      >
        ${statusLabel}
      </div>
    `;
  }

  /** Prototype lines 75–89: the temperature knob and its tick ring. */
  private renderKnob(v: ViewModel, climate: HassEntity) {
    return html`
      <div
        class="knob"
        ${ref(this.knobRef)}
        @mousedown=${(event: MouseEvent) => this.handleKnobDown(event, climate)}
        @touchstart=${(event: TouchEvent) => this.handleKnobDown(event, climate)}
        style="position:relative;width:280px;height:280px;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;"
      >
        ${v.tickMarks.map(
          (tm) => html`
            <div style=${styleMap(tm.outerStyle)}>
              <div style=${styleMap(tm.dashStyle)}></div>
              <div style=${styleMap(tm.innerStyle)}>
                <span style=${styleMap(tm.labelStyle)}>${tm.label}</span>
              </div>
            </div>
          `,
        )}
        <div style=${styleMap(v.knobWrapperStyle)}>
          <div style=${styleMap(v.knobStyle)}>
            <div
              style="position:absolute;top:16px;left:50%;width:5px;height:36px;background:#ff6a3d;border-radius:3px;transform:translateX(-50%);box-shadow:0 0 10px rgba(255,106,61,0.85);"
            ></div>
          </div>
          <div style=${styleMap(v.knobOverlayStyle)}></div>
        </div>
      </div>
    `;
  }

  /** Prototype lines 91–98: − / target input / + stepper pill. */
  private renderStepper(v: ViewModel, climate: HassEntity) {
    const attrs = climateAttributes(climate);
    const targetNative = this.pendingTarget ?? attrs.targetTemperature;
    const dTarget =
      targetNative === undefined
        ? undefined
        : toDisplayTemp(targetNative, this.native, this.display);
    const step = this.display === "C" ? this.stepC : this.stepF;

    return html`
      <div
        style="display:flex;align-items:center;gap:16px;background:#100e0b;border:1px solid rgba(255,255,255,0.07);border-radius:100px;padding:6px;"
      >
        <button
          class="hover-lift step minus"
          aria-label="Decrease target temperature"
          style="width:44px;height:44px;border-radius:50%;background:#242019;border:1px solid rgba(255,255,255,0.1);color:#e8e2d4;font-size:19px;cursor:pointer;"
          @click=${() => this.nudgeTarget(-1, climate)}
        >
          −
        </button>
        <div style="min-width:96px;text-align:center;">
          <input
            .value=${live(v.targetFieldValue)}
            style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:600;color:#f2ede4;background:transparent;border:none;outline:none;text-align:center;width:96px;padding:0;cursor:text;"
            @focus=${(event: FocusEvent) => this.handleTargetFocus(event, dTarget)}
            @input=${(event: Event) => {
              this.targetDraft = (event.target as HTMLInputElement).value;
            }}
            @blur=${() => this.commitTarget(climate)}
            @keydown=${(event: KeyboardEvent) => this.handleTargetKey(event)}
          />
          <div
            style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.1em;color:#6b6459;"
          >
            ${step}° INCREMENT
          </div>
        </div>
        <button
          class="hover-lift step plus"
          aria-label="Increase target temperature"
          style="width:44px;height:44px;border-radius:50%;background:#242019;border:1px solid rgba(255,255,255,0.1);color:#e8e2d4;font-size:19px;cursor:pointer;"
          @click=${() => this.nudgeTarget(1, climate)}
        >
          +
        </button>
      </div>
    `;
  }

  /** Prototype lines 100–109: HEAT / AIR buttons with particle effects. */
  private renderHeatAir(v: ViewModel, climate: HassEntity, pump: HassEntity | undefined) {
    // No pump entity (portables): keep the AIR button's off-style footprint
    // but make it inert, so the layout matches the prototype on every device.
    const pumpStyle = pump ? v.pumpBtnBigStyle : { ...v.pumpBtnBigStyle, pointerEvents: "none" };
    return html`
      <div style="display:flex;gap:12px;width:100%;">
        <button
          class="hover-lift heat-btn"
          style=${styleMap(v.heatBtnStyle)}
          @click=${() => this.toggleHeat(climate)}
        >
          ${v.embers.map((em) => html`<div style=${styleMap(em)}></div>`)}
          <span style=${styleMap(v.heatLabelStyle)}>HEAT</span>
        </button>
        <button
          class="hover-lift air-btn"
          style=${styleMap(pumpStyle)}
          @click=${() => pump && this.toggleSwitch(pump)}
        >
          ${v.windStreaks.map((ws) => html`<div style=${styleMap(ws)}></div>`)}
          <span style=${styleMap(v.pumpLabelStyle)}>AIR</span>
        </button>
      </div>
    `;
  }

  /**
   * Prototype lines 113–121: session timer + sessions today.
   *
   * Session authority lives in the integration: its SessionTracker keeps the
   * window open across heater-off gaps shorter than a 15-minute grace period,
   * so `current_session_start` — and therefore this timer — does NOT reset on
   * a quick HEAT off/on toggle. The card ticks `now − start` at 1 Hz for a
   * smooth display; the integration's `current_session_duration` sensor is
   * the official duration record for automations/history (it updates at
   * coordinator cadence, not per-second, so it isn't used for the display).
   */
  private renderSessionPanel(ids: DeviceEntityIds) {
    const currentSessionStart = this.entityState(ids.currentSessionStart);
    const sessionHistory = this.entityState(ids.sessionHistory);
    const startIso =
      currentSessionStart &&
      currentSessionStart.state !== "unknown" &&
      currentSessionStart.state !== "unavailable"
        ? currentSessionStart.state
        : undefined;
    const startMs = startIso ? new Date(startIso).getTime() : Number.NaN;
    const sessionDisplay = Number.isFinite(startMs)
      ? formatTime(Math.max(0, (Date.now() - startMs) / 1000))
      : "--:--";
    const dailyCounts = (sessionHistory?.attributes.daily_counts ?? {}) as Record<string, number>;
    const sessionsToday = dailyCounts[todayIso()] ?? 0;

    return html`
      <div
        style="background:#1c1a15;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px 28px;display:flex;justify-content:space-between;align-items:center;"
      >
        <div>
          <div
            style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#6b6459;text-transform:uppercase;margin-bottom:8px;"
          >
            Session
          </div>
          <div
            class="session-timer"
            style="font-family:'JetBrains Mono',monospace;font-size:36px;font-weight:600;color:#f2ede4;"
          >
            ${sessionDisplay}
          </div>
        </div>
        <div style="display:flex;gap:28px;">
          <div>
            <div class="sessions-today-count" style="font-size:20px;font-weight:600;color:#f2ede4;">
              ${sessionsToday}
            </div>
            <div style="font-size:11px;color:#6b6459;">sessions today</div>
          </div>
        </div>
      </div>
    `;
  }

  /** Prototype lines 123–159: the live temperature chart. */
  private renderTempChart(v: ViewModel) {
    return html`
      <div
        style="background:#1c1a15;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px 28px;"
      >
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div
              style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#6b6459;text-transform:uppercase;"
            >
              Temperature · live
            </div>
            <select
              class="chart-window"
              style=${styleMap(v.fieldStyle)}
              @change=${(event: Event) => {
                this.chartAxis = undefined; // new window → fresh axis fit
                this.chartWindowMin = Number((event.target as HTMLSelectElement).value);
              }}
            >
              ${v.chartWindowOptions.map(
                (opt) => html`
                  <option value=${opt.value} ?selected=${opt.value === this.chartWindowMin}>
                    ${opt.label}
                  </option>
                `,
              )}
            </select>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:600;color:#ff6a3d;">
            ${v.tempDisplay}
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <div style="position:relative;width:38px;height:110px;">
            ${v.yTicks.map((yt) => html`<div style=${styleMap(yt.labelStyle)}>${yt.label}</div>`)}
          </div>
          <div style="position:relative;flex:1;height:110px;">
            ${v.yTicks.map((g) => html`<div style=${styleMap(g.gridStyle)}></div>`)}
            <svg
              width="100%"
              height="110"
              viewBox="0 0 560 110"
              preserveAspectRatio="none"
              style="position:absolute;inset:0;display:block;"
            >
              <defs>
                <linearGradient id="fillLive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#ff6a3d" stop-opacity="0.35"></stop>
                  <stop offset="100%" stop-color="#ff6a3d" stop-opacity="0"></stop>
                </linearGradient>
              </defs>
              <path d=${v.liveAreaPath} fill="url(#fillLive)"></path>
              <path
                d=${v.livePath}
                fill="none"
                stroke="#ff6a3d"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
            <div style=${styleMap(v.liveDotStyle)}></div>
          </div>
        </div>
        <div
          style="display:flex;justify-content:space-between;font-size:10.5px;color:#6b6459;font-family:'JetBrains Mono',monospace;margin-top:6px;margin-left:46px;"
        >
          ${v.chartXTicks.map((xt) => html`<span>${xt}</span>`)}
        </div>
      </div>
    `;
  }

  /** Prototype lines 161–188: the sessions bar chart. */
  private renderSessionsChart(v: ViewModel) {
    return html`
      <div
        style="background:#1c1a15;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px 28px;"
      >
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div
            style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#6b6459;text-transform:uppercase;"
          >
            Sessions · ${v.sessionCount} total · ${v.sessionWindowLabel}
          </div>
          <select
            class="session-window"
            style=${styleMap(v.fieldStyle)}
            @change=${(event: Event) => {
              this.sessionWindowH = Number((event.target as HTMLSelectElement).value);
            }}
          >
            ${v.sessionWindowOptions.map(
              (opt) => html`
                <option value=${opt.value} ?selected=${opt.value === this.sessionWindowH}>
                  ${opt.label}
                </option>
              `,
            )}
          </select>
        </div>
        <div style="display:flex;gap:8px;">
          <div style="position:relative;width:20px;height:70px;">
            ${v.sessionYTicks.map(
              (yt) => html`<div style=${styleMap(yt.labelStyle)}>${yt.label}</div>`,
            )}
          </div>
          <div style="position:relative;flex:1;height:70px;">
            ${v.sessionYTicks.map((g) => html`<div style=${styleMap(g.gridStyle)}></div>`)}
            <div style="position:absolute;inset:0;display:flex;align-items:flex-end;gap:2px;">
              ${v.sessionBars.map((bar) => html`<div style=${styleMap(bar)}></div>`)}
            </div>
          </div>
        </div>
        <div
          style="display:flex;justify-content:space-between;font-size:10.5px;color:#6b6459;font-family:'JetBrains Mono',monospace;margin-top:8px;margin-left:28px;"
        >
          ${v.sessionXTicks.map((xt) => html`<span>${xt}</span>`)}
        </div>
      </div>
    `;
  }

  /** Prototype lines 190–210: device info values and setting selects. */
  private renderDeviceInfo(v: ViewModel, ids: DeviceEntityIds) {
    const totalRuntime = asNumber(this.entityState(ids.totalRuntime)?.state);
    const firmware = this.config ? this.hass?.devices[this.config.device]?.sw_version : undefined;
    const bleFirmware = this.entityState(ids.bleFirmwareVersion);
    const bleVersion =
      bleFirmware && bleFirmware.state !== "unavailable" && bleFirmware.state !== "unknown"
        ? bleFirmware.state
        : undefined;
    const autoShutoff = this.entityState(ids.autoShutoffMinutes);
    const pumpFailsafe = this.entityState(ids.pumpFailsafeSeconds);

    const minuteOptions: SelectOption[] = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360].map(
      (value) => ({ value, label: `${value} min` }),
    );
    const failsafeOptions: SelectOption[] = [15, 30, 45, 60, 90, 120, 180, 300, 450, 600].map(
      (value) => ({ value, label: `${value} sec` }),
    );
    const stepOptions = this.display === "C" ? [1, 2, 5, 10] : [1, 2, 5, 10, 20];
    const step = this.display === "C" ? this.stepC : this.stepF;

    const valueRow = (label: string, value: string | undefined) => html`
      <div style="display:flex;justify-content:space-between;font-size:13px;">
        <span style="color:#a39a8c;">${label}</span
        ><span style="color:#f2ede4;font-family:'JetBrains Mono',monospace;">${value ?? "—"}</span>
      </div>
    `;

    return html`
      <div
        style="background:#1c1a15;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px 28px;display:flex;flex-direction:column;gap:14px;"
      >
        <div
          style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#6b6459;text-transform:uppercase;"
        >
          Device info
        </div>
        ${valueRow(
          "Total runtime",
          totalRuntime === undefined ? undefined : `${formatRuntime(totalRuntime)} h`,
        )}
        ${valueRow("Firmware", firmware)} ${valueRow("Bluetooth firmware", bleVersion)}
        ${this.renderNumberSelectRow(v, "Heater timeout", autoShutoff, minuteOptions)}
        ${this.renderNumberSelectRow(v, "Pump timeout", pumpFailsafe, failsafeOptions)}
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
          <span style="color:#a39a8c;">Temperature increment</span>
          <select
            class="temp-step"
            style=${styleMap(v.fieldStyle)}
            @change=${(event: Event) => {
              const value = Number((event.target as HTMLSelectElement).value);
              if (this.display === "C") {
                this.stepC = value;
              } else {
                this.stepF = value;
              }
            }}
          >
            ${stepOptions.map(
              (opt) => html`
                <option value=${opt} ?selected=${opt === step}>${opt}°${this.display}</option>
              `,
            )}
          </select>
        </div>
      </div>
    `;
  }

  /** A device-info select bound to a `number` entity (— span when absent). */
  private renderNumberSelectRow(
    v: ViewModel,
    label: string,
    entity: HassEntity | undefined,
    options: SelectOption[],
  ) {
    const current = entity ? asNumber(entity.state) : undefined;
    return html`
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
        <span style="color:#a39a8c;">${label}</span>
        ${
          entity
            ? html`
              <select
                style=${styleMap(v.fieldStyle)}
                @change=${(event: Event) =>
                  this.setNumber(
                    entity.entity_id,
                    Number((event.target as HTMLSelectElement).value),
                  )}
              >
                ${options.map(
                  (option) => html`
                    <option value=${option.value} ?selected=${current === option.value}>
                      ${option.label}
                    </option>
                  `,
                )}
              </select>
            `
            : html`<span style=${styleMap({ ...v.fieldStyle, cursor: "default" })}>—</span>`
        }
      </div>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, StorzBickelCard);
}
if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, StorzBickelCardEditor);
}

window.customCards = window.customCards ?? [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Storz & Bickel Card",
    description: "Controls for Storz & Bickel vaporizers (Volcano, Venty, Veazy, Crafty).",
    preview: true,
    documentationURL: "https://github.com/nredd/hacs-storz-bickel",
  });
}

console.info(
  `%c STORZ-BICKEL-CARD %c v${CARD_VERSION} `,
  "background: #ff9800; color: #fff; font-weight: 600; border-radius: 3px 0 0 3px;",
  "background: #424242; color: #fff; border-radius: 0 3px 3px 0;",
);
