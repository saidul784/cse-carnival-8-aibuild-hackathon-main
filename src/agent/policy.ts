/**
 * Authorization policy for the AI agent.
 *
 * IMPORTANT: no official document defines roles or permissions. schema.md has
 * no user entity, and PROBLEM_STATEMENT.md only says the agent should "say no
 * when you are asking for something you should not be able to do". This file
 * is therefore a designed policy, not a transcribed requirement, and it is
 * kept in one place so it can be reviewed and changed as one decision.
 *
 * The model is a single student persona. A student may read everything, book
 * rooms, and manage their own registrations and coursework status. Anything
 * that edits shared institutional records — the timetable, the room inventory,
 * official notices, someone else's booking — is refused.
 */

export type Role = "student" | "staff";

export interface Actor {
  role: Role;
  student_id: string;
  name: string;
}

/**
 * The persona the agent acts as.
 *
 * schema/schema.md defines no student entity, so "my classes" and "register
 * me" need an identity from somewhere. This is configuration, not campus data,
 * and every field is overridable without touching code.
 *
 * The default is deliberately a student who does NOT appear in any seed roster.
 * The four students in data/events.json are already registered for events —
 * 20-40532 in particular is on evt-002, the target of the official sample query
 * "Register me for the Guest Lecture on Deep Learning". Defaulting to one of
 * them would make that query correctly but unhelpfully answer "you are already
 * registered" instead of demonstrating a registration.
 */
export function currentActor(): Actor {
  return {
    role: (process.env.DEMO_ROLE as Role) || "student",
    student_id: process.env.DEMO_STUDENT_ID || "20-40600",
    name: process.env.DEMO_STUDENT_NAME || "Demo Student",
  };
}

/** Tools a student may call. Anything absent is refused. */
const STUDENT_TOOLS = new Set([
  // read
  "get_current_datetime",
  "list_schedules",
  "get_next_class",
  "get_schedules_on_date",
  "list_assignments",
  "get_assignments_due_this_week",
  "list_announcements",
  "list_events",
  "find_events_in_window",
  "list_rooms",
  "check_room_availability",
  "find_available_rooms",
  // write
  "book_room",
  "cancel_room_booking",
  "register_for_event",
  "cancel_event_registration",
  "update_assignment_status",
]);

/** Staff additionally get nothing here yet — reserved, not exposed. */
const STAFF_TOOLS = new Set([...STUDENT_TOOLS]);

export const WRITE_TOOLS = new Set([
  "book_room",
  "cancel_room_booking",
  "register_for_event",
  "cancel_event_registration",
  "update_assignment_status",
]);

export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name);
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

export function canUseTool(actor: Actor, tool: string): PolicyDecision {
  const allowed = actor.role === "staff" ? STAFF_TOOLS : STUDENT_TOOLS;
  if (allowed.has(tool)) return { allowed: true };
  return {
    allowed: false,
    reason:
      `A ${actor.role} account cannot perform "${tool}". Editing the timetable, ` +
      `the room inventory, official announcements, or other people's records is ` +
      `restricted to department staff and must be done through the dashboard.`,
  };
}

/** A student may only cancel a booking they made themselves. */
export function canCancelBooking(
  actor: Actor,
  bookedBy: string,
): PolicyDecision {
  if (actor.role === "staff") return { allowed: true };
  if (bookedBy.trim().toLowerCase() === actor.name.trim().toLowerCase()) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `That booking was made by ${bookedBy}. You can only cancel bookings made in your own name (${actor.name}).`,
  };
}

/** A student may only manage their own event registration. */
export function canManageRegistration(
  actor: Actor,
  studentId: string,
): PolicyDecision {
  if (actor.role === "staff") return { allowed: true };
  if (studentId.trim() === actor.student_id.trim()) return { allowed: true };
  return {
    allowed: false,
    reason: `You can only register or cancel for your own student ID (${actor.student_id}), not ${studentId}.`,
  };
}

/**
 * Things the agent is asked for that no tool exists to do. Listed explicitly so
 * the refusal explains the boundary instead of the model improvising one.
 */
export const UNSUPPORTED_ACTIONS = [
  "deleting classes, rooms, events, announcements or assignments",
  "creating or editing official announcements",
  "editing the class timetable or room inventory",
  "changing assignment marks or grades",
  "registering or cancelling on behalf of another student",
  "cancelling a booking made by someone else",
] as const;
