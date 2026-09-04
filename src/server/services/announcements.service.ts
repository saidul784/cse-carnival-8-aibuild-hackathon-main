/**
 * Announcements.
 *
 * Data source: Prisma only. Nothing here reads data/*.json.
 *
 * `expires` is the date after which a notice is stale (schema/schema.md). A
 * notice is treated as active while today <= expires; ISO date strings compare
 * correctly as text, so no date parsing is needed for the filter.
 */

import { z } from "zod";
import { db } from "../db";
import { invalid, notFound } from "../lib/errors";
import { nextSequentialId } from "../lib/ids";
import { assertISODate, resolveDate, todayISO } from "../lib/time";

const PriorityEnum = z.enum(["high", "medium", "low"]);

export const AnnouncementCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  date: z.string().optional(),
  priority: PriorityEnum.default("medium"),
  posted_by: z.string().min(1),
  expires: z.string().min(1),
});
/**
 * Declared separately, not as `.partial()` of the create schema: Zod keeps
 * `.default()` through `.partial()`, which would reset `priority` to "medium"
 * on every edit that did not explicitly send it. No defaults here.
 */
export const AnnouncementUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  priority: PriorityEnum.optional(),
  posted_by: z.string().min(1).optional(),
  expires: z.string().min(1).optional(),
});

export type AnnouncementCreateInput = z.infer<typeof AnnouncementCreateSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const r = schema.safeParse(input);
  if (!r.success) throw invalid(`Invalid ${what}.`, r.error.issues);
  return r.data;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export interface AnnouncementFilters {
  priority?: string;
  active_only?: boolean;
  search?: string;
  posted_by?: string;
  on_date?: string;
}

type Row = {
  id: string;
  title: string;
  body: string;
  date: string;
  priority: string;
  posted_by: string;
  expires: string;
};

/** Attach the derived staleness flag the dashboard and agent both need. */
function decorate<T extends Row>(row: T, today = todayISO()) {
  return { ...row, is_expired: row.expires < today };
}

export async function listAnnouncements(filters: AnnouncementFilters = {}) {
  const today = todayISO();

  const rows = await db.announcement.findMany({
    where: {
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.active_only ? { expires: { gte: today } } : {}),
      ...(filters.posted_by
        ? { posted_by: { contains: filters.posted_by } }
        : {}),
      ...(filters.on_date ? { date: assertISODate(filters.on_date) } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search } },
              { body: { contains: filters.search } },
            ],
          }
        : {}),
    },
  });

  // High priority first, then most recent.
  rows.sort((a, b) => {
    const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (p !== 0) return p;
    return b.date.localeCompare(a.date);
  });

  return rows.map((r) => decorate(r, today));
}

export async function getAnnouncement(id: string) {
  const row = await db.announcement.findUnique({ where: { id } });
  if (!row) throw notFound("Announcement", id);
  return decorate(row);
}

export async function createAnnouncement(input: unknown) {
  const data = parse(AnnouncementCreateSchema, input, "announcement");

  const date = data.date ? resolveDate(data.date) : todayISO();
  const expires = resolveDate(data.expires);

  if (expires < date) {
    throw invalid(`expires (${expires}) cannot be before the post date (${date}).`);
  }

  const ids = (await db.announcement.findMany({ select: { id: true } })).map(
    (a) => a.id,
  );

  const created = await db.announcement.create({
    data: {
      id: nextSequentialId("announcement", ids),
      title: data.title.trim(),
      body: data.body.trim(),
      date,
      priority: data.priority,
      posted_by: data.posted_by.trim(),
      expires,
    },
  });
  return decorate(created);
}

export async function updateAnnouncement(id: string, input: unknown) {
  const current = await getAnnouncement(id);
  const patch = parse(AnnouncementUpdateSchema, input, "announcement update");

  const date = patch.date ? resolveDate(patch.date) : current.date;
  const expires = patch.expires ? resolveDate(patch.expires) : current.expires;

  if (expires < date) {
    throw invalid(`expires (${expires}) cannot be before the post date (${date}).`);
  }

  const updated = await db.announcement.update({
    where: { id },
    data: {
      ...(patch.title === undefined ? {} : { title: patch.title.trim() }),
      ...(patch.body === undefined ? {} : { body: patch.body.trim() }),
      date,
      ...(patch.priority === undefined ? {} : { priority: patch.priority }),
      ...(patch.posted_by === undefined
        ? {}
        : { posted_by: patch.posted_by.trim() }),
      expires,
    },
  });
  return decorate(updated);
}

export async function deleteAnnouncement(id: string) {
  await getAnnouncement(id);
  await db.announcement.delete({ where: { id } });
  return { id, deleted: true };
}

/** Active, high-priority notices — the dashboard banner and agent shortcut. */
export async function getHighPriorityAnnouncements(activeOnly = false) {
  return listAnnouncements({ priority: "high", active_only: activeOnly });
}

export async function countAnnouncements() {
  return db.announcement.count();
}
