"use client";

import * as React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageShell, FilterBar } from "@/components/layout/PageShell";
import { DataTable, type Column } from "@/components/common/DataTable";
import { RecordDialog, type FieldDef, type FormValues } from "@/components/common/RecordDialog";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useCrud } from "@/lib/use-crud";
import { formatTimeRange } from "@/lib/format";
import type { Schedule } from "@/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const FIELDS: FieldDef[] = [
  { name: "course", label: "Course code", type: "text", required: true, half: true, placeholder: "CSE 4113" },
  { name: "section", label: "Section", type: "text", required: true, half: true, placeholder: "B" },
  { name: "title", label: "Course title", type: "text", required: true },
  {
    name: "day", label: "Day", type: "select", required: true, half: true,
    options: DAYS.map((d) => ({ value: d, label: d })),
    help: "The university week runs Sunday–Thursday.",
  },
  { name: "room", label: "Room", type: "text", required: true, half: true, placeholder: "7A03" },
  { name: "start_time", label: "Start time", type: "time", required: true, half: true },
  { name: "end_time", label: "End time", type: "time", required: true, half: true },
  { name: "instructor", label: "Instructor", type: "text", required: true, placeholder: "TBA" },
];

export default function SchedulesPage() {
  const [day, setDay] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<Schedule | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Schedule | null>(null);

  const { list, create, update, remove } = useCrud<Schedule>(
    "schedules",
    { day, search },
    { singular: "Class" },
  );

  const columns: Column<Schedule>[] = [
    {
      key: "course",
      header: "Course",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium">{r.course}</p>
          <p className="truncate text-xs text-muted-foreground">{r.title}</p>
        </div>
      ),
    },
    { key: "day", header: "Day", cell: (r) => <Badge tone="info">{r.day}</Badge> },
    {
      key: "time",
      header: "Time",
      cell: (r) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatTimeRange(r.start_time, r.end_time)}
        </span>
      ),
    },
    { key: "room", header: "Room", cell: (r) => <Badge tone="outline">{r.room}</Badge> },
    {
      key: "section",
      header: "Section",
      hideOnMobile: true,
      cell: (r) => <span className="text-muted-foreground">{r.section}</span>,
    },
    {
      key: "instructor",
      header: "Instructor",
      hideOnMobile: true,
      cell: (r) => <span className="text-muted-foreground">{r.instructor}</span>,
    },
  ];

  const toValues = (s: Schedule): FormValues => ({
    course: s.course, title: s.title, day: s.day, start_time: s.start_time,
    end_time: s.end_time, room: s.room, instructor: s.instructor, section: s.section,
  });

  return (
    <PageShell
      title="Schedules"
      description="Class timetable across the Sunday–Thursday university week."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus /> Add class
        </Button>
      }
    >
      <FilterBar>
        <Select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="w-auto min-w-40"
          aria-label="Filter by day"
        >
          <option value="">All days</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search course, title, instructor or room…"
          className="w-auto min-w-56 flex-1"
        />
        {day || search ? (
          <Button variant="ghost" size="sm" onClick={() => { setDay(""); setSearch(""); }}>
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
        emptyTitle="No classes found"
        emptyDescription={
          day || search
            ? "No classes match these filters."
            : "Add the first class to the timetable."
        }
        emptyAction={<Button onClick={() => setCreating(true)}><Plus /> Add class</Button>}
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
        open={creating}
        onOpenChange={setCreating}
        title="Add class"
        description="Creates a new entry in the timetable."
        fields={FIELDS}
        submitLabel="Create class"
        onSubmit={(v) => create.mutateAsync(v)}
      />

      <RecordDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit class"
        description={editing ? `${editing.course} · ${editing.id}` : undefined}
        fields={FIELDS}
        initial={editing ? toValues(editing) : undefined}
        submitLabel="Save changes"
        onSubmit={(v) => update.mutateAsync({ id: editing!.id, body: v })}
      />

      <ConfirmDelete
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this class?"
        itemLabel={deleting ? `${deleting.course} — ${deleting.day} ${deleting.start_time}, Room ${deleting.room}` : ""}
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />
    </PageShell>
  );
}
