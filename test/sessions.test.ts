import { describe, expect, it } from "bun:test";
import { bucketSessions, SESSION_BUCKETS, sessionRecords } from "../src/sessions";

const NOW = Date.parse("2026-07-11T12:00:00Z");
const HOUR = 3_600_000;
const MINUTE = 60_000;

function iso(msFromNow: number): string {
  return new Date(NOW + msFromNow).toISOString();
}

describe("bucketSessions", () => {
  it("returns 48 empty buckets for no records", () => {
    const { buckets, count } = bucketSessions([], 24, NOW);
    expect(buckets.length).toBe(SESSION_BUCKETS);
    expect(buckets.every((value) => value === 0)).toBe(true);
    expect(count).toBe(0);
  });

  it("credits a session's minutes to the bucket it occupies", () => {
    // 24h window → 30-minute buckets. A 10-minute session fully inside the
    // last bucket (started 20 min ago, ended 10 min ago).
    const { buckets, count } = bucketSessions(
      [{ start: iso(-20 * MINUTE), stop: iso(-10 * MINUTE) }],
      24,
      NOW,
    );
    expect(count).toBe(1);
    expect(buckets[47]).toBeCloseTo(10, 5);
    expect(buckets.slice(0, 47).every((value) => value === 0)).toBe(true);
  });

  it("splits a session across bucket boundaries", () => {
    // 24h window, 30-min buckets. A session spanning the last boundary:
    // 40 min ago → 20 min ago = 10 min in bucket 46, 10 min in bucket 47.
    const { buckets } = bucketSessions(
      [{ start: iso(-40 * MINUTE), stop: iso(-20 * MINUTE) }],
      24,
      NOW,
    );
    expect(buckets[46]).toBeCloseTo(10, 5);
    expect(buckets[47]).toBeCloseTo(10, 5);
  });

  it("treats a missing stop as running until now", () => {
    const { buckets, count } = bucketSessions([{ start: iso(-15 * MINUTE) }], 24, NOW);
    expect(count).toBe(1);
    expect(buckets[47]).toBeCloseTo(15, 5);
  });

  it("clips sessions that started before the window", () => {
    // 6h window (7.5-min buckets); session started 7h ago, ended 5h55m ago →
    // only the 5 minutes inside the window count, all in bucket 0.
    const { buckets, count } = bucketSessions(
      [{ start: iso(-7 * HOUR), stop: iso(-(5 * HOUR + 55 * MINUTE)) }],
      6,
      NOW,
    );
    expect(count).toBe(1);
    expect(buckets[0]).toBeCloseTo(5, 5);
  });

  it("ignores sessions entirely outside the window and malformed records", () => {
    const { buckets, count } = bucketSessions(
      [
        { start: iso(-30 * HOUR), stop: iso(-26 * HOUR) },
        { start: "not-a-date", stop: iso(-1 * MINUTE) },
        { start: iso(-5 * MINUTE), stop: "garbage" },
      ],
      24,
      NOW,
    );
    expect(count).toBe(0);
    expect(buckets.every((value) => value === 0)).toBe(true);
  });

  it("counts each overlapping session once", () => {
    const { count } = bucketSessions(
      [
        { start: iso(-3 * HOUR), stop: iso(-2 * HOUR) },
        { start: iso(-1 * HOUR), stop: iso(-30 * MINUTE) },
        { start: iso(-10 * MINUTE) },
      ],
      24,
      NOW,
    );
    expect(count).toBe(3);
  });
});

describe("sessionRecords", () => {
  it("accepts arrays of records with string starts", () => {
    const records = sessionRecords([
      { start: "2026-07-11T10:00:00Z", stop: "2026-07-11T10:10:00Z" },
      { start: "2026-07-11T11:00:00Z" },
    ]);
    expect(records.length).toBe(2);
  });

  it("filters junk and tolerates non-arrays", () => {
    expect(sessionRecords(undefined)).toEqual([]);
    expect(sessionRecords("nope")).toEqual([]);
    expect(sessionRecords([{ stop: "x" }, null, 5, { start: "2026-07-11T10:00:00Z" }]).length).toBe(
      1,
    );
  });
});
