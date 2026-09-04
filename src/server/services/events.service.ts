/**
 * Events and event registrations.
 *
 * Data source: Prisma only. Nothing here reads data/*.json.
 *
 * `registered` is the authoritative count and is never derived from the
 * registrations relation. In the seed data every event's `registered` differs
 * from its roster length (evt-001 is 47 vs 3) — the roster is a partial list.
 * Registering therefore increments the counter AND appends a roster row.
 */

import { z } from "zod";
import { db } from "../db";
import { AppError, invalid, notFound } from "../lib/errors";
import { nextSequentialId } from "../lib/ids";
import { assertISODate, resolveDate, todayISO } from "../lib/time";
import { assertSpan } from "../lib/overlap";

const EventStatusEnum = z.enum([
  "upcoming",
  "ongoing",
  "completed",
  "cancelled",
  "full",
]);

export const EventCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  end_date: z.string().optional(),
  venue: z.string().min(1),
  organizer: z.string().min(1),
  capacity: z.coerce.number().int().nonnegative(),
  registered: z.coerce.number().int().nonnegative().default(0),
  status: EventStatusEnum.default("upcoming"),
});
/**
 * Update schema, declared separately rather than as `EventCreateSchema
 * .partial()`. Zod keeps `.default()` through `.partial()`, so a partial built
 * from the create schema turns an absent `registered` into 0 and silently
 * wipes the field on every edit. No defaults may appear here.
 */
export const EventUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  date: z.string().min(1).optional(),
  start_time: z.string().min(1).optional(),
  end_time: z.string().min(1).optional(),
  end_date: z.string().min(1).optional(),
  venue: z.string().min(1).optional(),
  organizer: z.string().min(1).optional(),
  capacity: z.coerce.number().int().nonnegative().optional(),
  registered: z.coerce.number().int().nonnegative().optional(),
  status: EventStatusEnum.optional(),
});

export const RegistrationSchema = z.object({
  student_id: z.string().min(1),
  name: z.string().min(1),
});

export type EventCreateInput = z.infer<typeof EventCreateSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const r = schema.safeParse(input);
  if (!r.success) throw invalid(`Invalid ${what}.`, r.error.issues);
  return r.data;
}

const withRegistrations = {
  registrations: { select: { student_id: true, name: true } },
} as const;

export interface EventFilters {
  date?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
  venue?: string;
  organizer?: string;
  search?: string;
}

export async function listEvents(filters: EventFilters = {}) {
  return db.event.findMany({
    where: {
      ...(filters.date ? { date: assertISODate(filters.date) } : {}),
      ...(filters.from_date || filters.to_date
        ? {
            date: {
              ...(filters.from_date
                ? { gte: assertISODate(filters.from_date) }
                : {}),
              ...(filters.to_date ? { lte: assertISODate(filters.to_date) } : {}),
            },
          }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.venue ? { venue: filters.venue } : {}),
      ...(filters.organizer
        ? { organizer: { contains: filters.organizer } }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search } },
              { description: { contains: filters.search } },
              { organizer: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: withRegistrations,
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });
}

export async function getEvent(id: string) {
  const row = await db.event.findUnique({
    where: { id },
    include: withRegistrations,
  });
  if (!row) throw notFound("Event", id);
  return row;
}

/**
 * Resolve an event from an id or a fragment of its name.
 *
 * "Register me for the Guest Lecture on Deep Learning" has to reach evt-002.
 * An ambiguous fragment returns every candidate rather than picking one, so
 * the agent can ask instead of guessing.
 */
export async function findEvent(ref: string) {
  const byId = await db.event.findUnique({
    where: { id: ref },
    include: withRegistrations,
  });
  if (byId) return { match: byId, candidates: [byId] };

  const words = ref.split(/\s+/).filter((w) => w.length > 3);
  const byName = await db.event.findMany({
    where: {
      OR: [
        { name: { contains: ref } },
        ...words.map((w) => ({ name: { contains: w } })),
      ],
    },
    include: withRegistrations,
    orderBy: { date: "asc" },
  });

  if (byName.length === 0) throw notFound("Event", ref);
  return { match: byName.length === 1 ? byName[0]! : null, candidates: byName };
}

/** Keep `status` consistent with capacity, without overriding a manual state. */
function derivedStatus(current: string, registered: number, capacity: number) {
  if (current === "cancelled" || current === "completed") return current;
  if (registered >= capacity) return "full";
  if (current === "full" && registered < capacity) return "upcoming";
  return current;
}

export async function createEvent(input: unknown) {
  const data = parse(EventCreateSchema, input, "event");

  const span = assertSpan(
    resolveDate(data.date),
    data.start_time,
    data.end_date ? resolveDate(data.end_date) : resolveDate(data.date),
    data.end_time,
  );

  if (data.registered > data.capacity) {
    throw invalid(
      `registered (${data.registered}) cannot exceed capacity (${data.capacity}).`,
    );
  }

  const ids = (await db.event.findMany({ select: { id: true } })).map((e) => e.id);

  return db.event.create({
    data: {
      id: nextSequentialId("event", ids),
      name: data.name.trim(),
      description: data.description,
      ...span,
      venue: data.venue.trim(),
      organizer: data.organizer.trim(),
      capacity: data.capacity,
      registered: data.registered,
      status: derivedStatus(data.status, data.registered, data.capacity),
    },
    include: withRegistrations,
  });
}

export async function updateEvent(id: string, input: unknown) {
  const current = await getEvent(id);
  const patch = parse(EventUpdateSchema, input, "event update");

  const span = assertSpan(
    patch.date ? resolveDate(patch.date) : current.date,
    patch.start_time ?? current.start_time,
    patch.end_date ? resolveDate(patch.end_date) : current.end_date,
    patch.end_time ?? current.end_time,
  );

  const capacity = patch.capacity ?? current.capacity;
  const registered = patch.registered ?? current.registered;

  if (registered > capacity) {
    throw invalid(
      `Capacity ${capacity} is below the ${registered} people already registered.`,
    );
  }

  return db.event.update({
    where: { id },
    data: {
      ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description }),
      ...span,
      ...(patch.venue === undefined ? {} : { venue: patch.venue.trim() }),
      ...(patch.organizer === undefined
        ? {}
        : { organizer: patch.organizer.trim() }),
      capacity,
      registered,
      status: derivedStatus(patch.status ?? current.status, registered, capacity),
    },
    include: withRegistrations,
  });
}

