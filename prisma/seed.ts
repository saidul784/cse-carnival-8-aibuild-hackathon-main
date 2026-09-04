/**
 * CampusOS — idempotent database seeder.
 *
 * Loads the five READ-ONLY files in data/ into the database. Those files are
 * opened for reading and never written to: they are seed input, not the
 * runtime database (README.md, "Important").
 *
 * Idempotency has two independent layers, because they guard different
 * failure modes:
 *
 *   Layer 1 — SeedMarker. Once a dataset has been seeded, a marker row records
 *   it and later runs skip that dataset entirely. Without this, a record a
 *   judge deleted through the dashboard would silently reappear on the next
 *   restart.
 *
 *   Layer 2 — id difference. When a dataset has no marker but rows already
 *   exist (an interrupted first run, a restored backup), only rows whose
 *   primary key is absent get inserted.
 *
 * Nothing is ever updated or deleted. A record already in the database always
 * wins over the seed file, so edits made through the dashboard or the agent
 * survive every restart.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), "data");

/* ------------------------------------------------------------------ *
 * Validation — mirrors schema/schema.md exactly.
 * ------------------------------------------------------------------ */

const HHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be 24h HH:MM");
const ISO_DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be ISO date YYYY-MM-DD");
const NonEmpty = z.string().min(1);

// NOTE: there is deliberately no `end_time > start_time` rule. evt-001 is a
// 24-hour hackathon stored as 09:00 -> 09:00 across two dates; such a rule
// would reject valid seed data.

const ScheduleSchema = z.object({
  id: NonEmpty,
  course: NonEmpty,
  title: NonEmpty,
  day: z.enum(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]),
  start_time: HHMM,
  end_time: HHMM,
  room: NonEmpty, // free string: 7C07 and 9A05 are not rooms in rooms.json
  instructor: NonEmpty,
  section: NonEmpty,
});

const BookingSchema = z.object({
  booking_id: NonEmpty,
  booked_by: NonEmpty,
  date: ISO_DATE,
  start_time: HHMM,
  end_time: HHMM,
  purpose: z.string(),
});

const RoomSchema = z.object({
  id: NonEmpty,
  room_number: NonEmpty,
  type: z.enum(["classroom", "lab", "seminar"]),
  capacity: z.number().int().nonnegative(),
  equipment: z.array(NonEmpty),
  floor: z.number().int(),
  status: z.enum(["available", "unavailable"]),
  bookings: z.array(BookingSchema).default([]),
});

const RegistrationSchema = z.object({
  student_id: NonEmpty,
  name: NonEmpty,
});

const EventSchema = z.object({
  id: NonEmpty,
  name: NonEmpty,
  description: z.string(),
  date: ISO_DATE,
  start_time: HHMM,
  end_time: HHMM,
  end_date: ISO_DATE,
  venue: NonEmpty,
  organizer: NonEmpty,
  capacity: z.number().int().nonnegative(),
  registered: z.number().int().nonnegative(),
  registrations: z.array(RegistrationSchema).default([]),
  status: z.enum(["upcoming", "ongoing", "completed", "cancelled", "full"]),
});

const AnnouncementSchema = z.object({
  id: NonEmpty,
  title: NonEmpty,
  body: z.string(),
  date: ISO_DATE,
  priority: z.enum(["high", "medium", "low"]),
  posted_by: NonEmpty,
  expires: ISO_DATE,
});

