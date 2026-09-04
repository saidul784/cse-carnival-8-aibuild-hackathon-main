"use client";

import * as React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageShell, FilterBar } from "@/components/layout/PageShell";
import { DataTable, type Column } from "@/components/common/DataTable";
import { RecordDialog, type FieldDef, type FormValues } from "@/components/common/RecordDialog";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Badge, AssignmentStatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useCrud } from "@/lib/use-crud";
import { formatDate, relativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/types";

const STATUSES = ["pending", "submitted", "graded", "late"];

const FIELDS: FieldDef[] = [
  { name: "course", label: "Course code", type: "text", required: true, half: true, placeholder: "CSE 4113" },
  { name: "course_title", label: "Course title", type: "text", required: true, half: true },
  { name: "title", label: "Assignment title", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "assigned_date", label: "Assigned", type: "date", half: true, help: "Defaults to today." },
  { name: "deadline", label: "Deadline", type: "date", required: true, half: true },
  { name: "submission_platform", label: "Submit via", type: "text", required: true, half: true, placeholder: "Google Classroom" },
  { name: "marks", label: "Marks", type: "number", half: true },
  {
    name: "status", label: "Status", type: "select", half: true,
    options: STATUSES.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) })),
  },
];

export default function AssignmentsPage() {
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [outstanding, setOutstanding] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Assignment | null>(null);
  const [deleting, setDeleting] = React.useState<Assignment | null>(null);

  const { list, create, update, remove } = useCrud<Assignment>(
    "assignments",
    { status, search, outstanding_only: outstanding ? "true" : "" },
    { singular: "Assignment" },
  );

  const columns: Column<Assignment>[] = [
    {
      key: "title",
      header: "Assignment",
      cell: (r) => (
        <div className="min-w-0 max-w-sm">
          <p className="font-medium leading-snug">{r.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.course} · {r.course_title}
          </p>
        </div>
      ),
    },
    {
      key: "deadline",
      header: "Deadline",
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className="text-sm">{formatDate(r.deadline)}</p>
          <p
            className={cn(
              "text-xs",
              r.is_overdue
                ? "font-medium text-destructive"
                : r.is_due_today
                  ? "font-medium text-amber-600"
                  : "text-muted-foreground",
            )}
          >
            {r.status === "submitted" || r.status === "graded"
              ? "—"
              : relativeDays(r.days_remaining)}
          </p>
        </div>
      ),
    },
    {
      key: "platform",
      header: "Submit via",
      hideOnMobile: true,
      cell: (r) => <span className="text-sm text-muted-foreground">{r.submission_platform}</span>,
    },
    {
      key: "marks",
      header: "Marks",
      hideOnMobile: true,
      cell: (r) => <span className="tabular-nums">{r.marks}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <AssignmentStatusBadge status={r.status} />
          {r.is_overdue ? <Badge tone="high">Overdue</Badge> : null}
        </div>
      ),
    },
  ];

  const toValues = (a: Assignment): FormValues => ({
    course: a.course, course_title: a.course_title, title: a.title,
    description: a.description, assigned_date: a.assigned_date, deadline: a.deadline,
    submission_platform: a.submission_platform, marks: String(a.marks), status: a.status,
  });

  return (
    <PageShell
      title="Assignments"
      description="Coursework deadlines and submission status."
      actions={<Button onClick={() => setCreating(true)}><Plus /> Add assignment</Button>}
    >
      <FilterBar>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-40" aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
        <Input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assignments…" className="w-auto min-w-56 flex-1"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox" checked={outstanding}
            onChange={(e) => setOutstanding(e.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          Outstanding only
        </label>
        {status || search || outstanding ? (
          <Button variant="ghost" size="sm" onClick={() => { setStatus(""); setSearch(""); setOutstanding(false); }}>
            Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {list.data ? `${list.data.length} shown` : null}
        </span>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(r) => r.id}
        isLoading={list.isLoading}
        error={list.error as Error | null}
        onRetry={() => list.refetch()}
        emptyTitle="No assignments found"
        emptyDescription="No assignments match these filters."
        emptyAction={<Button onClick={() => setCreating(true)}><Plus /> Add assignment</Button>}
        actions={(r) => (
          <>
            <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="Edit">
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleting(r)} aria-label="Delete">
              <Trash2 className="text-destructive" />
            </Button>
          </>
        )}
      />

      <RecordDialog
        open={creating} onOpenChange={setCreating}
        title="Add assignment" fields={FIELDS} submitLabel="Create assignment"
        onSubmit={(v) => create.mutateAsync(v)}
      />

      <RecordDialog
        open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        title="Edit assignment" description={editing ? editing.id : undefined}
        fields={FIELDS} initial={editing ? toValues(editing) : undefined} submitLabel="Save changes"
        onSubmit={(v) => update.mutateAsync({ id: editing!.id, body: v })}
      />

      <ConfirmDelete
        open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this assignment?"
        itemLabel={deleting ? `${deleting.course} — ${deleting.title}` : ""}
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />
    </PageShell>
  );
}
