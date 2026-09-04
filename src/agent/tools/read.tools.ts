/**
 * Read tools.
 *
 * Every one calls a service, which calls Prisma. No tool reads data/*.json and
 * none caches: each invocation hits the database, so an edit made in the
 * dashboard a second earlier is visible on the very next question.
 */

import type { Tool } from "./registry";
import * as S from "@/server/services/schedules.service";
import * as R from "@/server/services/rooms.service";
import * as E from "@/server/services/events.service";
import * as A from "@/server/services/announcements.service";
import * as G from "@/server/services/assignments.service";
import { currentContext } from "@/server/lib/time";
import * as Args from "./schemas";

export const readTools: Tool[] = [
  {
    name: "get_current_datetime",
    description:
      "The current campus date, time and weekday, plus tomorrow's date and the current Sunday-Thursday academic week. Call this before reasoning about today, tomorrow, this week, or anything relative.",
    args: Args.EmptyArgs,
    run: async () => currentContext(),
  },

  {
    name: "list_schedules",
    description:
      "Class timetable entries, optionally filtered. Use for questions about which classes run on a given day, in a room, or for a course.",
    args: Args.ListSchedulesArgs,
    run: async (a) => {
      const rows = await S.listSchedules(a);
      return { count: rows.length, schedules: rows };
    },
  },

  {
    name: "get_next_class",
    description:
      "The next upcoming class from now, skipping Friday and Saturday. Returns null when nothing is scheduled in the next two weeks.",
    args: Args.NextClassArgs,
    run: async (a) => {
      const next = await S.getNextClass(a);
      return next ?? { next_class: null, note: "No classes in the next 14 days." };
    },
  },

  {
    name: "get_schedules_on_date",
    description:
      "Classes on a specific calendar date. Resolves the date to a weekday and returns an empty list for Friday and Saturday.",
    args: Args.OnDateArgs,
    run: async (a) => S.getSchedulesOnDate(a.date),
  },

  {
    name: "list_assignments",
    description:
      "Assignments with deadlines and submission status. Each result includes is_overdue and days_remaining.",
    args: Args.ListAssignmentsArgs,
    run: async (a) => {
      const rows = await G.listAssignments(a);
      return { count: rows.length, assignments: rows };
    },
  },

  {
    name: "get_assignments_due_this_week",
    description:
      "Assignments due in the current Sunday-Thursday academic week. Returns the exact date window it used, which you should state in your answer.",
    args: Args.EmptyArgs,
    run: async () => G.getAssignmentsDueThisWeek(),
  },

  {
    name: "list_announcements",
    description:
      "Campus announcements, sorted high priority first then most recent. Check these whenever a class location or time is in question: an announcement can supersede the timetable.",
    args: Args.ListAnnouncementsArgs,
    run: async (a) => {
      const rows = await A.listAnnouncements(a);
      return { count: rows.length, announcements: rows };
    },
  },

  {
    name: "list_events",
    description:
      "Campus events with live registration counts. `registered` is the authoritative count; `registrations` is a partial roster of names.",
    args: Args.ListEventsArgs,
    run: async (a) => {
      const rows = await E.listEvents(a);
      return { count: rows.length, events: rows };
    },
  },

  {
    name: "find_events_in_window",
    description:
      "Events overlapping a time window on a date. Use for questions like 'I'm free until 2 — is anything on?'.",
    args: Args.EventsInWindowArgs,
    run: async (a) => E.findEventsInWindow(a),
  },

  {
    name: "list_rooms",
    description:
      "Rooms filtered by type, capacity and equipment. Use for 'which labs have a projector and fit 30 people'. This does NOT check whether a room is free at a time — use find_available_rooms for that.",
    args: Args.ListRoomsArgs,
    run: async (a) => {
      const rows = await R.listRooms(a);
      return { count: rows.length, rooms: rows };
    },
  },

  {
    name: "check_room_availability",
    description:
      "Whether one specific room is free in a window. Returns conflicting bookings, plus warnings for regular classes or events that normally use the room at that time.",
    args: Args.CheckAvailabilityArgs,
    run: async (a) =>
      R.checkAvailability(a.room, {
        date: a.date,
        start_time: a.start_time,
        end_time: a.end_time,
      }),
  },

  {
    name: "find_available_rooms",
    description:
      "Every room free in a window, filtered by size, equipment and type, smallest suitable room first. Use this when the user has requirements but has not named a room.",
    args: Args.FindRoomsArgs,
    run: async (a) => R.findAvailableRooms(a),
  },
];
