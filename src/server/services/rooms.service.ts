/**
 * Rooms, room availability and bookings.
 *
 * Data source: Prisma only. Nothing here reads data/*.json.
 *
 * `equipment` is a relation table because SQLite has no array type. Every
 * value returned from this service reshapes it back to the `string[]` that
 * schema/schema.md documents, so the API contract is unchanged.
 */

import { z } from "zod";
import { db } from "../db";
import { AppError, invalid, notFound } from "../lib/errors";
import { nextSequentialId } from "../lib/ids";
import {
  assertISODate,
  dayNameOf,
  normalizeTime,
  resolveDate,
  CLASS_DAYS,
} from "../lib/time";
import { Interval, assertTimeRange, findConflicts } from "../lib/overlap";

const RoomTypeEnum = z.enum(["classroom", "lab", "seminar"]);
const RoomStatusEnum = z.enum(["available", "unavailable"]);

export const RoomCreateSchema = z.object({
  room_number: z.string().min(1),
  type: RoomTypeEnum,
  capacity: z.coerce.number().int().nonnegative(),
  equipment: z.array(z.string().min(1)).default([]),
  floor: z.coerce.number().int(),
  status: RoomStatusEnum.default("available"),
});
/**
 * Declared separately, not as `.partial()` of the create schema: Zod keeps
 * `.default()` through `.partial()`, which would wipe `equipment` to [] and
 * reset `status` on every edit. No defaults here.
 */
export const RoomUpdateSchema = z.object({
  room_number: z.string().min(1).optional(),
  type: RoomTypeEnum.optional(),
  capacity: z.coerce.number().int().nonnegative().optional(),
  equipment: z.array(z.string().min(1)).optional(),
  floor: z.coerce.number().int().optional(),
  status: RoomStatusEnum.optional(),
});

export const BookingCreateSchema = z.object({
  booked_by: z.string().min(1),
  date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  purpose: z.string().default(""),
});
/** Separate for the same reason as RoomUpdateSchema: no defaults. */
export const BookingUpdateSchema = z.object({
  booked_by: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  start_time: z.string().min(1).optional(),
  end_time: z.string().min(1).optional(),
  purpose: z.string().optional(),
});

export type RoomCreateInput = z.infer<typeof RoomCreateSchema>;
export type BookingCreateInput = z.infer<typeof BookingCreateSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const r = schema.safeParse(input);
  if (!r.success) throw invalid(`Invalid ${what}.`, r.error.issues);
  return r.data;
}

const withRelations = {
  equipment: { select: { name: true } },
  bookings: true,
} as const;

type RawRoom = {
  id: string;
  room_number: string;
  type: string;
  capacity: number;
  floor: number;
  status: string;
  equipment: { name: string }[];
  bookings: unknown[];
};

/** Reshape to the schema/schema.md contract. */
function toDto(room: RawRoom) {
  const { equipment, ...rest } = room;
  return {
    ...rest,
    equipment: equipment.map((e) => e.name).sort(),
  };
}

export interface RoomFilters {
  type?: string;
  min_capacity?: number;
  max_capacity?: number;
  equipment?: string[];
  status?: string;
  room_number?: string;
  search?: string;
}

export async function listRooms(filters: RoomFilters = {}) {
  const rows = await db.room.findMany({
    where: {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.room_number ? { room_number: filters.room_number } : {}),
      ...(filters.min_capacity !== undefined
        ? { capacity: { gte: filters.min_capacity } }
        : {}),
      ...(filters.max_capacity !== undefined
        ? { capacity: { lte: filters.max_capacity } }
        : {}),
      // Every requested item must be present: repeated `some` clauses are
      // ANDed, which is what "projector AND whiteboard" should mean.
      ...(filters.equipment?.length
        ? {
            AND: filters.equipment.map((name) => ({
              equipment: { some: { name: { equals: name } } },
            })),
          }
        : {}),
      ...(filters.search ? { room_number: { contains: filters.search } } : {}),
    },
    include: withRelations,
    orderBy: { room_number: "asc" },
  });
  return rows.map(toDto);
}

export async function getRoom(id: string) {
  const row = await db.room.findUnique({ where: { id }, include: withRelations });
  if (!row) throw notFound("Room", id);
  return toDto(row);
}

export async function getRoomByNumber(roomNumber: string) {
  const row = await db.room.findUnique({
    where: { room_number: roomNumber },
    include: withRelations,
  });
  if (!row) throw notFound("Room", roomNumber);
  return toDto(row);
}

/** Accepts either a room id ("room-002") or a room number ("7A02"). */
export async function resolveRoom(ref: string) {
  const byId = await db.room.findUnique({
    where: { id: ref },
    include: withRelations,
  });
  if (byId) return toDto(byId);

  const byNumber = await db.room.findUnique({
    where: { room_number: ref },
    include: withRelations,
  });
  if (byNumber) return toDto(byNumber);

  throw notFound("Room", ref);
}

