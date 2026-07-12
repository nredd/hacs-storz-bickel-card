/**
 * `<storz-bickel-card>` — companion Lovelace card for the Storz & Bickel
 * integration.
 *
 * Configured with a device registry id; every entity is derived from the
 * registry (see entities.ts), so the card adapts to each device's
 * capabilities: pump/AIR toggle on the Volcano, battery chip on portables,
 * boost and vibration rows only where supported. Layout is a two-column
 * dashboard (readout/dial/controls on the left, session/history/device-info
 * panels on the right) ported from the "Bag Bertha" design mockup, reflowing
 * to a single column in narrow dashboard slots via a container query.
 */

import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { CARD_TAG, CARD_VERSION, DEFAULT_PRESETS, EDITOR_TAG } from "./const";
import "./dial";
import { StorzBickelCardEditor } from "./editor";
import { type DeviceEntityIds, deviceEntities } from "./entities";
import "./history-chart";
import "./seven-segment";
import "./sessions-chart";
import { cardStyles } from "./styles";
import type { CardConfig, HassEntity, HomeAssistant, LovelaceCardEditor } from "./types";

/** Climate attributes the card reads (all set by the integration). */
interface ClimateAttributes {
  currentTemperature?: number;
  targetTemperature?: number;
  minTemp: number;
  maxTemp: number;
  targetTempStep: number;
  hvacAction?: string;
}

type TempUnit = "C" | "F";

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
}

function climateAttributes(entity: HassEntity): ClimateAttributes {
  return {
    currentTemperature: asNumber(entity.attributes.current_temperature),
    targetTemperature: asNumber(entity.attributes.temperature),
    minTemp: asNumber(entity.attributes.min_temp) ?? 40,
    maxTemp: asNumber(entity.attributes.max_temp) ?? 230,
    targetTempStep: asNumber(entity.attributes.target_temp_step) ?? 1,
    hvacAction:
      typeof entity.attributes.hvac_action === "string" ? entity.attributes.hvac_action : undefined,
  };
}

/** Convert a temperature value between Celsius and Fahrenheit. */
function convertAbsolute(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) {
    return value;
  }
  return from === "C" ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
}

/** Convert a temperature *delta* (e.g. a step size) between units. */
function convertDelta(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) {
    return value;
  }
  return from === "C" ? value * 1.8 : value / 1.8;
}

