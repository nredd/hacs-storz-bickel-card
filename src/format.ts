/**
 * Pure formatting/math helpers shared by the card and the view model.
 *
 * `formatTime`, `toDisplayTemp`, `niceAxis` and `smoothPath` are direct ports
 * of the design prototype's helpers (docs/design/vaporizer-card-final.dc.html
 * lines 332–370) — keep them behavior-identical so view-model output stays
 * diffable against the prototype. `toDisplayTemp` is generalized with an
 * explicit source unit (the prototype hardcoded °F internal state; the card's
 * internal math runs in the integration's native unit).
 */

import type { TempUnit } from "./types";

/** Axis computed by {@link niceAxis}: rounded bounds plus tick values. */
export interface NiceAxis {
  niceLo: number;
  niceHi: number;
  ticks: number[];
}

/** Parse a possibly-string value to a finite number, else undefined. */
export function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
}

/** Convert a temperature value between Celsius and Fahrenheit. */
export function convertAbsolute(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) {
    return value;
  }
  return from === "C" ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
}

/** Convert a temperature *delta* (e.g. a step size) between units. */
export function convertDelta(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) {
    return value;
  }
  return from === "C" ? value * 1.8 : value / 1.8;
}

/** Map an HA unit label ("°F", "°C") to a unit code. */
export function unitCode(label: string): TempUnit {
  return label.includes("F") ? "F" : "C";
}

/** Today's date as `YYYY-MM-DD` (keys of `session_history.daily_counts`). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Prototype `formatTime` (lines 332–335): seconds → zero-padded `MM:SS`. */
export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Prototype `toDisplayTemp` (lines 336–338) with an explicit source unit. */
export function toDisplayTemp(value: number, from: TempUnit, to: TempUnit): number {
  return Math.round(convertAbsolute(value, from, to));
}

/** Total runtime hours formatted like the prototype's "2,217.2". */
export function formatRuntime(hours: number): string {
  return hours.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Prototype `niceAxis` (lines 340–352): rounded axis bounds + integer ticks. */
export function niceAxis(lo: number, hi: number): NiceAxis {
  let high = hi;
  if (!(high > lo)) {
    high = lo + 1;
  }
  const rawStep = (high - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const step = mult * mag;
  const niceLo = Math.floor(lo / step) * step;
  const niceHi = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let t = niceLo; t <= niceHi + step * 0.001; t += step) {
    ticks.push(Math.round(t));
  }
  return { niceLo, niceHi, ticks };
}

/** Prototype `smoothPath` (lines 354–370): midpoint-quadratic SVG path. */
export function smoothPath(
  values: number[],
  w: number,
  h: number,
  min: number,
  max: number,
): string {
  const n = values.length;
  if (n < 2) {
    return "";
  }
  const pts = values.map((v, i): [number, number] => {
    const x = (i / (n - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return [x, y];
  });
  return smoothPathXY(pts);
}

/**
 * The prototype's midpoint-quadratic path over precomputed `[x, y]` pairs —
 * used by the live chart's time-based x axis, where x positions come from
 * timestamps instead of sample indices.
 */
export function smoothPathXY(pts: [number, number][]): string {
  if (pts.length < 2) {
    return "";
  }
  let prev = pts[0];
  if (!prev) {
    return "";
  }
  let d = `M${prev[0].toFixed(1)},${prev[1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    if (!cur) {
      continue;
    }
    const mx = (prev[0] + cur[0]) / 2;
    const my = (prev[1] + cur[1]) / 2;
    d += ` Q${prev[0].toFixed(1)},${prev[1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    prev = cur;
  }
  d += ` L${prev[0].toFixed(1)},${prev[1].toFixed(1)}`;
  return d;
}

/** Uniform card scale for a container width (1 until layout provides one). */
export function computeScale(containerWidth: number, designWidth: number): number {
  return containerWidth > 0 ? containerWidth / designWidth : 1;
}

/**
 * Height the scale viewport must reserve: `transform: scale()` doesn't affect
 * layout, so the stage's layout height must be compensated by the scale.
 */
export function viewportHeight(stageHeight: number, scale: number): number {
  return stageHeight * scale;
}