export async function createRoom(input: unknown) {
  const data = parse(RoomCreateSchema, input, "room");

  const clash = await db.room.findUnique({
    where: { room_number: data.room_number },
  });
  if (clash) {
    throw new AppError(
      "CONFLICT",
      `Room ${data.room_number} already exists.`,
    );
  }

  const ids = (await db.room.findMany({ select: { id: true } })).map((r) => r.id);
  const created = await db.room.create({
    data: {
      id: nextSequentialId("room", ids),
      room_number: data.room_number.trim(),
      type: data.type,
      capacity: data.capacity,
      floor: data.floor,
      status: data.status,
      equipment: {
        create: [...new Set(data.equipment.map((e) => e.trim()))].map((name) => ({
          name,
        })),
      },
    },
    include: withRelations,
  });
  return toDto(created);
}

export async function updateRoom(id: string, input: unknown) {
  await getRoom(id);
  const patch = parse(RoomUpdateSchema, input, "room update");

  if (patch.room_number) {
    const clash = await db.room.findUnique({
      where: { room_number: patch.room_number },
    });
    if (clash && clash.id !== id) {
      throw new AppError("CONFLICT", `Room ${patch.room_number} already exists.`);
    }
  }

  const updated = await db.room.update({
    where: { id },
    data: {
      ...(patch.room_number === undefined
        ? {}
        : { room_number: patch.room_number.trim() }),
      ...(patch.type === undefined ? {} : { type: patch.type }),
      ...(patch.capacity === undefined ? {} : { capacity: patch.capacity }),
      ...(patch.floor === undefined ? {} : { floor: patch.floor }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.equipment === undefined
        ? {}
        : {
            equipment: {
              deleteMany: {},
              create: [...new Set(patch.equipment.map((e) => e.trim()))].map(
                (name) => ({ name }),
              ),
            },
          }),
    },
    include: withRelations,
  });
  return toDto(updated);
}

export async function deleteRoom(id: string) {
  await getRoom(id);
  // equipment and bookings cascade (prisma/schema.prisma)
  await db.room.delete({ where: { id } });
  return { id, deleted: true };
}

/* ------------------------------------------------------------------ *
 * Availability
 * ------------------------------------------------------------------ */

export interface AvailabilityWindow {
  date: string;
  start_time: string;
  end_time: string;
}

function normaliseWindow(w: {
  date: string;
  start_time: string;
  end_time: string;
}): AvailabilityWindow {
  const date = resolveDate(w.date);
  const { start, end } = assertTimeRange(w.start_time, w.end_time);
  return { date, start_time: start, end_time: end };
}

/**
 * Is a room free in a window?
 *
 * Bookings are a hard constraint: an overlapping booking blocks. The class
 * timetable and events are reported as *warnings* rather than blockers —
 * PROBLEM_STATEMENT.md asks the agent to "check it is actually free" but never
 * defines "free" as including the recurring timetable, and hard-refusing on
 * that basis would reject bookings the brief expects to succeed.
 */
export async function checkAvailability(
  roomRef: string,
  window: { date: string; start_time: string; end_time: string },
  options: { excludeBookingId?: string } = {},
) {
  const room = await resolveRoom(roomRef);
  const w = normaliseWindow(window);

  if (room.status === "unavailable") {
    return {
      room_number: room.room_number,
      ...w,
      available: false,
      reason: "ROOM_UNAVAILABLE" as const,
      conflicts: [],
      warnings: [`Room ${room.room_number} is marked unavailable.`],
    };
  }

  const sameDay = await db.booking.findMany({
    where: {
      room_id: room.id,
      date: w.date,
      ...(options.excludeBookingId
        ? { booking_id: { not: options.excludeBookingId } }
        : {}),
    },
  });

  const candidate: Interval = { start: w.start_time, end: w.end_time };
  const conflicts = findConflicts(
    candidate,
    sameDay.map((b) => ({ ...b, start: b.start_time, end: b.end_time })),
  );

  const warnings: string[] = [];

  const day = dayNameOf(w.date);
  if (CLASS_DAYS.includes(day)) {
    const classes = await db.schedule.findMany({
      where: { room: room.room_number, day },
    });
    for (const c of findConflicts(
      candidate,
      classes.map((c) => ({ ...c, start: c.start_time, end: c.end_time })),
    )) {
      warnings.push(
        `${c.course} (${c.section}) normally uses ${room.room_number} on ${day} ${c.start_time}-${c.end_time}.`,
      );
    }
  }

  const events = await db.event.findMany({
    where: { venue: room.room_number, date: w.date },
  });
  for (const e of findConflicts(
    candidate,
    events.map((e) => ({ ...e, start: e.start_time, end: e.end_time })),
  )) {
    warnings.push(
      `Event "${e.name}" is scheduled in ${room.room_number} on ${w.date} ${e.start_time}-${e.end_time}.`,
    );
  }

  return {
    room_number: room.room_number,
    ...w,
    available: conflicts.length === 0,
    reason: conflicts.length === 0 ? null : ("BOOKING_CONFLICT" as const),
    conflicts: conflicts.map((c) => ({
      booking_id: c.booking_id,
      booked_by: c.booked_by,
      start_time: c.start_time,
      end_time: c.end_time,
      purpose: c.purpose,
    })),
    warnings,
  };
}

