/**
 * `<sb-temp-dial>` — the card's hero element: a rotating-knob thermostat.
 *
 * This is a literal port of the mockup's dial mechanism (not a redesign): a
 * fixed ring of tick marks surrounds a knob face that physically rotates via
 * a CSS `transform: rotate()` to point an indicator bar at the target
 * temperature, built from the same absolutely-positioned/rotated divs the
 * mockup used (not an SVG arc). Geometry constants below are taken directly
 * from the mockup source (`Vaporizer Card - Final.dc.html`, ~lines 445-491):
 * a 300° sweep from -150° to 150°, ticks every 12.5° with a labeled major
 * tick every 75°, a 190px knob face inside a 280px ring.
 *
 * Purely presentational: dragging or using the ± stepper (rendered by the
 * parent, not this component — see storz-bickel-card.ts) emits events; the
 * card owns service calls and debouncing.
 */

import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { DIAL_TAG } from "./const";

/** Ring sweep, in degrees, matching the mockup's `sweep`/`startA`. */
const SWEEP = 300;
const START_ANGLE = -150;
/** Degrees between ticks (25 ticks over the 300° sweep). */
const TICK_STEP = 12.5;
/** Degrees between labeled major ticks (5 majors: min, 1/4, mid, 3/4, max). */
const MAJOR_TICK_STEP = 75;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface TickSpec {
  angle: number;
  major: boolean;
  label: string;
  labelOffset: number;
}

/** Rotating-knob thermostat dial with a fixed tick ring. */
export class SbTempDial extends LitElement {
  /** Current temperature reported by the device. */
  @property({ type: Number }) current?: number;

  /** Target temperature (possibly an optimistic pending value). */
  @property({ type: Number }) target?: number;

  /** Lower bound of the dial, from the climate entity. */
  @property({ type: Number }) min = 40;

  /** Upper bound of the dial, from the climate entity. */
  @property({ type: Number }) max = 230;

  /** Temperature unit suffix, e.g. `°C`. */
  @property() unit = "°C";

  /** Whether the heater is switched on (hvac mode is heat). */
  @property({ type: Boolean }) active = false;

  /** Whether the device is actively heating right now. */
  @property({ type: Boolean }) heating = false;

  /** Disables dragging and dims the ring (device disconnected). */
  @property({ type: Boolean }) disabled = false;

  @state() private dragging = false;

  private containerRef?: HTMLDivElement;

  /** Fraction [0, 1] of the sweep covered by `value`. */
  private fraction(value: number): number {
    if (this.max <= this.min) {
      return 0;
    }
    return clamp((value - this.min) / (this.max - this.min), 0, 1);
  }

  private get mode(): "off" | "heating" | "ready" {
    if (!this.active || this.disabled) {
      return "off";
    }
    if (
      this.current !== undefined &&
      this.target !== undefined &&
      this.current >= this.target - 1
    ) {
      return "ready";
    }
    return "heating";
  }

  private ticks(): TickSpec[] {
    const ticks: TickSpec[] = [];
    for (let angle = START_ANGLE; angle <= START_ANGLE + SWEEP + 0.001; angle += TICK_STEP) {
      const major = Math.abs((angle - START_ANGLE) % MAJOR_TICK_STEP) < 0.01;
      if (!major) {
        ticks.push({ angle, major: false, label: "", labelOffset: 0 });
        continue;
      }
      const value = this.min + ((angle - START_ANGLE) / SWEEP) * (this.max - this.min);
      const label = `${Math.round(value)}${this.unit}`;
      // Push the label out so its nearest edge keeps constant clearance from
      // the tick regardless of angle, mirroring the mockup's rc formula.
      const rad = (angle * Math.PI) / 180;
      const halfW = label.length * 3.1;
      const halfH = 5;
      const labelOffset = 134 + halfW * Math.abs(Math.sin(rad)) + halfH * Math.abs(Math.cos(rad));
      ticks.push({ angle, major: true, label, labelOffset });
    }
    return ticks;
  }

