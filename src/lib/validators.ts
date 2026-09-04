/**
 * Shared validation schemas.
 *
 * Single source of truth for request shapes. The write schemas are re-exported
 * from the services that own the business rules rather than redeclared here —
 * two copies would drift, and a drifted validator is how a route starts
 * accepting something the service rejects.
 *
 * These same schemas back the AI agent's tool definitions in a later phase, so
 * the agent and the dashboard can never disagree about what a valid input is.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Write schemas — owned by the services
 * ------------------------------------------------------------------ */

export {
  ScheduleCreateSchema,
  ScheduleUpdateSchema,
} from "@/server/services/schedules.service";

export {
  RoomCreateSchema,
  RoomUpdateSchema,
  BookingCreateSchema,
  BookingUpdateSchema,
} from "@/server/services/rooms.service";

export {
  EventCreateSchema,
  EventUpdateSchema,
  RegistrationSchema,
} from "@/server/services/events.service";

export {
  AnnouncementCreateSchema,
  AnnouncementUpdateSchema,
} from "@/server/services/announcements.service";

export {
  AssignmentCreateSchema,
  AssignmentUpdateSchema,
} from "@/server/services/assignments.service";

/* ------------------------------------------------------------------ *
 * Query-string helpers
 * ------------------------------------------------------------------ */

/** Absent and empty-string query params both mean "no filter". */
const optionalString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .catch(undefined);

const optionalInt = z.coerce.number().int().optional().catch(undefined);

/** `?flag=true` / `?flag=1` / bare `?flag` all read as true. */
const optionalBool = z
  .union([z.literal(""), z.string()])
  .optional()
  .transform((v) =>
    v === undefined ? undefined : ["", "1", "true", "yes"].includes(v.toLowerCase()),
  );

/**
 * Repeatable list param. Accepts `?equipment=projector&equipment=AC` and
 * `?equipment=projector,AC` so both hand-written URLs and generated ones work.
 */
function listParam(params: URLSearchParams, key: string): string[] | undefined {
  const all = params.getAll(key);
  if (all.length === 0) return undefined;
  const flat = all
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  return flat.length ? flat : undefined;
}

export const ScheduleQuerySchema = z.object({
  day: optionalString,
  course: optionalString,
  room: optionalString,
  instructor: optionalString,
  section: optionalString,
  search: optionalString,
});

export const RoomQuerySchema = z.object({
  type: optionalString,
  status: optionalString,
  room_number: optionalString,
  min_capacity: optionalInt,
  max_capacity: optionalInt,
  search: optionalString,
});

export const RoomAvailabilityQuerySchema = z.object({
  date: z.string().trim().min(1, "date is required"),
  start_time: z.string().trim().min(1, "start_time is required"),
  end_time: z.string().trim().min(1, "end_time is required"),
  min_capacity: optionalInt,
  type: optionalString,
});

export const BookingQuerySchema = z.object({
  date: optionalString,
  booked_by: optionalString,
});

export const EventQuerySchema = z.object({
  date: optionalString,
  from_date: optionalString,
  to_date: optionalString,
  status: optionalString,
  venue: optionalString,
  organizer: optionalString,
  search: optionalString,
});

export const AnnouncementQuerySchema = z.object({
  priority: optionalString,
  posted_by: optionalString,
  on_date: optionalString,
  search: optionalString,
  active_only: optionalBool,
});

export const AssignmentQuerySchema = z.object({
  status: optionalString,
  course: optionalString,
  due_from: optionalString,
  due_to: optionalString,
  search: optionalString,
  outstanding_only: optionalBool,
});

/**
 * Parse a URL's query string with one of the schemas above.
 * Unknown params are ignored; malformed ones fall back to "no filter" rather
 * than failing the whole request, since a filter is never load-bearing.
 */
export function parseQuery<T>(
  schema: z.ZodType<T>,
  url: string | URL,
  extra?: (params: URLSearchParams) => Record<string, unknown>,
): T {
  const params = new URL(String(url)).searchParams;
  const raw: Record<string, unknown> = {};
  for (const [k, v] of params.entries()) {
    if (raw[k] === undefined) raw[k] = v;
  }
  const merged = { ...raw, ...(extra ? extra(params) : {}) };
  const result = schema.safeParse(merged);
  if (!result.success) {
    // Only the required-field schemas (availability) can land here.
    throw result.error;
  }
  return result.data;
}

/** Pull the repeatable `equipment` param out of a URL. */
export function equipmentParam(url: string | URL): string[] | undefined {
  return listParam(new URL(String(url)).searchParams, "equipment");
}