export async function deleteEvent(id: string) {
  await getEvent(id);
  // registrations cascade (prisma/schema.prisma)
  await db.event.delete({ where: { id } });
  return { id, deleted: true };
}

/* ------------------------------------------------------------------ *
 * Registration
 * ------------------------------------------------------------------ */

/**
 * Register a student.
 *
 * Refuses when the event is full, cancelled, completed, or the student is
 * already on the roster. The counter and the roster row move together in one
 * transaction so a failure cannot leave the count drifting from reality.
 */
export async function registerForEvent(eventRef: string, input: unknown) {
  const data = parse(RegistrationSchema, input, "registration");
  const { match, candidates } = await findEvent(eventRef);

  if (!match) {
    throw new AppError(
      "VALIDATION_ERROR",
      `"${eventRef}" matches ${candidates.length} events. Which one?`,
      { candidates: candidates.map((c) => ({ id: c.id, name: c.name })) },
    );
  }

  if (match.status === "cancelled" || match.status === "completed") {
    throw new AppError(
      "EVENT_CLOSED",
      `"${match.name}" is ${match.status} and is not accepting registrations.`,
    );
  }

  const already = await db.registration.findUnique({
    where: {
      event_id_student_id: { event_id: match.id, student_id: data.student_id },
    },
  });
  if (already) {
    throw new AppError(
      "DUPLICATE_REGISTRATION",
      `${data.student_id} is already registered for "${match.name}".`,
    );
  }

  if (match.registered >= match.capacity) {
    throw new AppError(
      "EVENT_FULL",
      `"${match.name}" is full (${match.registered}/${match.capacity}).`,
      { capacity: match.capacity, registered: match.registered },
    );
  }

  const registered = match.registered + 1;

  const [, event] = await db.$transaction([
    db.registration.create({
      data: {
        event_id: match.id,
        student_id: data.student_id.trim(),
        name: data.name.trim(),
      },
    }),
    db.event.update({
      where: { id: match.id },
      data: {
        registered,
        status: derivedStatus(match.status, registered, match.capacity),
      },
      include: withRegistrations,
    }),
  ]);

  return { event, registered_student: data };
}

export async function cancelRegistration(eventRef: string, studentId: string) {
  const { match, candidates } = await findEvent(eventRef);
  if (!match) {
    throw new AppError(
      "VALIDATION_ERROR",
      `"${eventRef}" matches ${candidates.length} events. Which one?`,
      { candidates: candidates.map((c) => ({ id: c.id, name: c.name })) },
    );
  }

  const existing = await db.registration.findUnique({
    where: {
      event_id_student_id: { event_id: match.id, student_id: studentId },
    },
  });
  if (!existing) {
    throw new AppError(
      "REGISTRATION_NOT_FOUND",
      `${studentId} is not registered for "${match.name}".`,
    );
  }

  const registered = Math.max(0, match.registered - 1);

  const [, event] = await db.$transaction([
    db.registration.delete({ where: { id: existing.id } }),
    db.event.update({
      where: { id: match.id },
      data: {
        registered,
        status: derivedStatus(match.status, registered, match.capacity),
      },
      include: withRegistrations,
    }),
  ]);

  return { event, cancelled_student_id: studentId };
}

export async function listRegistrations(eventId: string) {
  await getEvent(eventId);
  return db.registration.findMany({
    where: { event_id: eventId },
    orderBy: { id: "asc" },
  });
}

/* ------------------------------------------------------------------ *
 * Query helpers
 * ------------------------------------------------------------------ */

/** Events a student could walk into within a free window today. */
export async function findEventsInWindow(params: {
  date?: string;
  from_time?: string;
  to_time?: string;
}) {
  const date = params.date ? resolveDate(params.date) : todayISO();
  const events = await listEvents({ date });

  const from = params.from_time ?? "00:00";
  const to = params.to_time ?? "23:59";

  return {
    date,
    window: { from, to },
    events: events.filter(
      (e) =>
        e.status !== "cancelled" &&
        e.start_time < to &&
        e.end_time > from,
    ),
  };
}

export async function getUpcomingEvents(limit = 5, from = todayISO()) {
  return db.event.findMany({
    where: { date: { gte: assertISODate(from) }, status: { not: "cancelled" } },
    include: withRegistrations,
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
    take: limit,
  });
}

export async function countEvents() {
  return db.event.count();
}
