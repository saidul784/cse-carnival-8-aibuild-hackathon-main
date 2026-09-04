/**
 * Date and time helpers.
 *
 * schema/schema.md stores every date as an ISO "YYYY-MM-DD" string and every
 * time as a 24h "HH:MM" string. Both formats sort and range-compare correctly
 * as plain text, so all arithmetic here operates on strings and uses UTC
 * internally — never local-time Date maths, which drifts across DST and
 * timezones on date-only values.
 *
 * schema/schema.md also states: "The university week runs Sunday-Thursday
 * (Friday-Saturday are weekends)." That rule lives here.
 */

import { AppError, invalid } from "./errors";

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export type DayName = (typeof DAY_NAMES)[number];

/** Days the university actually teaches on (schema/schema.md). */
export const CLASS_DAYS: DayName[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
];

/* ------------------------------------------------------------------ *
 * "Now"
 * ------------------------------------------------------------------ */

/**
 * Current time.
 *
 * Defaults to the real system clock. `DEMO_NOW` may override it with an ISO
 * timestamp (e.g. "2026-09-04T10:00:00") so the app can be demonstrated
 * against the seed data's September 2026 dates without touching any code.
 * When the variable is unset or unparseable the real clock is used, so this
 * override is inert unless someone deliberately sets it.
 */
export function now(): Date {
  const override = process.env.DEMO_NOW;
  if (override) {
    const d = new Date(override);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Today as "YYYY-MM-DD", in the server's local calendar. */
export function todayISO(): string {
  const d = now();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Current wall clock as "HH:MM". */
export function nowHHMM(): string {
  const d = now();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ *
 * Parsing and normalising
 * ------------------------------------------------------------------ */

/**
 * Normalise a time to zero-padded 24h "HH:MM".
 *
 * Accepts "15:00", "9:00", "3 PM", "3:30pm", "0900". Zero-padding matters:
 * "9:00" < "10:00" is false under string comparison, and every range query in
 * this codebase compares times as strings.
 */
export function normalizeTime(input: string): string {
  const raw = String(input).trim();

  const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2] ?? "0");
    const isPM = ampm[3]!.toLowerCase() === "p";
    if (h < 1 || h > 12 || m > 59) {
      throw invalid(`"${input}" is not a valid time.`);
    }
    if (h === 12) h = 0;
    if (isPM) h += 12;
    return `${pad(h)}:${pad(m)}`;
  }

  const colon = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    if (h > 23 || m > 59) throw invalid(`"${input}" is not a valid time.`);
    return `${pad(h)}:${pad(m)}`;
  }

  const compact = raw.match(/^(\d{2})(\d{2})$/);
  if (compact) {
    const h = Number(compact[1]);
    const m = Number(compact[2]);
    if (h > 23 || m > 59) throw invalid(`"${input}" is not a valid time.`);
    return `${pad(h)}:${pad(m)}`;
  }

  const hourOnly = raw.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const h = Number(hourOnly[1]);
    if (h > 23) throw invalid(`"${input}" is not a valid time.`);
    return `${pad(h)}:00`;
  }

  throw invalid(`"${input}" is not a valid time. Use 24h "HH:MM".`);
}

/** Assert an ISO date string, returning it unchanged. */
export function assertISODate(input: string, field = "date"): string {
  const raw = String(input).trim();
  if (!ISO_DATE_RE.test(raw)) {
    throw invalid(`${field} must be an ISO date "YYYY-MM-DD", got "${input}".`);
  }
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw invalid(`${field} "${input}" is not a real date.`);
  }
  return raw;
}

/** Minutes since midnight, for interval maths. */
export function toMinutes(hhmm: string): number {
  const t = normalizeTime(hhmm);
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

/* ------------------------------------------------------------------ *
 * Calendar maths (UTC-based, string in / string out)
 * ------------------------------------------------------------------ */

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${assertISODate(isoDate)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function dayNameOf(isoDate: string): DayName {
  const d = new Date(`${assertISODate(isoDate)}T00:00:00Z`);
  return DAY_NAMES[d.getUTCDay()]!;
}

/** Friday and Saturday, per schema/schema.md. */
export function isWeekend(isoDate: string): boolean {
  const day = dayNameOf(isoDate);
  return day === "Friday" || day === "Saturday";
}

export function isClassDay(isoDate: string): boolean {
  return CLASS_DAYS.includes(dayNameOf(isoDate));
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${assertISODate(fromISO)}T00:00:00Z`).getTime();
  const b = new Date(`${assertISODate(toISO)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Resolve the relative dates the agent will be asked about.
 * Anything already in ISO form is passed straight through.
 */
export function resolveDate(input: string, from = todayISO()): string {
  const raw = String(input).trim().toLowerCase();

  if (ISO_DATE_RE.test(raw)) return assertISODate(raw);
  if (raw === "today") return from;
  if (raw === "tomorrow") return addDays(from, 1);
  if (raw === "yesterday") return addDays(from, -1);
  if (raw === "day after tomorrow") return addDays(from, 2);

  // "next monday", "monday"
  const named = raw.replace(/^(next|this|coming)\s+/, "");
  const idx = DAY_NAMES.findIndex((d) => d.toLowerCase() === named);
  if (idx >= 0) {
    for (let i = 1; i <= 7; i++) {
      const candidate = addDays(from, i);
      if (dayNameOf(candidate) === DAY_NAMES[idx]) return candidate;
    }
  }

  throw invalid(
    `Could not understand the date "${input}". Use "YYYY-MM-DD", "today" or "tomorrow".`,
  );
}

/**
 * The academic week window used for "this week".
 *
 * The university week is Sunday-Thursday, so the window starts on the Sunday
 * on or before `from` and ends the following Thursday. When `from` is a
 * Friday or Saturday (a weekend) the *upcoming* week is returned, because a
 * student asking "what's due this week" on a Friday means the week ahead.
 */
export function academicWeek(from = todayISO()): {
  start: string;
  end: string;
  label: string;
} {
  const day = dayNameOf(from);
  let start: string;

  if (day === "Friday") start = addDays(from, 2);
  else if (day === "Saturday") start = addDays(from, 1);
  else start = addDays(from, -DAY_NAMES.indexOf(day)); // back to Sunday

  const end = addDays(start, 4); // Sunday + 4 = Thursday
  return { start, end, label: `${start} to ${end} (Sunday-Thursday)` };
}

/** Comparable key for a date+time pair. */
export function stamp(isoDate: string, hhmm: string): string {
  return `${assertISODate(isoDate)}T${normalizeTime(hhmm)}`;
}

/** A human-readable snapshot of "now", for the agent's time tool. */
export function currentContext() {
  const date = todayISO();
  return {
    date,
    time: nowHHMM(),
    day: dayNameOf(date),
    is_weekend: isWeekend(date),
    is_class_day: isClassDay(date),
    tomorrow: addDays(date, 1),
    academic_week: academicWeek(date),
  };
}

export { AppError };