const AssignmentSchema = z.object({
  id: NonEmpty,
  course: NonEmpty,
  course_title: NonEmpty,
  title: NonEmpty,
  description: z.string(),
  assigned_date: ISO_DATE,
  deadline: ISO_DATE,
  submission_platform: NonEmpty,
  status: z.enum(["pending", "submitted", "graded", "late"]),
  marks: z.number().int().nonnegative(),
});

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function load<T>(file: string, schema: z.ZodType<T>): T[] {
  const full = path.join(DATA_DIR, file);
  const raw = readFileSync(full, "utf-8"); // read-only, always
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${file}: expected a top-level array`);
  }

  const out: T[] = [];
  const problems: string[] = [];

  parsed.forEach((row, i) => {
    const result = schema.safeParse(row);
    if (result.success) {
      out.push(result.data);
    } else {
      const where =
        row && typeof row === "object" && "id" in row
          ? String((row as { id: unknown }).id)
          : `index ${i}`;
      for (const issue of result.error.issues) {
        problems.push(
          `  ${file} [${where}] ${issue.path.join(".")}: ${issue.message}`,
        );
      }
    }
  });

  if (problems.length) {
    throw new Error(`Seed validation failed:\n${problems.join("\n")}`);
  }

  console.log(`  validated ${out.length} records from ${file}`);
  return out;
}

/** True when this dataset has already been seeded and must be left alone. */
async function alreadySeeded(key: string): Promise<boolean> {
  const marker = await prisma.seedMarker.findUnique({ where: { key } });
  return marker !== null;
}

type Report = {
  dataset: string;
  inserted: number;
  skipped: number;
  note: string;
};
const report: Report[] = [];

/* ------------------------------------------------------------------ *
 * Per-dataset seeding
 * ------------------------------------------------------------------ */

async function seedSchedules() {
  const key = "schedules";
  const rows = load("schedules.json", ScheduleSchema);

  if (await alreadySeeded(key)) {
    report.push({
      dataset: key,
      inserted: 0,
      skipped: rows.length,
      note: "marker present — skipped",
    });
    return;
  }

  const existing = new Set(
    (await prisma.schedule.findMany({ select: { id: true } })).map((r) => r.id),
  );
  const fresh = rows.filter((r) => !existing.has(r.id));

  await prisma.$transaction(async (tx) => {
    for (const r of fresh) await tx.schedule.create({ data: r });
    await tx.seedMarker.create({
      data: { key, source: "data/schedules.json", record_count: rows.length },
    });
  });

  report.push({
    dataset: key,
    inserted: fresh.length,
    skipped: rows.length - fresh.length,
    note:
      fresh.length === rows.length
        ? "fresh load"
        : "partial — existing ids preserved",
  });
}

async function seedRooms() {
  const key = "rooms";
  const rows = load("rooms.json", RoomSchema);

  if (await alreadySeeded(key)) {
    report.push({
      dataset: key,
      inserted: 0,
      skipped: rows.length,
      note: "marker present — skipped",
    });
    return;
  }

  const existing = new Set(
    (await prisma.room.findMany({ select: { id: true } })).map((r) => r.id),
  );
  const fresh = rows.filter((r) => !existing.has(r.id));

  let equipmentCount = 0;
  let bookingCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const r of fresh) {
      // dedupe equipment names: @@unique([room_id, name])
      const equipment = [...new Set(r.equipment)];
      equipmentCount += equipment.length;
      bookingCount += r.bookings.length;

      await tx.room.create({
        data: {
          id: r.id,
          room_number: r.room_number,
          type: r.type,
          capacity: r.capacity,
          floor: r.floor,
          status: r.status,
          equipment: { create: equipment.map((name) => ({ name })) },
          bookings: {
            create: r.bookings.map((b) => ({
              booking_id: b.booking_id,
              booked_by: b.booked_by,
              date: b.date,
              start_time: b.start_time,
              end_time: b.end_time,
              purpose: b.purpose,
            })),
          },
        },
      });
    }
    await tx.seedMarker.create({
      data: { key, source: "data/rooms.json", record_count: rows.length },
    });
  });

  report.push({
    dataset: key,
    inserted: fresh.length,
    skipped: rows.length - fresh.length,
    note: `+${equipmentCount} equipment, +${bookingCount} bookings`,
  });
}

async function seedEvents() {
  const key = "events";
  const rows = load("events.json", EventSchema);

  if (await alreadySeeded(key)) {
    report.push({
      dataset: key,
      inserted: 0,
      skipped: rows.length,
      note: "marker present — skipped",
    });
    return;
  }

  const existing = new Set(
    (await prisma.event.findMany({ select: { id: true } })).map((r) => r.id),
  );
  const fresh = rows.filter((r) => !existing.has(r.id));

  let regCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const e of fresh) {
      // dedupe by student_id: @@unique([event_id, student_id])
      const seen = new Set<string>();
      const regs = e.registrations.filter((r) => {
        if (seen.has(r.student_id)) return false;
        seen.add(r.student_id);
        return true;
      });
      regCount += regs.length;

      await tx.event.create({
        data: {
          id: e.id,
          name: e.name,
          description: e.description,
          date: e.date,
          start_time: e.start_time,
          end_time: e.end_time,
          end_date: e.end_date,
          venue: e.venue,
          organizer: e.organizer,
          capacity: e.capacity,
          // authoritative count from the file — never derived from `regs`
          registered: e.registered,
          status: e.status,
          registrations: {
            create: regs.map((r) => ({
              student_id: r.student_id,
              name: r.name,
            })),
          },
        },
      });
    }
    await tx.seedMarker.create({
      data: { key, source: "data/events.json", record_count: rows.length },
    });
  });

  report.push({
    dataset: key,
    inserted: fresh.length,
    skipped: rows.length - fresh.length,
    note: `+${regCount} registrations (rosters are partial by design)`,
  });
}

async function seedAnnouncements() {
  const key = "announcements";
  const rows = load("announcements.json", AnnouncementSchema);

  if (await alreadySeeded(key)) {
    report.push({
      dataset: key,
      inserted: 0,
      skipped: rows.length,
      note: "marker present — skipped",
    });
    return;
  }

  const existing = new Set(
    (await prisma.announcement.findMany({ select: { id: true } })).map(
      (r) => r.id,
    ),
  );
  const fresh = rows.filter((r) => !existing.has(r.id));

  await prisma.$transaction(async (tx) => {
    for (const r of fresh) await tx.announcement.create({ data: r });
    await tx.seedMarker.create({
      data: {
        key,
        source: "data/announcements.json",
        record_count: rows.length,
      },
    });
  });

  report.push({
    dataset: key,
    inserted: fresh.length,
    skipped: rows.length - fresh.length,
    note:
      fresh.length === rows.length
        ? "fresh load"
        : "partial — existing ids preserved",
  });
}

async function seedAssignments() {
  const key = "assignments";
  const rows = load("assignments.json", AssignmentSchema);

  if (await alreadySeeded(key)) {
    report.push({
      dataset: key,
      inserted: 0,
      skipped: rows.length,
      note: "marker present — skipped",
    });
    return;
  }

  const existing = new Set(
    (await prisma.assignment.findMany({ select: { id: true } })).map(
      (r) => r.id,
    ),
  );
  const fresh = rows.filter((r) => !existing.has(r.id));

  await prisma.$transaction(async (tx) => {
    for (const r of fresh) await tx.assignment.create({ data: r });
    await tx.seedMarker.create({
      data: { key, source: "data/assignments.json", record_count: rows.length },
    });
  });

  report.push({
    dataset: key,
    inserted: fresh.length,
    skipped: rows.length - fresh.length,
    note:
      fresh.length === rows.length
        ? "fresh load"
        : "partial — existing ids preserved",
  });
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

async function main() {
  console.log("CampusOS seed — reading data/ (read-only)\n");

  await seedSchedules();
  await seedRooms();
  await seedEvents();
  await seedAnnouncements();
  await seedAssignments();

  console.log("\ndataset          inserted  skipped  note");
  console.log(
    "---------------------------------------------------------------",
  );
  for (const r of report) {
    console.log(
      `${r.dataset.padEnd(16)}${String(r.inserted).padStart(8)}${String(
        r.skipped,
      ).padStart(9)}  ${r.note}`,
    );
  }

  const totals = {
    schedules: await prisma.schedule.count(),
    rooms: await prisma.room.count(),
    equipment: await prisma.roomEquipment.count(),
    bookings: await prisma.booking.count(),
    events: await prisma.event.count(),
    registrations: await prisma.registration.count(),
    announcements: await prisma.announcement.count(),
    assignments: await prisma.assignment.count(),
  };
  console.log("\nrows in database:", JSON.stringify(totals));
}

main()
  .catch((e) => {
    console.error("\nSeed failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
