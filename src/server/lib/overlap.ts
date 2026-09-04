/**
 * Time-interval overlap.
 *
 * Intervals are treated as half-open, [start, end). Two bookings that merely
 * touch — 14:00-16:00 and 16:00-18:00 — do NOT overlap. Getting this wrong in
 * the closed direction rejects legitimate back-to-back bookings, which is a
 * silent way to fail the "taking the right actions" criterion.
 */

import { invalid } from "./errors";
import { normalizeTime, toMinutes, assertISODate, stamp } from "./time";

export interface Interval {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

/** Half-open overlap test on same-day "HH:MM" ranges. */
export function overlaps(a: Interval, b: Interval): boolean {
  const aS = toMinutes(a.start);
  const aE = toMinutes(a.end);
  const bS = toMinutes(b.start);
  const bE = toMinutes(b.end);
  return aS < bE && bS < aE;
}

/**
 * Validate a same-day booking window.
 *
 * Bookings must have a positive duration. Events are deliberately NOT
 * validated with this: evt-001 runs 09:00 -> 09:00 across two dates, so event
 * ranges are checked with `assertSpan` instead.
 */
export function assertTimeRange(startRaw: string, endRaw: string): Interval {
  const start = normalizeTime(startRaw);
  const end = normalizeTime(endRaw);
  if (toMinutes(end) <= toMinutes(start)) {
    throw invalid(
      `End time (${end}) must be after start time (${start}).`,
    );
  }
  return { start, end };
}

/**
 * Validate a possibly multi-day span. The end instant must be strictly after
 * the start instant, but the times themselves may be equal when the dates
 * differ (a 24-hour event).
 */
export function assertSpan(
  startDateRaw: string,
  startTimeRaw: string,
  endDateRaw: string,
  endTimeRaw: string,
): { date: string; start_time: string; end_date: string; end_time: string } {
  const date = assertISODate(startDateRaw, "date");
  const end_date = assertISODate(endDateRaw, "end_date");
  const start_time = normalizeTime(startTimeRaw);
  const end_time = normalizeTime(endTimeRaw);

  if (stamp(end_date, end_time) <= stamp(date, start_time)) {
    throw invalid(
      `Event ends (${end_date} ${end_time}) before or when it starts (${date} ${start_time}).`,
    );
  }
  return { date, start_time, end_date, end_time };
}

/** Find every interval in `existing` that clashes with `candidate`. */
export function findConflicts<T extends Interval>(
  candidate: Interval,
  existing: T[],
): T[] {
  return existing.filter((e) => overlaps(candidate, e));
}