  private angleFromPointer(clientX: number, clientY: number): number {
    const rect = this.containerRef?.getBoundingClientRect();
    if (!rect) {
      return START_ANGLE;
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawDeg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
    // Normalize into the same [-180, 180) space the sweep is defined in, then
    // clamp to the ring's physical span (it doesn't wrap all the way around).
    let deg = rawDeg;
    if (deg < START_ANGLE) {
      deg += 360;
    }
    return clamp(deg, START_ANGLE, START_ANGLE + SWEEP);
  }

  private emitDrag(value: number): void {
    this.dispatchEvent(
      new CustomEvent("dial-drag", { detail: { value }, bubbles: true, composed: true }),
    );
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.disabled) {
      return;
    }
    this.dragging = true;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.handlePointerMove(event);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragging) {
      return;
    }
    const angle = this.angleFromPointer(event.clientX, event.clientY);
    const raw = this.min + ((angle - START_ANGLE) / SWEEP) * (this.max - this.min);
    this.emitDrag(clamp(Math.round(raw), this.min, this.max));
  };

  private handlePointerUp = (event: PointerEvent): void => {
    this.dragging = false;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
  };

  protected override render() {
    const target = this.disabled ? undefined : this.target;
    const knobRotation =
      target === undefined ? START_ANGLE : START_ANGLE + this.fraction(target) * SWEEP;

    return html`
      <div
        class="dial ${this.mode} ${this.disabled ? "disabled" : ""} ${this.dragging ? "dragging" : ""}"
        ${ref((el) => {
          this.containerRef = el as HTMLDivElement | undefined;
        })}
        @pointerdown=${this.handlePointerDown}
        @pointermove=${this.handlePointerMove}
        @pointerup=${this.handlePointerUp}
        @pointercancel=${this.handlePointerUp}
      >
        ${this.ticks().map(
          (tick) => html`
            <div class="tick" style="transform:translate(-50%,-50%) rotate(${tick.angle}deg)">
              <div class="dash ${tick.major ? "major" : "minor"}"></div>
              ${
                tick.major
                  ? html`
                    <div
                      class="tick-label"
                      style="top:-${tick.labelOffset}px;transform:translate(-50%,-50%) rotate(${-tick.angle}deg)"
                    >
                      <span>${tick.label}</span>
                    </div>
                  `
                  : nothing
              }
            </div>
          `,
        )}
        <div class="knob-wrapper">
          <div class="knob-face" style="transform:rotate(${knobRotation}deg)">
            <div class="indicator"></div>
          </div>
          <div class="knob-overlay"></div>
          <div class="readout">
            <span class="current"
              >${this.current === undefined || this.disabled ? "—" : Math.round(this.current)}</span
            >
          </div>
        </div>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      --sb-dial-accent: var(--sb-color-heating, #ff6a3d);
    }

    .dial {
      position: relative;
      width: 280px;
      max-width: 100%;
      aspect-ratio: 1;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    .dial.disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .dial.dragging {
      cursor: grabbing;
    }

    .tick {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
    }

    .dash {
      position: absolute;
      left: -0.5px;
      top: -124px;
      width: 1px;
      height: 7px;
      border-radius: 0.5px;
      background: rgba(127, 127, 127, 0.3);
    }

    .dash.major {
      left: -1px;
      top: -128px;
      width: 2px;
      height: 13px;
      background: var(--secondary-text-color, rgba(127, 127, 127, 0.6));
    }

    .tick-label {
      position: absolute;
      left: 0;
      display: flex;
    }

    .tick-label span {
      font-family: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 10px;
      color: var(--secondary-text-color);
      white-space: nowrap;
    }

    .knob-wrapper {
      width: 190px;
      height: 190px;
      border-radius: 50%;
      position: relative;
      background: var(--card-background-color, #0e0c09);
      box-shadow:
        0 16px 34px rgba(0, 0, 0, 0.55),
        0 3px 6px rgba(0, 0, 0, 0.4);
    }

    .knob-face {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 30%, #433c31 0%, #211d17 58%, #16130e 100%);
      position: absolute;
      inset: 0;
      transition: transform 0.6s ease;
    }

    .dial.off .knob-face {
      background: radial-gradient(circle at 50% 30%, #3a3a3a 0%, #1e1e1e 58%, #141414 100%);
    }

    .indicator {
      position: absolute;
      top: 16px;
      left: 50%;
      width: 5px;
      height: 36px;
      background: var(--sb-dial-accent);
      border-radius: 3px;
      transform: translateX(-50%);
      box-shadow: 0 0 10px rgba(255, 106, 61, 0.85);
    }

    .dial.off .indicator {
      background: var(--disabled-text-color, #9e9e9e);
      box-shadow: none;
    }

    .dial.heating .knob-face {
      animation: sb-breathe 3s ease-in-out infinite;
    }

    @keyframes sb-breathe {
      0%,
      100% {
        filter: drop-shadow(0 0 2px var(--sb-dial-accent));
      }
      50% {
        filter: drop-shadow(0 0 10px var(--sb-dial-accent));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .dial.heating .knob-face {
        animation: none;
      }
      .knob-face {
        transition: none;
      }
    }

    .knob-overlay {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      pointer-events: none;
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.05),
        inset 0 3px 5px rgba(255, 255, 255, 0.05),
        inset 0 -12px 24px rgba(0, 0, 0, 0.5);
    }

    .readout {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .current {
      font-size: clamp(1.8rem, 14cqw, 2.6rem);
      font-weight: 300;
      font-variant-numeric: tabular-nums;
      color: var(--primary-text-color);
    }
  `;
}

if (!customElements.get(DIAL_TAG)) {
  customElements.define(DIAL_TAG, SbTempDial);
}
