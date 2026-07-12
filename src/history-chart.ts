/**
 * `<sb-history-chart>` — the "Temperature · live" SVG line chart.
 *
 * Fetches recent history for one numeric entity from HA's REST history API
 * (`history/period`, the same endpoint the core "history" card uses) and
 * renders it as a filled line, matching the mockup's live temperature panel.
 * Re-fetches on a timer so the line keeps moving while the card is on
 * screen; no charting library, just an SVG path built by hand (same
 * philosophy as the existing `dial.ts`).
 */

import { css, html, LitElement, nothing, svg } from "lit";
import { property, state } from "lit/decorators.js";
import { HISTORY_CHART_TAG } from "./const";
import type { HistoryStateRecord, HomeAssistant } from "./types";

const VIEWBOX_WIDTH = 560;
const VIEWBOX_HEIGHT = 110;
const REFRESH_INTERVAL_MS = 30_000;

interface Point {
  t: number;
  v: number;
}

function niceAxisMax(maxValue: number): number {
  if (maxValue <= 0) {
    return 10;
  }
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const normalized = maxValue / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/** SVG line chart of an entity's recent numeric history. */
export class SbHistoryChart extends LitElement {
  /** The Home Assistant instance, used to call the history REST API. */
  @property({ attribute: false }) hass?: HomeAssistant;

  /** The entity whose numeric state history is charted. */
  @property() entityId?: string;

  /** Lookback window in minutes. */
  @property({ type: Number }) windowMinutes = 30;

  /** Unit suffix appended to the current-value readout. */
  @property() unit = "°";

  @state() private points: Point[] = [];

  private refreshTimer?: ReturnType<typeof setInterval>;

  override connectedCallback(): void {
    super.connectedCallback();
    this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), REFRESH_INTERVAL_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this.refreshTimer);
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (changed.has("entityId") || changed.has("windowMinutes")) {
      this.refresh();
    }
  }

  private async refresh(): Promise<void> {
    if (!this.hass || !this.entityId) {
      this.points = [];
      return;
    }
    const end = new Date();
    const start = new Date(end.getTime() - this.windowMinutes * 60_000);
    const path = `history/period/${start.toISOString()}?filter_entity_id=${this.entityId}&end_time=${end.toISOString()}&minimal_response`;
    try {
      const result = await this.hass.callApi<HistoryStateRecord[][]>("GET", path);
      const series = result[0] ?? [];
      this.points = series
        .map((record) => ({
          t: new Date(record.last_changed).getTime(),
          v: Number(record.state),
        }))
        .filter((point) => Number.isFinite(point.v));
    } catch {
      this.points = [];
    }
  }

  protected override render() {
    const current = this.points[this.points.length - 1];
    const values = this.points.map((point) => point.v);
    const minValue = values.length ? Math.min(...values) : 0;
    const axisMax = niceAxisMax(values.length ? Math.max(...values) : 0);
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(axisMax * fraction));

    return html`
      <div class="header">
        <span class="title">Temperature · live</span>
        ${
          current !== undefined
            ? html`<span class="current">${Math.round(current.v)}${this.unit}</span>`
            : nothing
        }
      </div>
      <div class="chart-row">
        <div class="y-axis">
          ${yTicks
            .slice()
            .reverse()
            .map((tick) => html`<span>${tick}</span>`)}
        </div>
        <div class="plot">
          ${this.renderSvg(minValue, axisMax)}
        </div>
      </div>
    `;
  }

  private renderSvg(minValue: number, axisMax: number) {
    if (this.points.length < 2) {
      return html`<div class="empty">No data yet</div>`;
    }
    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    if (!first || !last) {
      return nothing;
    }
    const span = Math.max(1, last.t - first.t);
    const range = Math.max(1, axisMax - minValue);
    const toXy = (point: Point) => ({
      x: ((point.t - first.t) / span) * VIEWBOX_WIDTH,
      y: VIEWBOX_HEIGHT - ((point.v - minValue) / range) * VIEWBOX_HEIGHT,
    });
    const coords = this.points.map(toXy);
    const linePath = coords
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    const areaPath = `${linePath} L ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT} L 0 ${VIEWBOX_HEIGHT} Z`;

    return svg`
      <svg viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" preserveAspectRatio="none" role="img" aria-label="Temperature history">
        <defs>
          <linearGradient id="sb-history-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--sb-color-heating, #ff9800)" stop-opacity="0.35" />
            <stop offset="100%" stop-color="var(--sb-color-heating, #ff9800)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d=${areaPath} fill="url(#sb-history-fill)" />
        <path
          d=${linePath}
          fill="none"
          stroke="var(--sb-color-heating, #ff9800)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  static override styles = css`
    :host {
      display: block;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .title {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--secondary-text-color);
    }

    .current {
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 15px;
      font-weight: 600;
      color: var(--sb-color-heating, #ff9800);
    }

    .chart-row {
      display: flex;
      gap: 8px;
    }

    .y-axis {
      width: 32px;
      height: 110px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 9px;
      color: var(--secondary-text-color);
      text-align: right;
    }

    .plot {
      position: relative;
      flex: 1;
      height: 110px;
    }

    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }

    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--disabled-text-color, #9e9e9e);
      font-size: 12px;
    }
  `;
}

if (!customElements.get(HISTORY_CHART_TAG)) {
  customElements.define(HISTORY_CHART_TAG, SbHistoryChart);
}
