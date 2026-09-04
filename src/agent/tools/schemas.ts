/**
 * Tool argument schemas.
 *
 * Each entry pairs the JSON Schema the LLM is shown with the Zod schema that
 * validates what actually comes back. They live side by side so a change to one
 * is an obvious prompt to change the other — an LLM-facing schema that has
 * drifted from its validator is how an agent starts sending arguments the
 * service silently ignores.
 */

import { z } from "zod";
import type { JsonSchema } from "../providers";

export interface ArgSpec<T> {
  json: JsonSchema;
  zod: z.ZodType<T>;
}

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const bool = (description: string) => ({ type: "boolean", description });
const strArray = (description: string) => ({
  type: "array",
  items: { type: "string" },
  description,
});

function spec<T>(
  properties: Record<string, unknown>,
  required: string[],
  zodSchema: z.ZodType<T>,
): ArgSpec<T> {
  return {
    json: { type: "object", properties, required, additionalProperties: false },
    zod: zodSchema,
  };
}

const DATE_HINT =
  'ISO date "YYYY-MM-DD", or the word "today" or "tomorrow".';
const TIME_HINT =
  '24-hour "HH:MM". 12-hour forms like "3 PM" are also accepted.';

/* ----------------------------- read tools ----------------------------- */

export const EmptyArgs = spec({}, [], z.object({}));

export const ListSchedulesArgs = spec(
  {
    day: str('Day of week: Sunday, Monday, Tuesday, Wednesday or Thursday.'),
    course: str('Course code, e.g. "CSE 4113".'),
    room: str('Room number, e.g. "7A03".'),
    instructor: str("Instructor name, partial match allowed."),
    section: str('Section label, e.g. "B" or "B1/B2".'),
    search: str("Free text across course, title, instructor and room."),
  },
  [],
  z.object({
    day: z.string().optional(),
    course: z.string().optional(),
    room: z.string().optional(),
    instructor: z.string().optional(),
    section: z.string().optional(),
    search: z.string().optional(),
  }),
);

export const NextClassArgs = spec(
  {
    section: str("Restrict to one section."),
    course: str("Restrict to one course code."),
  },
  [],
  z.object({ section: z.string().optional(), course: z.string().optional() }),
);

export const OnDateArgs = spec(
  { date: str(DATE_HINT) },
  ["date"],
  z.object({ date: z.string().min(1) }),
);

export const ListAssignmentsArgs = spec(
  {
    status: str("pending, submitted, graded or late."),
    course: str('Course code, e.g. "CSE 4113".'),
    due_from: str(`Earliest deadline. ${DATE_HINT}`),
    due_to: str(`Latest deadline. ${DATE_HINT}`),
    search: str("Free text across title, description and course."),
    outstanding_only: bool("Only assignments still pending or late."),
  },
  [],
  z.object({
    status: z.string().optional(),
    course: z.string().optional(),
    due_from: z.string().optional(),
    due_to: z.string().optional(),
    search: z.string().optional(),
    outstanding_only: z.boolean().optional(),
  }),
);

export const ListAnnouncementsArgs = spec(
  {
    priority: str("high, medium or low."),
    active_only: bool("Exclude notices whose expiry date has passed."),
    search: str("Free text across title and body."),
  },
  [],
  z.object({
    priority: z.string().optional(),
    active_only: z.boolean().optional(),
    search: z.string().optional(),
  }),
);

export const ListEventsArgs = spec(
  {
    date: str(`Events on one date. ${DATE_HINT}`),
    from_date: str(`Range start. ${DATE_HINT}`),
    to_date: str(`Range end. ${DATE_HINT}`),
    status: str("upcoming, ongoing, completed, cancelled or full."),
    search: str("Free text across name, description and organizer."),
  },
  [],
  z.object({
    date: z.string().optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
  }),
);

export const EventsInWindowArgs = spec(
  {
    date: str(`Defaults to today. ${DATE_HINT}`),
    from_time: str(`Window start. ${TIME_HINT}`),
    to_time: str(`Window end. ${TIME_HINT}`),
  },
  [],
  z.object({
    date: z.string().optional(),
    from_time: z.string().optional(),
    to_time: z.string().optional(),
  }),
);

export const ListRoomsArgs = spec(
  {
    type: str("classroom, lab or seminar."),
    min_capacity: num("Minimum number of people the room must seat."),
    equipment: strArray(
      'All items must be present. Known values: projector, whiteboard, AC, computers, "smart board", microphone, podium, "document camera".',
    ),
    status: str("available or unavailable."),
    room_number: str('Exact room number, e.g. "7A02".'),
  },
  [],
  z.object({
    type: z.string().optional(),
    min_capacity: z.number().optional(),
    equipment: z.array(z.string()).optional(),
    status: z.string().optional(),
    room_number: z.string().optional(),
  }),
);

export const CheckAvailabilityArgs = spec(
  {
    room: str('Room number ("7A02") or room id ("room-002").'),
    date: str(DATE_HINT),
    start_time: str(TIME_HINT),
    end_time: str(TIME_HINT),
  },
  ["room", "date", "start_time", "end_time"],
  z.object({
    room: z.string().min(1),
    date: z.string().min(1),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
  }),
);

export const FindRoomsArgs = spec(
  {
    date: str(DATE_HINT),
    start_time: str(TIME_HINT),
    end_time: str(TIME_HINT),
    min_capacity: num("Minimum number of people."),
    equipment: strArray("Equipment that must all be present."),
    type: str("classroom, lab or seminar."),
  },
  ["date", "start_time", "end_time"],
  z.object({
    date: z.string().min(1),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    min_capacity: z.number().optional(),
    equipment: z.array(z.string()).optional(),
    type: z.string().optional(),
  }),
);

/* ---------------------------- action tools ---------------------------- */

export const BookRoomArgs = spec(
  {
    room: str('Room number ("7A02") or room id. Must be a room that exists.'),
    date: str(DATE_HINT),
    start_time: str(TIME_HINT),
    end_time: str(TIME_HINT),
    purpose: str("Short reason for the booking."),
  },
  ["room", "date", "start_time", "end_time"],
  z.object({
    room: z.string().min(1),
    date: z.string().min(1),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    purpose: z.string().optional(),
  }),
);

export const CancelBookingArgs = spec(
  { booking_id: str('Booking id, e.g. "bk-004".') },
  ["booking_id"],
  z.object({ booking_id: z.string().min(1) }),
);

export const RegisterEventArgs = spec(
  {
    event: str(
      'Event id ("evt-002") or part of its name ("Guest Lecture on Deep Learning").',
    ),
  },
  ["event"],
  z.object({ event: z.string().min(1) }),
);

export const CancelRegistrationArgs = spec(
  { event: str("Event id or part of its name.") },
  ["event"],
  z.object({ event: z.string().min(1) }),
);

export const UpdateAssignmentStatusArgs = spec(
  {
    assignment_id: str('Assignment id, e.g. "asgn-001".'),
    status: str("pending, submitted, graded or late."),
  },
  ["assignment_id", "status"],
  z.object({
    assignment_id: z.string().min(1),
    status: z.enum(["pending", "submitted", "graded", "late"]),
  }),
);
