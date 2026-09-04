/**
 * Assignments.
 *
 * Data source: Prisma only. Nothing here reads data/*.json.
 *
 * "Due this week" is resolved against the Sunday-Thursday academic week that
 * schema/schema.md defines, not a Monday-Sunday calendar week.
 */

import { z } from "zod";
import { db } from "../db";
import { invalid, notFound } from "../lib/errors";
import { nextSequentialId } from "../lib/ids";
import { academicWeek, assertISODate, resolveDate, todayISO } from "../lib/time";

const StatusEnum = z.enum(["pending", "submitted", "graded", "late"]);

export const AssignmentCreateSchema = z.object({
  course: z.string().min(1),
  course_title: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  assigned_date: z.string().optional(),
  deadline: z.string().min(1),
  submission_platform: z.string().min(1),
  status: StatusEnum.default("pending"),
  marks: z.coerce.number().int().nonnegative().default(0),
});
/**
 * Declared separately, not as `.partial()` of the create schema: Zod keeps
 * `.default()` through `.partial()`, which would reset `status` to "pending"
 * and `marks` to 0 on every edit. No defaults here.
 */
export const AssignmentUpdateSchema = z.object({
  course: z.string().min(1).optional(),
  course_title: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assigned_date: z.string().min(1).optional(),
  deadline: z.string().min(1).optional(),
  submission_platform: z.string().min(1).optional(),
  status: StatusEnum.optional(),
  marks: z.coerce.number().int().nonnegative().optional(),
});

export type AssignmentCreateInput = z.infer<typeof AssignmentCreateSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const r = schema.safeParse(input);
  if (!r.success) throw invalid(`Invalid ${what}.`, r.error.issues);
  return r.data;
}

type Row = {
  id: string;
  course: string;
  course_title: string;
  title: string;
  description: string;
  assigned_date: string;
  deadline: string;
  submission_platform: string;
  status: string;
  marks: number;
};

/**
 * Derived fields. `is_overdue` is computed, never stored: a pending assignment
 * silently becomes overdue as the clock passes its deadline, and storing it
 * would need a background job to stay truthful.
 */
function decorate<T extends Row>(row: T, today = todayISO()) {
  const outstanding = row.status === "pending" || row.status === "late";
  return {
    ...row,
    is_overdue: outstanding && row.deadline < today,
    is_due_today: outstanding && row.deadline === today,
    days_remaining: Math.round(
      (new Date(`${row.deadline}T00:00:00Z`).getTime() -
        new Date(`${today}T00:00:00Z`).getTime()) /
        86_400_000,
    ),
  };
}

export interface AssignmentFilters {
  status?: string;
  course?: string;
  due_from?: string;
  due_to?: string;
  search?: string;
  outstanding_only?: boolean;
}

export async function listAssignments(filters: AssignmentFilters = {}) {
  const today = todayISO();

  const rows = await db.assignment.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.course ? { course: { contains: filters.course } } : {}),
      ...(filters.outstanding_only
        ? { status: { in: ["pending", "late"] } }
        : {}),
      ...(filters.due_from || filters.due_to
        ? {
            deadline: {
              ...(filters.due_from
                ? { gte: assertISODate(filters.due_from) }
                : {}),
              ...(filters.due_to ? { lte: assertISODate(filters.due_to) } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search } },
              { description: { contains: filters.search } },
              { course: { contains: filters.search } },
              { course_title: { contains: filters.search } },
            ],
          }
        : {}),
    },
    orderBy: [{ deadline: "asc" }, { course: "asc" }],
  });

  return rows.map((r) => decorate(r, today));
}

export async function getAssignment(id: string) {
  const row = await db.assignment.findUnique({ where: { id } });
  if (!row) throw notFound("Assignment", id);
  return decorate(row);
}

export async function createAssignment(input: unknown) {
  const data = parse(AssignmentCreateSchema, input, "assignment");

  const assigned_date = data.assigned_date
    ? resolveDate(data.assigned_date)
    : todayISO();
  const deadline = resolveDate(data.deadline);

  if (deadline < assigned_date) {
    throw invalid(
      `deadline (${deadline}) cannot be before the assigned date (${assigned_date}).`,
    );
  }

  const ids = (await db.assignment.findMany({ select: { id: true } })).map(
    (a) => a.id,
  );

  const created = await db.assignment.create({
    data: {
      id: nextSequentialId("assignment", ids),
      course: data.course.trim(),
      course_title: data.course_title.trim(),
      title: data.title.trim(),
      description: data.description,
      assigned_date,
      deadline,
      submission_platform: data.submission_platform.trim(),
      status: data.status,
      marks: data.marks,
    },
  });
  return decorate(created);
}

export async function updateAssignment(id: string, input: unknown) {
  const current = await getAssignment(id);
  const patch = parse(AssignmentUpdateSchema, input, "assignment update");

  const assigned_date = patch.assigned_date
    ? resolveDate(patch.assigned_date)
    : current.assigned_date;
  const deadline = patch.deadline ? resolveDate(patch.deadline) : current.deadline;

  if (deadline < assigned_date) {
    throw invalid(
      `deadline (${deadline}) cannot be before the assigned date (${assigned_date}).`,
    );
  }

  const updated = await db.assignment.update({
    where: { id },
    data: {
      ...(patch.course === undefined ? {} : { course: patch.course.trim() }),
      ...(patch.course_title === undefined
        ? {}
        : { course_title: patch.course_title.trim() }),
      ...(patch.title === undefined ? {} : { title: patch.title.trim() }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description }),
      assigned_date,
      deadline,
      ...(patch.submission_platform === undefined
        ? {}
        : { submission_platform: patch.submission_platform.trim() }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.marks === undefined ? {} : { marks: patch.marks }),
    },
  });
  return decorate(updated);
}

export async function deleteAssignment(id: string) {
  await getAssignment(id);
  await db.assignment.delete({ where: { id } });
  return { id, deleted: true };
}

/** Explicit status transition, used by the dashboard's submit action. */
export async function setAssignmentStatus(id: string, status: string) {
  const parsed = StatusEnum.safeParse(status);
  if (!parsed.success) {
    throw invalid(
      `status must be one of pending, submitted, graded, late — got "${status}".`,
    );
  }
  await getAssignment(id);
  const updated = await db.assignment.update({
    where: { id },
    data: { status: parsed.data },
  });
  return decorate(updated);
}

/**
 * Assignments due in the current academic week.
 * Returns the window it used so the agent can state it rather than imply it.
 */
export async function getAssignmentsDueThisWeek(from = todayISO()) {
  const week = academicWeek(from);
  const assignments = await listAssignments({
    due_from: week.start,
    due_to: week.end,
  });
  return { window: week, count: assignments.length, assignments };
}

/** Everything still outstanding with a deadline in the past. */
export async function getOverdueAssignments(from = todayISO()) {
  const rows = await listAssignments({ outstanding_only: true, due_to: from });
  return rows.filter((r) => r.deadline < from);
}

export async function countAssignments() {
  return db.assignment.count();
}
