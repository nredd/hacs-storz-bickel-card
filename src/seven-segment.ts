/**
 * `<sb-seven-segment>` — the dual current/target temperature readout.
 *
 * Ports the mockup's digit display: a dim "888" ghost sits behind the lit
 * digits to mimic an unlit seven-segment display, current temperature in the
 * accent color above a smaller target readout, with a °F/°C toggle docked
 * beside it. No external font is loaded (offline-friendly, self-contained
 * bundle) — the seven-segment *look* comes from color/glow/ghost-digit
 * layering over a tabular-nums monospace face, not a real segment font.
 */

import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";
import { SEVEN_SEGMENT_TAG } from "./const";

/** Dual seven-segment-style temperature readout with a unit toggle. */
export class SbSevenSegment extends LitElement {
  /** Current temperature reported by the device, already in the display unit. */
  @property({ type: Number }) current?: number;

  /** Target temperature, already in the display unit. */
  @property({ type: Number }) target?: number;

  /** Whether to show the (smaller, secondary-colored) target line at all. */
  @property({ type: Boolean }) showTarget = true;

  /** The active display unit, "F" or "C". */
  @property() unit: "F" | "C" = "F";

  private emitUnit(unit: "F" | "C"): void {
    if (unit === this.unit) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent("unit-change", { detail: { unit }, bubbles: true, composed: true }),
    );
  }

  protected override render() {
    const currentText = this.current === undefined ? "---" : String(Math.round(this.current));
    const targetText = this.target === undefined ? "---" : String(Math.round(this.target));

    return html`
      <div class="readout-panel">
        <div class="digits">
          <div class="ghost">888</div>
          <div class="lit current">${currentText}<span class="deg">°</span></div>
        </div>
        ${
          this.showTarget
            ? html`
              <div class="digits target-digits">
                <div class="ghost small">888</div>
                <div class="lit small target">${targetText}<span class="deg">°</span></div>
              </div>
            `
            : nothing
        }
      </div>
      <div class="unit-toggle">
        <button
          class=${this.unit === "F" ? "active" : ""}
          aria-pressed=${this.unit === "F"}
          @click=${() => this.emitUnit("F")}
        >
          °F
        </button>
        <button
          class=${this.unit === "C" ? "active" : ""}
          aria-pressed=${this.unit === "C"}
          @click=${() => this.emitUnit("C")}
        >
          °C
        </button>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 10px;
      --sb-seg-accent: var(--sb-color-heating, #ff9800);
    }

    .readout-panel {
      background: var(--card-background-color, #0d0b08);
      border-radius: 8px;
      padding: 12px 20px;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1;
    }

    .digits {
      position: relative;
      font-family: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      font-variant-numeric: tabular-nums;
      font-size: 40px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .target-digits {
      font-size: 22px;
      margin-top: 2px;
    }

    .ghost {
      color: var(--sb-seg-accent);
      opacity: 0.08;
    }

    .lit {
      position: absolute;
      inset: 0;
      text-align: right;
      color: var(--sb-seg-accent);
      text-shadow: 0 0 18px rgba(255, 152, 0, 0.6);
    }

    .lit.target {
      color: var(--secondary-text-color, #a39a8c);
      text-shadow: none;
    }

    .deg {
      font-size: 0.6em;
      vertical-align: text-top;
    }

    .unit-toggle {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
      border-radius: 8px;
      overflow: hidden;
    }

    .unit-toggle button {
      border: none;
      padding: 8px 12px;
      font-size: 12px;
      font-family: "JetBrains Mono", ui-monospace, monospace;
      cursor: pointer;
      background: var(--secondary-background-color, #242019);
      color: var(--secondary-text-color, #a39a8c);
    }

    .unit-toggle button.active {
      background: var(--sb-seg-accent);
      color: var(--primary-background-color, #1a1207);
    }
  `;
}

if (!customElements.get(SEVEN_SEGMENT_TAG)) {
  customElements.define(SEVEN_SEGMENT_TAG, SbSevenSegment);
}
