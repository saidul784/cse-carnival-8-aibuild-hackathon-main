/**
 * Dashboard statistics.
 *
 * Data source: Prisma only, through the other services, so a number shown on
 * the overview and the same number reported by the agent can never disagree.
 * Nothing is cached: every call re-reads current state.
 */

import { db } from "../db";
import { currentContext, todayISO } from "../lib/time";
import { getNextClass, getSchedulesOnDate } from "./schedules.service";
import { getAssignmentsDueThisWeek, getOverdueAssignments } from "./assignments.service";
import { getHighPriorityAnnouncements, listAnnouncements } from "./announcements.service";
import { getUpcomingEvents, listEvents } from "./events.service";

export async function getCounts() {
  const [
    schedules,
    rooms,
    bookings,
    events,
    registrations,
    announcements,
    assignments,
  ] = await Promise.all([
    db.schedule.count(),
    db.room.count(),
    db.booking.count(),
    db.event.count(),
    db.registration.count(),
    db.announcement.count(),
    db.assignment.count(),
  ]);

  return {
    schedules,
    rooms,
    bookings,
    events,
    registrations,
    announcements,
    assignments,
  };
}

/** Today's room usage: booked vs free, for the overview tiles. */
export async function getRoomUtilisation(date = todayISO()) {
  const [total, unavailable, bookedToday] = await Promise.all([
    db.room.count(),
    db.room.count({ where: { status: "unavailable" } }),
    db.booking.findMany({ where: { date }, select: { room_id: true } }),
  ]);

  const distinctBooked = new Set(bookedToday.map((b) => b.room_id)).size;

  return {
    date,
    total,
    unavailable,
    booked_today: distinctBooked,
    free_today: Math.max(0, total - unavailable - distinctBooked),
    bookings_today: bookedToday.length,
  };
}

export async function getAssignmentBreakdown() {
  const rows = await db.assignment.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {
    pending: 0,
    submitted: 0,
    graded: 0,
    late: 0,
  };
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

export async function getAnnouncementBreakdown() {
  const today = todayISO();
  const rows = await db.announcement.groupBy({
    by: ["priority"],
    _count: { _all: true },
  });
  const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };
  for (const r of rows) byPriority[r.priority] = r._count._all;

  const active = await db.announcement.count({
    where: { expires: { gte: today } },
  });

  return { by_priority: byPriority, active, expired: (await db.announcement.count()) - active };
}

export async function getEventBreakdown() {
  const rows = await db.event.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {
    upcoming: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0,
    full: 0,
  };
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

/**
 * Everything the overview page needs, in one round trip.
 * Also doubles as a quick health check that all five systems are readable.
 */
export async function getOverview() {
  const context = currentContext();
  const today = context.date;

  const [
    counts,
    nextClass,
    todaySchedule,
    dueThisWeek,
    overdue,
    highPriority,
    todayEvents,
    upcomingEvents,
    rooms,
    assignmentBreakdown,
    announcementBreakdown,
    eventBreakdown,
  ] = await Promise.all([
    getCounts(),
    getNextClass(),
    getSchedulesOnDate(today),
    getAssignmentsDueThisWeek(today),
    getOverdueAssignments(today),
    getHighPriorityAnnouncements(true),
    listEvents({ date: today }),
    getUpcomingEvents(5, today),
    getRoomUtilisation(today),
    getAssignmentBreakdown(),
    getAnnouncementBreakdown(),
    getEventBreakdown(),
  ]);

  return {
    context,
    counts,
    next_class: nextClass,
    today: {
      date: today,
      day: context.day,
      is_weekend: context.is_weekend,
      classes: todaySchedule.schedules,
      events: todayEvents,
    },
    assignments: {
      due_this_week: dueThisWeek,
      overdue_count: overdue.length,
      overdue,
      breakdown: assignmentBreakdown,
    },
    announcements: {
      high_priority_active: highPriority,
      breakdown: announcementBreakdown,
    },
    events: {
      upcoming: upcomingEvents,
      breakdown: eventBreakdown,
    },
    rooms,
  };
}

/** Cheap liveness probe for all five systems. */
export async function getHealth() {
  const counts = await getCounts();
  const markers = await db.seedMarker.count();
  return {
    ok: true,
    seeded: markers > 0,
    seed_markers: markers,
    counts,
    checked_at: new Date().toISOString(),
  };
}