/** Every room free in a window, optionally filtered by size/equipment/type. */
export async function findAvailableRooms(params: {
  date: string;
  start_time: string;
  end_time: string;
  min_capacity?: number;
  equipment?: string[];
  type?: string;
}) {
  const w = normaliseWindow(params);

  const candidates = await listRooms({
    status: "available",
    ...(params.type ? { type: params.type } : {}),
    ...(params.min_capacity !== undefined
      ? { min_capacity: params.min_capacity }
      : {}),
    ...(params.equipment?.length ? { equipment: params.equipment } : {}),
  });

  const results = [];
  for (const room of candidates) {
    const check = await checkAvailability(room.room_number, w);
    if (check.available) {
      results.push({ ...room, warnings: check.warnings });
    }
  }

  // Smallest room that still fits first: booking a 70-seat hall for 5 people
  // is a poor answer to "I need a room for 5 people".
  results.sort((a, b) => a.capacity - b.capacity);
  return { window: w, count: results.length, rooms: results };
}

/* ------------------------------------------------------------------ *
 * Bookings
 * ------------------------------------------------------------------ */

export async function listBookings(
  filters: { room_id?: string; date?: string; booked_by?: string } = {},
) {
  return db.booking.findMany({
    where: {
      ...(filters.room_id ? { room_id: filters.room_id } : {}),
      ...(filters.date ? { date: assertISODate(filters.date) } : {}),
      ...(filters.booked_by
        ? { booked_by: { contains: filters.booked_by } }
        : {}),
    },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });
}

export async function getBooking(bookingId: string) {
  const row = await db.booking.findUnique({ where: { booking_id: bookingId } });
  if (!row) throw notFound("Booking", bookingId);
  return row;
}

export async function createBooking(roomRef: string, input: unknown) {
  const data = parse(BookingCreateSchema, input, "booking");
  const room = await resolveRoom(roomRef);

  const check = await checkAvailability(room.room_number, {
    date: data.date,
    start_time: data.start_time,
    end_time: data.end_time,
  });

  if (check.reason === "ROOM_UNAVAILABLE") {
    throw new AppError(
      "ROOM_UNAVAILABLE",
      `Room ${room.room_number} is marked unavailable and cannot be booked.`,
    );
  }

  if (!check.available) {
    throw new AppError(
      "BOOKING_CONFLICT",
      `Room ${room.room_number} is already booked on ${check.date} between ${check.conflicts
        .map((c) => `${c.start_time}-${c.end_time}`)
        .join(", ")}.`,
      { conflicts: check.conflicts },
    );
  }

  const ids = (await db.booking.findMany({ select: { booking_id: true } })).map(
    (b) => b.booking_id,
  );

  const booking = await db.booking.create({
    data: {
      booking_id: nextSequentialId("booking", ids),
      room_id: room.id,
      booked_by: data.booked_by.trim(),
      date: check.date,
      start_time: check.start_time,
      end_time: check.end_time,
      purpose: data.purpose.trim(),
    },
  });

  return { booking, room_number: room.room_number, warnings: check.warnings };
}

export async function updateBooking(bookingId: string, input: unknown) {
  const current = await getBooking(bookingId);
  const patch = parse(BookingUpdateSchema, input, "booking update");

  const date = patch.date ? resolveDate(patch.date) : current.date;
  const start_time = patch.start_time
    ? normalizeTime(patch.start_time)
    : current.start_time;
  const end_time = patch.end_time
    ? normalizeTime(patch.end_time)
    : current.end_time;
  assertTimeRange(start_time, end_time);

  const check = await checkAvailability(
    current.room_id,
    { date, start_time, end_time },
    { excludeBookingId: bookingId },
  );

  if (!check.available) {
    throw new AppError(
      "BOOKING_CONFLICT",
      `That change clashes with an existing booking on ${date}.`,
      { conflicts: check.conflicts },
    );
  }

  return db.booking.update({
    where: { booking_id: bookingId },
    data: {
      date,
      start_time,
      end_time,
      ...(patch.booked_by === undefined
        ? {}
        : { booked_by: patch.booked_by.trim() }),
      ...(patch.purpose === undefined ? {} : { purpose: patch.purpose.trim() }),
    },
  });
}

export async function deleteBooking(bookingId: string) {
  await getBooking(bookingId);
  await db.booking.delete({ where: { booking_id: bookingId } });
  return { booking_id: bookingId, deleted: true };
}

export async function countRooms() {
  return db.room.count();
}
