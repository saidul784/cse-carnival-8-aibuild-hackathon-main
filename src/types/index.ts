/**
 * API response types.
 *
 * Field names mirror schema/schema.md exactly, so what the API returns and
 * what the documentation promises are the same shape.
 */

export type Priority = "high" | "medium" | "low";
export type AssignmentStatus = "pending" | "submitted" | "graded" | "late";
export type EventStatus =
  | "upcoming"
  | "ongoing"
  | "completed"
  | "cancelled"
  | "full";
export type RoomType = "classroom" | "lab" | "seminar";
export type RoomStatus = "available" | "unavailable";
export type ClassDay =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday";

export interface Schedule {
  id: string;
  course: string;
  title: string;
  day: ClassDay;
  start_time: string;
  end_time: string;
  room: string;
  instructor: string;
  section: string;
}

export interface Booking {
  booking_id: string;
  room_id: string;
  booked_by: string;
  date: string;
  start_time: string;
  end_time: string;
  purpose: string;
}

export interface Room {
  id: string;
  room_number: string;
  type: RoomType;
  capacity: number;
  equipment: string[];
  floor: number;
  status: RoomStatus;
  bookings: Booking[];
}

export interface Registration {
  student_id: string;
  name: string;
}

export interface CampusEvent {
  id: string;
  name: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  end_date: string;
  venue: string;
  organizer: string;
  capacity: number;
  registered: number;
  registrations: Registration[];
  status: EventStatus;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  priority: Priority;
  posted_by: string;
  expires: string;
  is_expired: boolean;
}

export interface Assignment {
  id: string;
  course: string;
  course_title: string;
  title: string;
  description: string;
  assigned_date: string;
  deadline: string;
  submission_platform: string;
  status: AssignmentStatus;
  marks: number;
  is_overdue: boolean;
  is_due_today: boolean;
  days_remaining: number;
}

export interface AvailabilityResult {
  window: { date: string; start_time: string; end_time: string };
  count: number;
  rooms: (Room & { warnings: string[] })[];
}

export interface Overview {
  context: {
    date: string;
    time: string;
    day: string;
    is_weekend: boolean;
    is_class_day: boolean;
    tomorrow: string;
    academic_week: { start: string; end: string; label: string };
  };
  counts: {
    schedules: number;
    rooms: number;
    bookings: number;
    events: number;
    registrations: number;
    announcements: number;
    assignments: number;
  };
  next_class: {
    schedule: Schedule;
    date: string;
    day: string;
    days_away: number;
    is_today: boolean;
  } | null;
  today: {
    date: string;
    day: string;
    is_weekend: boolean;
    classes: Schedule[];
    events: CampusEvent[];
  };
  assignments: {
    due_this_week: {
      window: { start: string; end: string; label: string };
      count: number;
      assignments: Assignment[];
    };
    overdue_count: number;
    overdue: Assignment[];
    breakdown: Record<string, number>;
  };
  announcements: {
    high_priority_active: Announcement[];
    breakdown: {
      by_priority: Record<string, number>;
      active: number;
      expired: number;
    };
  };
  events: { upcoming: CampusEvent[]; breakdown: Record<string, number> };
  rooms: {
    date: string;
    total: number;
    unavailable: number;
    booked_today: number;
    free_today: number;
    bookings_today: number;
  };
}
