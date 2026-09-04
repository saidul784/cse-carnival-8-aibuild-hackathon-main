/**
 * Action tools — the writes the agent is officially allowed to perform.
 *
 * PROBLEM_STATEMENT.md names booking a room and registering for an event; the
 * assignment status update is the "required record update" for a student's own
 * coursework. Every other write stays with the dashboard, and policy.ts refuses
 * it by omission.
 *
 * All ownership checks happen here, before the service is called, so a refusal
 * never has a side effect.
 */

import type { Tool } from "./registry";
import * as R from "@/server/services/rooms.service";
import * as E from "@/server/services/events.service";
import * as G from "@/server/services/assignments.service";
import { canCancelBooking, canManageRegistration } from "../policy";
import * as Args from "./schemas";

export const actionTools: Tool[] = [
  {
    name: "book_room",
    description:
      "Book a room for a specific date and time window. Fails with BOOKING_CONFLICT if the room is already taken, and NOT_FOUND if the room does not exist. Only call this once you know exactly which room and which times — ask the user first if either is vague.",
    args: Args.BookRoomArgs,
    write: true,
    run: async (a, actor) => {
      const result = await R.createBooking(a.room, {
        booked_by: actor.name,
        date: a.date,
        start_time: a.start_time,
        end_time: a.end_time,
        purpose: a.purpose ?? "Booked via CampusOS assistant",
      });
      return {
        booked: true,
        booking_id: result.booking.booking_id,
        room_number: result.room_number,
        date: result.booking.date,
        start_time: result.booking.start_time,
        end_time: result.booking.end_time,
        booked_by: result.booking.booked_by,
        purpose: result.booking.purpose,
        warnings: result.warnings,
      };
    },
  },

  {
    name: "cancel_room_booking",
    description:
      "Cancel a room booking by its id. A student may only cancel bookings made in their own name.",
    args: Args.CancelBookingArgs,
    write: true,
    run: async (a, actor) => {
      const booking = await R.getBooking(a.booking_id);
      const decision = canCancelBooking(actor, booking.booked_by);
      if (!decision.allowed) {
        return { refused: true, reason: decision.reason };
      }
      await R.deleteBooking(a.booking_id);
      return { cancelled: true, booking_id: a.booking_id };
    },
  },

  {
    name: "register_for_event",
    description:
      "Register the current user for an event. Fails with EVENT_FULL when the event is at capacity, DUPLICATE_REGISTRATION if already registered, and returns candidates when the name matches more than one event.",
    args: Args.RegisterEventArgs,
    write: true,
    run: async (a, actor) => {
      const decision = canManageRegistration(actor, actor.student_id);
      if (!decision.allowed) return { refused: true, reason: decision.reason };

      const result = await E.registerForEvent(a.event, {
        student_id: actor.student_id,
        name: actor.name,
      });
      return {
        registered: true,
        event_id: result.event.id,
        event_name: result.event.name,
        date: result.event.date,
        start_time: result.event.start_time,
        venue: result.event.venue,
        registered_count: result.event.registered,
        capacity: result.event.capacity,
        status: result.event.status,
      };
    },
  },

  {
    name: "cancel_event_registration",
    description:
      "Cancel the current user's registration for an event. Fails with REGISTRATION_NOT_FOUND if they were not registered.",
    args: Args.CancelRegistrationArgs,
    write: true,
    run: async (a, actor) => {
      const decision = canManageRegistration(actor, actor.student_id);
      if (!decision.allowed) return { refused: true, reason: decision.reason };

      const result = await E.cancelRegistration(a.event, actor.student_id);
      return {
        cancelled: true,
        event_id: result.event.id,
        event_name: result.event.name,
        registered_count: result.event.registered,
        capacity: result.event.capacity,
      };
    },
  },

  {
    name: "update_assignment_status",
    description:
      "Update the submission status of an assignment to pending, submitted, graded or late. This changes status only — marks cannot be changed.",
    args: Args.UpdateAssignmentStatusArgs,
    write: true,
    run: async (a) => {
      const updated = await G.setAssignmentStatus(a.assignment_id, a.status);
      return {
        updated: true,
        id: updated.id,
        title: updated.title,
        course: updated.course,
        status: updated.status,
        deadline: updated.deadline,
      };
    },
  },
];