function unitCode(label: string): TempUnit {
  return label.includes("F") ? "F" : "C";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Format a duration in whole seconds as `H:MM:SS` (or `M:SS` under an hour). */
function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

interface SelectOption {
  value: number;
  label: string;
}

/** Companion card for Storz & Bickel vaporizers. */
export class StorzBickelCard extends LitElement {
  /** The Home Assistant state object, set by Lovelace on every update. */
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config?: CardConfig;

  /** Optimistic target shown while stepper/drag input is being debounced. */
  @state() private pendingTarget?: number;

  /** View-only display unit override from the °F/°C toggle (not persisted). */
  @state() private displayUnitOverride?: TempUnit;

  /** Selected temperature-history chart window, in minutes. */
  @state() private chartWindowMinutes = 30;

  /** Debounce window for stepper/drag input before calling the service (ms). */
  debounceMs = 500;

  private debounceTimer?: ReturnType<typeof setTimeout>;
  private liveTickTimer?: ReturnType<typeof setInterval>;

  static override styles = cardStyles;

  override connectedCallback(): void {
    super.connectedCallback();
    this.liveTickTimer = setInterval(() => this.requestUpdate(), 1000);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this.liveTickTimer);
    clearTimeout(this.debounceTimer);
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
    return { device: entry?.device_id ?? "", presets: [...DEFAULT_PRESETS] };
  }

  /** Lovelace: validate and store the card configuration. */
  setConfig(config: CardConfig): void {
    if (!config.device) {
      throw new Error("storz-bickel-card: 'device' is required (a Storz & Bickel device)");
    }
    this.config = config;
  }

  /** Lovelace: approximate masonry height in rows (taller dashboard layout). */
  getCardSize(): number {
    return 10;
  }

  /** Lovelace: sizing hints for sections view. */
  getGridOptions(): Record<string, number> {
    return { columns: 12, rows: 14, min_columns: 8, min_rows: 10 };
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

  private callService(domain: string, service: string, data: Record<string, unknown>): void {
    this.hass?.callService(domain, service, data);
  }

  private setTargetTemperature(entityId: string, temperature: number): void {
    this.callService("climate", "set_temperature", { entity_id: entityId, temperature });
  }

  private debounceTarget(value: number, entityId: string): void {
    this.pendingTarget = value;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.pendingTarget = undefined;
      this.setTargetTemperature(entityId, value);
    }, this.debounceMs);
  }

  private handleDialStep(direction: number, climate: HassEntity): void {
    const attrs = climateAttributes(climate);
    const base = this.pendingTarget ?? attrs.targetTemperature ?? attrs.minTemp;
    const next = Math.min(
      attrs.maxTemp,
      Math.max(attrs.minTemp, base + direction * attrs.targetTempStep),
    );
    this.debounceTarget(next, climate.entity_id);
  }

  private handleDialDrag(displayValue: number, climate: HassEntity, native: TempUnit): void {
    const attrs = climateAttributes(climate);
    const display = this.displayUnitOverride ?? native;
    const nativeValue = convertAbsolute(displayValue, display, native);
    const clamped = Math.min(attrs.maxTemp, Math.max(attrs.minTemp, nativeValue));
    this.debounceTarget(clamped, climate.entity_id);
  }

  private handlePreset(temperature: number, climate: HassEntity): void {
    const attrs = climateAttributes(climate);
    const clamped = Math.min(attrs.maxTemp, Math.max(attrs.minTemp, temperature));
    clearTimeout(this.debounceTimer);
    this.pendingTarget = clamped;
    this.setTargetTemperature(climate.entity_id, clamped);
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
    const connection = this.entityState(ids.connection);
    const connected = connection ? connection.state === "on" : true;
    const heaterOn = climate.state === "heat";
    const heating = attrs.hvacAction === "heating";
    const targetNative = this.pendingTarget ?? attrs.targetTemperature;
    const battery = this.entityState(ids.battery);
    const pump = this.entityState(ids.pump);
    const native = unitCode(this.hass.config.unit_system.temperature);
    const display = this.displayUnitOverride ?? native;
    const toDisplay = (value: number) => convertAbsolute(value, native, display);
    const device = this.hass.devices[this.config.device];
    const name = this.config.name ?? device?.name_by_user ?? device?.name ?? "Storz & Bickel";
    const presets = this.config.presets ?? [];

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
      <ha-card>
        <div class="body ${connected ? "" : "disconnected"}">
          <div class="header">
            <div class="titles">
              <span class="kicker">${device?.name ?? "Storz & Bickel"}</span>
              <span class="name">${name}</span>
            </div>
            <div class="header-right">
              ${
                battery && asNumber(battery.state) !== undefined
                  ? html`<span class="battery">🔋 ${Math.round(asNumber(battery.state) ?? 0)}%</span>`
                  : nothing
              }
              <span class="connection-chip ${connected ? "on" : "off"}"
                >${connected ? "ONLINE" : "OFFLINE"}</span
              >
            </div>
          </div>

          <div class="grid">
            <div class="left-col">
              <sb-seven-segment
                .current=${
                  attrs.currentTemperature === undefined
                    ? undefined
                    : toDisplay(attrs.currentTemperature)
                }
                .target=${targetNative === undefined ? undefined : toDisplay(targetNative)}
                .showTarget=${heaterOn}
                .unit=${display}
                @unit-change=${(event: CustomEvent<{ unit: TempUnit }>) => {
                  this.displayUnitOverride = event.detail.unit;
                }}
              ></sb-seven-segment>
              <div class="status-label">${statusLabel}</div>
              <sb-temp-dial
                .current=${
                  attrs.currentTemperature === undefined
                    ? undefined
                    : toDisplay(attrs.currentTemperature)
                }
                .target=${targetNative === undefined ? undefined : toDisplay(targetNative)}
                .min=${toDisplay(attrs.minTemp)}
                .max=${toDisplay(attrs.maxTemp)}
                .unit=${`°${display}`}
                ?active=${heaterOn}
                ?heating=${heating}
                ?disabled=${!connected}
                @dial-drag=${(event: CustomEvent<{ value: number }>) =>
                  this.handleDialDrag(event.detail.value, climate, native)}
              ></sb-temp-dial>
              <div class="stepper">
                <button
                  class="step minus"
                  aria-label="Decrease target temperature"
                  ?disabled=${!connected}
                  @click=${() => this.handleDialStep(-1, climate)}
                >
                  −
                </button>
                <div class="stepper-value">
                  <span
                    >${targetNative === undefined ? "—" : Math.round(toDisplay(targetNative))}°${display}</span
                  >
                  <div class="step-caption">
                    ${Math.round(convertDelta(attrs.targetTempStep, native, display) * 10) / 10}°
                    STEP
                  </div>
                </div>
                <button
                  class="step plus"
                  aria-label="Increase target temperature"
                  ?disabled=${!connected}
                  @click=${() => this.handleDialStep(1, climate)}
                >
                  +
                </button>
              </div>
              ${
                presets.length > 0
                  ? html`
                    <div class="presets">
                      ${presets.map(
                        (preset) => html`
                          <button
                            class="preset ${targetNative !== undefined && Math.round(targetNative) === Math.round(preset) ? "active" : ""}"
                            @click=${() => this.handlePreset(preset, climate)}
                          >
                            ${Math.round(toDisplay(preset))}°${display}
                          </button>
                        `,
                      )}
                    </div>
                  `
                  : nothing
              }
              <div class="toggle-row">
                <button class="heat-btn ${heaterOn ? "on" : ""}" @click=${() => this.toggleHeat(climate)}>
                  HEAT
                </button>
                ${
                  pump
                    ? html`
                      <button
                        class="air-btn ${pump.state === "on" ? "on" : ""}"
                        @click=${() => this.toggleSwitch(pump)}
                      >
                        AIR
                      </button>
                    `
                    : nothing
                }
              </div>
            </div>

            <div class="right-col">
              ${this.renderSessionPanel(ids)}
              <div class="panel">
                <sb-history-chart
                  .hass=${this.hass}
                  .entityId=${ids.temperature}
                  .windowMinutes=${this.chartWindowMinutes}
                  .unit=${`°${display}`}
                ></sb-history-chart>
              </div>
              <div class="panel">${this.renderSessionsChart(ids)}</div>
              <div class="panel">${this.renderDeviceInfo(ids, native, display)}</div>
              ${this.renderSettings(ids)}
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  private renderSessionPanel(ids: DeviceEntityIds) {
    const currentSessionStart = this.entityState(ids.currentSessionStart);
    const sessionHistory = this.entityState(ids.sessionHistory);
    const startIso =
      currentSessionStart && currentSessionStart.state !== "unknown"
        ? currentSessionStart.state
        : undefined;
    const elapsedSeconds = startIso
      ? (Date.now() - new Date(startIso).getTime()) / 1000
      : undefined;
    const dailyCounts = (sessionHistory?.attributes.daily_counts ?? {}) as Record<string, number>;
    const sessionsToday = dailyCounts[todayIso()] ?? 0;

    return html`
      <div class="panel session-panel">
        <div>
          <div class="panel-title">Session</div>
          <div class="session-timer">
            ${elapsedSeconds === undefined ? "—:—" : formatElapsed(elapsedSeconds)}
          </div>
        </div>
        <div class="sessions-today">
          <div class="sessions-today-count">${sessionsToday}</div>
          <div class="sessions-today-label">sessions today</div>
        </div>
      </div>
    `;
  }

  private renderSessionsChart(ids: DeviceEntityIds) {
    const sessionHistory = this.entityState(ids.sessionHistory);
    const dailyCounts = (sessionHistory?.attributes.daily_counts ?? {}) as Record<string, number>;
    return html`<sb-sessions-chart .dailyCounts=${dailyCounts}></sb-sessions-chart>`;
  }

  private renderDeviceInfo(ids: DeviceEntityIds, native: TempUnit, display: TempUnit) {
    const totalRuntime = this.entityState(ids.totalRuntime);
    const bleFirmware = this.entityState(ids.bleFirmwareVersion);
    const firmwareVersion = this.config
      ? this.hass?.devices[this.config.device]?.sw_version
      : undefined;
    const autoShutoffMinutes = this.entityState(ids.autoShutoffMinutes);
    const pumpFailsafe = this.entityState(ids.pumpFailsafeSeconds);
    const pumpCooldown = this.entityState(ids.pumpCooldownSeconds);
    const tempStep = this.entityState(ids.tempStep);

    if (
      !totalRuntime &&
      !firmwareVersion &&
      !bleFirmware &&
      !autoShutoffMinutes &&
      !pumpFailsafe &&
      !pumpCooldown &&
      !tempStep
    ) {
      return nothing;
    }

    const minuteOptions: SelectOption[] = [
      5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720,
    ].map((value) => ({ value, label: `${value} min` }));
    const failsafeOptions: SelectOption[] = [15, 30, 45, 60, 90, 120, 180, 300, 450, 600].map(
      (value) => ({ value, label: `${value} sec` }),
    );
    const cooldownOptions: SelectOption[] = [1, 2, 3, 5, 10, 15, 30, 60, 120, 300].map((value) => ({
      value,
      label: `${value} sec`,
    }));
    const tempStepOptions: SelectOption[] = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map((value) => ({
      value,
      label: `${Math.round(convertDelta(value, native, display) * 10) / 10}°${display}`,
    }));

    return html`
      <div class="panel-title">Device info</div>
      ${
        totalRuntime && asNumber(totalRuntime.state) !== undefined
          ? html`<div class="info-row">
            <span>Total runtime</span><span>${asNumber(totalRuntime.state)?.toFixed(1)} h</span>
          </div>`
          : nothing
      }
      ${
        firmwareVersion
          ? html`<div class="info-row"><span>Firmware</span><span>${firmwareVersion}</span></div>`
          : nothing
      }
      ${
        bleFirmware && bleFirmware.state !== "unavailable" && bleFirmware.state !== "unknown"
          ? html`<div class="info-row">
            <span>Bluetooth firmware</span><span>${bleFirmware.state}</span>
          </div>`
          : nothing
      }
      ${
        autoShutoffMinutes
          ? this.renderSelectRow("Auto shutoff", autoShutoffMinutes, minuteOptions)
          : nothing
      }
      ${
        pumpFailsafe
          ? this.renderSelectRow("Pump failsafe", pumpFailsafe, failsafeOptions)
          : nothing
      }
      ${
        pumpCooldown
          ? this.renderSelectRow("Pump cooldown", pumpCooldown, cooldownOptions)
          : nothing
      }
      ${tempStep ? this.renderSelectRow("Temp step", tempStep, tempStepOptions) : nothing}
    `;
  }

  private renderSelectRow(label: string, entity: HassEntity, options: SelectOption[]) {
    const current = asNumber(entity.state);
    return html`
      <div class="info-row">
        <span>${label}</span>
        <select
          @change=${(event: Event) =>
            this.setNumber(entity.entity_id, Number((event.target as HTMLSelectElement).value))}
        >
          ${options.map(
            (option) => html`
              <option value=${option.value} ?selected=${current === option.value}>
                ${option.label}
              </option>
            `,
          )}
        </select>
      </div>
    `;
  }

  private renderSettings(ids: DeviceEntityIds) {
    const led = this.entityState(ids.ledBrightness);
    const boost = this.entityState(ids.boostTemperature);
    const vibration = this.entityState(ids.vibration);
    if (!led && !boost && !vibration) {
      return nothing;
    }
    return html`
      <details class="settings panel">
        <summary>More settings</summary>
        ${led ? this.renderNumberRow("LED brightness", led, "%") : nothing}
        ${boost ? this.renderNumberRow("Boost", boost, "°") : nothing}
        ${
          vibration
            ? html`
              <div class="row">
                <label for="vibration">Vibration</label>
                <input
                  id="vibration"
                  type="checkbox"
                  .checked=${vibration.state === "on"}
                  @change=${() => this.toggleSwitch(vibration)}
                />
              </div>
            `
            : nothing
        }
      </details>
    `;
  }

  private renderNumberRow(label: string, entity: HassEntity, suffix: string) {
    const value = asNumber(entity.state);
    const min = asNumber(entity.attributes.min) ?? 0;
    const max = asNumber(entity.attributes.max) ?? 100;
    const step = asNumber(entity.attributes.step) ?? 1;
    const id = entity.entity_id.replaceAll(".", "-");
    return html`
      <div class="row">
        <label for=${id}>${label}</label>
        <input
          id=${id}
          type="range"
          min=${min}
          max=${max}
          step=${step}
          .value=${String(value ?? min)}
          @change=${(event: Event) =>
            this.setNumber(entity.entity_id, Number((event.target as HTMLInputElement).value))}
        />
        <span class="value">${value ?? "—"}${suffix}</span>
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
