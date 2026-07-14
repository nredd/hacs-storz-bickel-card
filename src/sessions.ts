/**
 * Session bucketing for the "Sessions" bar chart.
 *
 * The design prototype (lines 504–535) renders 48 bars spanning the selected
 * window, each bar the session-minutes inside that time bucket. The prototype
 * generated demo values; this module computes the same shape from the
 * integration's `session_history.attributes.sessions` records.
 */

import type { SessionRecord } from "./types";

/** Number of bars in the sessions chart (prototype line 508). */
export const SESSION_BUCKETS = 48;

/** Bucketed sessions: 48 values of session-minutes plus the window's count. */
export interface BucketedSessions {
  buckets: number[];
  count: number;
}

/**
 * Bucket `records` into {@link SESSION_BUCKETS} bars covering the trailing
 * `windowHours` before `now` (ms epoch). A session contributes its overlap
 * minutes to every bucket it spans; `count` is the number of sessions that
 * overlap the window at all. Records without a stop are treated as running
 * until `now`; malformed timestamps are skipped.
 */
export function bucketSessions(
  records: SessionRecord[],
  windowHours: number,
  now: number,
): BucketedSessions {
  const buckets = new Array<number>(SESSION_BUCKETS).fill(0);
  const windowMs = windowHours * 3_600_000;
  const windowStart = now - windowMs;
  const bucketMs = windowMs / SESSION_BUCKETS;
  let count = 0;

  for (const record of records) {
    const start = Date.parse(record.start);
    if (Number.isNaN(start)) {
      continue;
    }
    const stop = record.stop == null ? now : Date.parse(record.stop);
    if (Number.isNaN(stop)) {
      continue;
    }
    const from = Math.max(start, windowStart);
    const to = Math.min(stop, now);
    if (to <= from) {
      continue;
    }
    count++;
    const firstBucket = Math.max(0, Math.floor((from - windowStart) / bucketMs));
    const lastBucket = Math.min(SESSION_BUCKETS - 1, Math.floor((to - windowStart) / bucketMs));
    for (let i = firstBucket; i <= lastBucket; i++) {
      const bucketStart = windowStart + i * bucketMs;
      const bucketEnd = bucketStart + bucketMs;
      const overlap = Math.min(to, bucketEnd) - Math.max(from, bucketStart);
      if (overlap > 0) {
        buckets[i] = (buckets[i] ?? 0) + overlap / 60_000;
      }
    }
  }

  return { buckets, count };
}

/** Parse the `sessions` attribute defensively (unknown → empty list). */
export function sessionRecords(value: unknown): SessionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is SessionRecord =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as SessionRecord).start === "string",
  );
}
