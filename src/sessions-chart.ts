/**
 * `<sb-sessions-chart>` — the "Sessions" bar chart.
 *
 * Renders the `session_history` sensor's `daily_counts` attribute (see
 * `session/entities.py`) as one bar per day, trailing-window, with today
 * highlighted in the accent color — matching the mockup's session bar chart
 * (which used a rolling per-bucket count; here each bucket is one day, since
 * that's what the backend now exposes beyond the short live-session window).
 */

import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { SESSIONS_CHART_TAG } from "./const";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shortDayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
}

/** Bar chart of daily session counts. */
export class SbSessionsChart extends LitElement {
  /** ISO date (`YYYY-MM-DD`) → session count, from the session_history sensor. */
  @property({ attribute: false }) dailyCounts: Record<string, number> = {};

  protected override render() {
    const entries = Object.entries(this.dailyCounts).sort(([a], [b]) => a.localeCompare(b));
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    const maxCount = Math.max(1, ...entries.map(([, count]) => count));
    const today = todayIso();

    return html`
      <div class="header">
        <span class="title">Sessions · ${total} total · ${entries.length}d</span>
      </div>
      ${
        entries.length === 0
          ? html`<div class="empty">No sessions yet</div>`
          : html`
            <div class="bars">
              ${entries.map(([day, count]) => {
                const heightPct = count === 0 ? 3 : Math.max(6, (count / maxCount) * 100);
                return html`
                  <div class="bar-col" title="${day}: ${count} session${count === 1 ? "" : "s"}">
                    <div
                      class="bar ${day === today ? "today" : ""} ${count === 0 ? "zero" : ""}"
                      style="height:${heightPct}%"
                    ></div>
                  </div>
                `;
              })}
            </div>
            <div class="x-axis">
              ${entries.map(([day]) => html`<span>${shortDayLabel(day)}</span>`)}
            </div>
          `
      }
    `;
  }

  static override styles = css`
    :host {
      display: block;
    }

    .header {
      margin-bottom: 14px;
    }

    .title {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--secondary-text-color);
    }

    .bars {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 100px;
    }

    .bar-col {
      flex: 1;
      display: flex;
      align-items: flex-end;
      height: 100%;
    }

    .bar {
      width: 100%;
      border-radius: 2px;
      background: #c85a35;
      transition: height 0.3s ease;
    }

    .bar.zero {
      background: var(--secondary-background-color, #242019);
    }

    .bar.today {
      background: var(--sb-color-heating, #ff9800);
      box-shadow: 0 0 8px rgba(255, 152, 0, 0.6);
    }

    .x-axis {
      display: flex;
      gap: 4px;
      margin-top: 6px;
    }

    .x-axis span {
      flex: 1;
      text-align: center;
      font-size: 9px;
      color: var(--secondary-text-color);
    }

    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100px;
      color: var(--disabled-text-color, #9e9e9e);
      font-size: 12px;
    }
  `;
}

if (!customElements.get(SESSIONS_CHART_TAG)) {
  customElements.define(SESSIONS_CHART_TAG, SbSessionsChart);
}
