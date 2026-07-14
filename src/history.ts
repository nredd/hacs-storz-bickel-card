/**
 * Live temperature history for the "Temperature · live" chart.
 *
 * Keeps a rolling backlog covering the largest chart window (240 min): a
 * `history/period` REST fetch (the endpoint the core history card uses)
 * repeated every 30 s, plus live appends from state updates between polls.
 *
 * `series()` aggregates the window into ≤140 fixed absolute-time buckets
 * (mean per bucket, apexcharts-card's `group_by: avg` idea) instead of the
 * prototype's index-stride downsample: bucket membership doesn't change as
 * time advances, so the rendered path stays put instead of shimmering on
 * every append.
 */

import type { HistoryStateRecord, HomeAssistant, SeriesPoint } from "./types";

/** Largest selectable chart window, minutes (prototype line 614). */
export const MAX_WINDOW_MINUTES = 240;

/** Backlog re-fetch cadence. */
export const REFRESH_INTERVAL_MS = 30_000;

/** Chart resolution: number of aggregation buckets per window. */
export const MAX_POINTS = 140;

interface Point {
  t: number;
  v: number;
}

/** Rolling numeric history of one entity, polled + live-appended. */
export class TemperatureHistory {
  private points: Point[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private hass?: HomeAssistant;
  private entityId?: string;

  /** `onChange` fires after every backlog change (bind to requestUpdate). */
  constructor(private readonly onChange: () => void) {}

  /** Begin the 30 s poll loop (idempotent). */
  start(): void {
    if (this.timer !== undefined) {
      return;
    }
    this.timer = setInterval(() => {
      void this.refresh();
    }, REFRESH_INTERVAL_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Update the hass handle/entity; a changed entity refetches immediately. */
  setSource(hass: HomeAssistant | undefined, entityId: string | undefined): void {
    const changed = entityId !== this.entityId;
    this.hass = hass;
    this.entityId = entityId;
    if (changed) {
      this.points = [];
      void this.refresh();
    }
  }

  /** Append a live sample between polls (deduped against the backlog tail). */
  append(value: number, t: number = Date.now()): void {
    if (!Number.isFinite(value)) {
      return;
    }
    const last = this.points[this.points.length - 1];
    if (last && t <= last.t) {
      return;
    }
    this.points.push({ t, v: value });
    this.prune(t);
    this.onChange();
  }

  /** The window's series, oldest → newest, ≤140 stable time buckets. */
  series(windowMinutes: number, now: number = Date.now()): SeriesPoint[] {
    const windowMs = windowMinutes * 60_000;
    const cutoff = now - windowMs;
    const bucketMs = windowMs / MAX_POINTS;
    const buckets = new Map<number, { sum: number; count: number }>();
    for (const point of this.points) {
      if (point.t < cutoff || point.t > now) {
        continue;
      }
      // Absolute-time bucket ids: a sample's bucket never changes as `now`
      // advances, so already-rendered geometry stays stable.
      const id = Math.floor(point.t / bucketMs);
      const bucket = buckets.get(id);
      if (bucket) {
        bucket.sum += point.v;
        bucket.count++;
      } else {
        buckets.set(id, { sum: point.v, count: 1 });
      }
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([id, bucket]) => ({
        t: Math.min((id + 0.5) * bucketMs, now),
        v: bucket.sum / bucket.count,
      }));
  }

  /** Re-fetch the full backlog from the REST history API. */
  async refresh(): Promise<void> {
    if (!this.hass || !this.entityId) {
      return;
    }
    const end = new Date();
    const start = new Date(end.getTime() - MAX_WINDOW_MINUTES * 60_000);
    const path = `history/period/${start.toISOString()}?filter_entity_id=${this.entityId}&end_time=${end.toISOString()}&minimal_response`;
    try {
      const result = await this.hass.callApi<HistoryStateRecord[][]>("GET", path);
      const records = result[0] ?? [];
      this.points = records
        .map((record) => ({ t: new Date(record.last_changed).getTime(), v: Number(record.state) }))
        .filter((point) => Number.isFinite(point.v) && Number.isFinite(point.t))
        .sort((a, b) => a.t - b.t);
      this.onChange();
    } catch {
      // Keep the current backlog on transient API errors; the next poll or
      // live append will catch the chart up.
    }
  }

  private prune(now: number): void {
    const cutoff = now - MAX_WINDOW_MINUTES * 60_000;
    const oldest = this.points[0];
    if (oldest && oldest.t < cutoff) {
      this.points = this.points.filter((point) => point.t >= cutoff);
    }
  }
}
