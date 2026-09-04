/**
 * Schedules — class timetable.
 *
 * Data source: Prisma only. Nothing here reads data/*.json.
 */

import { z } from "zod";
import { db } from "../db";
import { notFound, invalid } from "../lib/errors";
import { nextSequentialId } from "../lib/ids";
import {
  CLASS_DAYS,
  DayName,
  addDays,
  assertISODate,
  dayNameOf,
  normalizeTime,
  nowHHMM,
  todayISO,
} from "../lib/time";
import { assertTimeRange } from "../lib/overlap";

const DayEnum = z.enum([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
]);

export const ScheduleCreateSchema = z.object({
  course: z.string().min(1),
  title: z.string().min(1),
  day: DayEnum,
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  // Free string on purpose: sch-011/012 use 7C07 and sch-020 uses 9A05,
  // neither of which exists in rooms. See prisma/schema.prisma note 4.
  room: z.string().min(1),
  instructor: z.string().min(1),
  section: z.string().min(1),
});

/**
 * Declared separately for consistency with the other services, where
 * `.partial()` would have carried `.default()` values through and wiped
 * fields on edit. This schema has no defaults.
 */
export const ScheduleUpdateSchema = z.object({
  course: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  day: DayEnum.optional(),
  start_time: z.string().min(1).optional(),
  end_time: z.string().min(1).optional(),
  room: z.string().min(1).optional(),
  instructor: z.string().min(1).optional(),
  section: z.string().min(1).optional(),
});

export type ScheduleCreateInput = z.infer<typeof ScheduleCreateSchema>;
export type ScheduleUpdateInput = z.infer<typeof ScheduleUpdateSchema>;

export interface ScheduleFilters {
  day?: string;
  course?: string;
  room?: string;
  instructor?: string;
  section?: string;
  search?: string;
}

function parse<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw invalid(`Invalid ${what}.`, r.error.issues);
  }
  return r.data;
}

/** Sunday-first ordering, then start time. */
function sortSchedules<T extends { day: string; start_time: string }>(rows: T[]) {
  return rows.sort((a, b) => {
    const da = CLASS_DAYS.indexOf(a.day as DayName);
    const dbi = CLASS_DAYS.indexOf(b.day as DayName);
    if (da !== dbi) return da - dbi;
    return a.start_time.localeCompare(b.start_time);
  });
}

export async function listSchedules(filters: ScheduleFilters = {}) {
  const rows = await db.schedule.findMany({
    where: {
      ...(filters.day ? { day: filters.day } : {}),
      ...(filters.course
        ? { course: { contains: filters.course } }
        : {}),
      ...(filters.room ? { room: filters.room } : {}),
      ...(filters.instructor
        ? { instructor: { contains: filters.instructor } }
        : {}),
      ...(filters.section ? { section: filters.section } : {}),
      ...(filters.search
        ? {
            OR: [
              { course: { contains: filters.search } },
              { title: { contains: filters.search } },
              { instructor: { contains: filters.search } },
              { room: { contains: filters.search } },
            ],
          }
        : {}),
    },
  });
  return sortSchedules(rows);
}

export async function getSchedule(id: string) {
  const row = await db.schedule.findUnique({ where: { id } });
  if (!row) throw notFound("Schedule", id);
  return row;
}

export async function createSchedule(input: unknown) {
  const data = parse(ScheduleCreateSchema, input, "schedule");
  const { start, end } = assertTimeRange(data.start_time, data.end_time);

  const ids = (await db.schedule.findMany({ select: { id: true } })).map(
    (r) => r.id,
  );

  return db.schedule.create({
    data: {
      id: nextSequentialId("schedule", ids),
      course: data.course.trim(),
      title: data.title.trim(),
      day: data.day,
      start_time: start,
      end_time: end,
      room: data.room.trim(),
      instructor: data.instructor.trim(),
      section: data.section.trim(),
    },
  });
}

export async function updateSchedule(id: string, input: unknown) {
  const current = await getSchedule(id);
  const patch = parse(ScheduleUpdateSchema, input, "schedule update");

  const start_time = patch.start_time
    ? normalizeTime(patch.start_time)
    : current.start_time;
  const end_time = patch.end_time
    ? normalizeTime(patch.end_time)
    : current.end_time;
  assertTimeRange(start_time, end_time);

  return db.schedule.update({
    where: { id },
    data: {
      ...(patch.course === undefined ? {} : { course: patch.course.trim() }),
      ...(patch.title === undefined ? {} : { title: patch.title.trim() }),
      ...(patch.day === undefined ? {} : { day: patch.day }),
      start_time,
      end_time,
      ...(patch.room === undefined ? {} : { room: patch.room.trim() }),
      ...(patch.instructor === undefined
        ? {}
        : { instructor: patch.instructor.trim() }),
      ...(patch.section === undefined ? {} : { section: patch.section.trim() }),
    },
  });
}

export async function deleteSchedule(id: string) {
  await getSchedule(id); // 404 rather than a silent no-op
  await db.schedule.delete({ where: { id } });
  return { id, deleted: true };
}

/* ------------------------------------------------------------------ *
 * Query helpers used by the dashboard and the agent
 * ------------------------------------------------------------------ */

export async function getSchedulesForDay(day: string) {
  return listSchedules({ day });
}

/**
 * The next class from a given moment.
 *
 * Walks forward day by day, skipping Friday and Saturday (no classes), and
 * returns the first class that has not already started. Looks up to 14 days
 * ahead so it still answers correctly over a long break.
 *
 * `section` is optional and left to the caller: no student identity exists in
 * the dataset, so this service refuses to guess one.
 */
export async function getNextClass(options: {
  fromDate?: string;
  fromTime?: string;
  section?: string;
  course?: string;
} = {}) {
  const fromDate = options.fromDate
    ? assertISODate(options.fromDate)
    : todayISO();
  const fromTime = options.fromTime
    ? normalizeTime(options.fromTime)
    : nowHHMM();

  const all = await listSchedules({
    ...(options.section ? { section: options.section } : {}),
    ...(options.course ? { course: options.course } : {}),
  });

  for (let offset = 0; offset <= 14; offset++) {
    const date = addDays(fromDate, offset);
    const day = dayNameOf(date);
    if (!CLASS_DAYS.includes(day)) continue;

    const candidates = all
      .filter((s) => s.day === day)
      .filter((s) => offset > 0 || s.start_time > fromTime)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    const next = candidates[0];
    if (next) {
      return {
        schedule: next,
        date,
        day,
        days_away: offset,
        is_today: offset === 0,
      };
    }
  }

  return null;
}

/** Classes occurring on a specific calendar date (resolves date -> weekday). */
export async function getSchedulesOnDate(isoDate: string) {
  const date = assertISODate(isoDate);
  const day = dayNameOf(date);
  if (!CLASS_DAYS.includes(day)) return { date, day, schedules: [] };
  return { date, day, schedules: await listSchedules({ day }) };
}

export async function countSchedules() {
  return db.schedule.count();
}
