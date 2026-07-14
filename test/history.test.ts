import { describe, expect, it } from "bun:test";
import { MAX_POINTS, MAX_WINDOW_MINUTES, TemperatureHistory } from "../src/history";
import { makeHass } from "./fixtures";

function isoAgo(now: number, minutes: number): string {
  return new Date(now - minutes * 60_000).toISOString();
}

function values(history: TemperatureHistory, windowMinutes: number, now: number): number[] {
  return history.series(windowMinutes, now).map((point) => point.v);
}

describe("TemperatureHistory", () => {
  it("fetches the backlog when the source entity is set", async () => {
    const hass = makeHass();
    const now = Date.now();
    hass.apiResponses["history/period"] = [
      [
        { state: "150", last_changed: isoAgo(now, 20) },
        { state: "unavailable", last_changed: isoAgo(now, 15) },
        { state: "160", last_changed: isoAgo(now, 10) },
        { state: "170", last_changed: isoAgo(now, 5) },
      ],
    ];
    let changes = 0;
    const history = new TemperatureHistory(() => {
      changes++;
    });
    history.setSource(hass, "sensor.volcano_temperature");
    await Bun.sleep(0);
    expect(values(history, 30, now)).toEqual([150, 160, 170]);
    expect(changes).toBe(1);
  });

  it("slices the series to the selected window", async () => {
    const hass = makeHass();
    const now = Date.now();
    hass.apiResponses["history/period"] = [
      [
        { state: "100", last_changed: isoAgo(now, 100) },
        { state: "150", last_changed: isoAgo(now, 20) },
        { state: "170", last_changed: isoAgo(now, 2) },
      ],
    ];
    const history = new TemperatureHistory(() => {});
    history.setSource(hass, "sensor.volcano_temperature");
    await Bun.sleep(0);
    expect(values(history, 240, now)).toEqual([100, 150, 170]);
    expect(values(history, 30, now)).toEqual([150, 170]);
    expect(values(history, 5, now)).toEqual([170]);
  });

  it("aggregates into at most 140 buckets, averaging within each", async () => {
    const hass = makeHass();
    const now = Date.now();
    hass.apiResponses["history/period"] = [
      Array.from({ length: 600 }, (_, i) => ({
        state: String(i),
        last_changed: isoAgo(now, 200 - i / 5),
      })),
    ];
    const history = new TemperatureHistory(() => {});
    history.setSource(hass, "sensor.volcano_temperature");
    await Bun.sleep(0);
    const series = history.series(240, now);
    expect(series.length).toBeLessThanOrEqual(MAX_POINTS);
    // The newest bucket is a mean of the last few raw samples (…597, 598, 599).
    const lastValue = series[series.length - 1]?.v ?? 0;
    expect(lastValue).toBeGreaterThan(594);
    expect(lastValue).toBeLessThanOrEqual(599);
    // Timestamps are strictly increasing bucket centers.
    for (let i = 1; i < series.length; i++) {
      expect((series[i]?.t ?? 0) > (series[i - 1]?.t ?? 0)).toBe(true);
    }
  });

  it("averages samples that share an absolute-time bucket", () => {
    const now = Date.now();
    const bucketMs = (MAX_WINDOW_MINUTES * 60_000) / MAX_POINTS;
    // Two samples placed deterministically inside one bucket.
    const base = Math.floor((now - 60_000) / bucketMs) * bucketMs;
    const history = new TemperatureHistory(() => {});
    history.append(100, base + 1_000);
    history.append(200, base + 2_000);
    const series = history.series(MAX_WINDOW_MINUTES, now);
    expect(series.length).toBe(1);
    expect(series[0]?.v).toBe(150);
  });

  it("keeps old bucket values stable as time advances (no shimmer)", () => {
    const now = Date.now();
    const history = new TemperatureHistory(() => {});
    for (let i = 0; i < 50; i++) {
      history.append(150 + i, now - (50 - i) * 60_000);
    }
    const before = values(history, 240, now);
    const after = values(history, 240, now + 1_000);
    expect(after).toEqual(before);
  });

  it("appends live samples in order and ignores stale or bad ones", () => {
    const now = Date.now();
    let changes = 0;
    const history = new TemperatureHistory(() => {
      changes++;
    });
    history.append(150, now - 200_000);
    history.append(151, now - 1_000);
    history.append(151, now - 1_000); // same timestamp → dropped
    history.append(Number.NaN, now); // not finite → dropped
    expect(values(history, 30, now)).toEqual([150, 151]);
    expect(changes).toBe(2);
  });

  it("keeps the backlog when a refresh fails", async () => {
    const hass = makeHass();
    const now = Date.now();
    hass.apiResponses["history/period"] = [[{ state: "150", last_changed: isoAgo(now, 5) }]];
    const history = new TemperatureHistory(() => {});
    history.setSource(hass, "sensor.volcano_temperature");
    await Bun.sleep(0);
    hass.callApi = () => Promise.reject(new Error("offline"));
    await history.refresh();
    expect(values(history, 30, now)).toEqual([150]);
  });

  it("does nothing without a source", async () => {
    const history = new TemperatureHistory(() => {
      throw new Error("should not fire");
    });
    await history.refresh();
    expect(history.series(30)).toEqual([]);
  });
});
