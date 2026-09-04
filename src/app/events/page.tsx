"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Users, Loader2, X } from "lucide-react";
import { PageShell, FilterBar } from "@/components/layout/PageShell";
import { DataTable, type Column } from "@/components/common/DataTable";
import { RecordDialog, type FieldDef, type FormValues } from "@/components/common/RecordDialog";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { EventStatusBadge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/common/Toast";
import { useCrud, useInvalidateAll } from "@/lib/use-crud";
import { api } from "@/lib/api-client";
import { formatDate, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CampusEvent } from "@/types";

const FIELDS: FieldDef[] = [
  { name: "name", label: "Event name", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "date", label: "Start date", type: "date", required: true, half: true },
  { name: "end_date", label: "End date", type: "date", half: true, help: "Same as start for single-day events." },
  { name: "start_time", label: "Start time", type: "time", required: true, half: true },
  { name: "end_time", label: "End time", type: "time", required: true, half: true },
  { name: "venue", label: "Venue", type: "text", required: true, half: true, placeholder: "7C01" },
  { name: "organizer", label: "Organizer", type: "text", required: true, half: true },
  { name: "capacity", label: "Capacity", type: "number", required: true, half: true },
  {
    name: "status", label: "Status", type: "select", half: true,
    options: ["upcoming", "ongoing", "completed", "cancelled", "full"].map((s) => ({
      value: s, label: s[0]!.toUpperCase() + s.slice(1),
    })),
  },
];

export default function EventsPage() {
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<CampusEvent | null>(null);
  const [deleting, setDeleting] = React.useState<CampusEvent | null>(null);
  const [managing, setManaging] = React.useState<CampusEvent | null>(null);

  const { list, create, update, remove } = useCrud<CampusEvent>(
    "events", { status, search }, { singular: "Event" },
  );

  // Keep the open registrations dialog in step with refetched data.
  const managed = managing
    ? (list.data?.find((e) => e.id === managing.id) ?? managing)
    : null;

  const columns: Column<CampusEvent>[] = [
    {
      key: "name",
      header: "Event",
      cell: (r) => (
        <div className="min-w-0 max-w-xs">
          <p className="font-medium leading-snug">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.organizer}</p>
        </div>
      ),
    },
    {
      key: "when",
      header: "When",
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className="text-sm">{formatDate(r.date)}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {formatTimeRange(r.start_time, r.end_time)}
          </p>
        </div>
      ),
    },
    { key: "venue", header: "Venue", hideOnMobile: true, cell: (r) => r.venue },
    {
      key: "registered",
      header: "Registered",
      cell: (r) => {
        const pct = r.capacity ? Math.min(100, (r.registered / r.capacity) * 100) : 0;
        return (
          <button onClick={() => setManaging(r)} className="w-28 text-left">
            <p className="text-sm font-medium tabular-nums">
              {r.registered}/{r.capacity}
            </p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        );
      },
    },
    { key: "status", header: "Status", cell: (r) => <EventStatusBadge status={r.status} /> },
  ];

  const toValues = (e: CampusEvent): FormValues => ({
    name: e.name, description: e.description, date: e.date, end_date: e.end_date,
    start_time: e.start_time, end_time: e.end_time, venue: e.venue,
    organizer: e.organizer, capacity: String(e.capacity), status: e.status,
  });

  return (
    <PageShell
      title="Events"
      description="Campus events with live registration counts."
      actions={<Button onClick={() => setCreating(true)}><Plus /> Add event</Button>}
    >
      <FilterBar>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-40" aria-label="Filter by status">
          <option value="">All statuses</option>
          {["upcoming", "ongoing", "completed", "cancelled", "full"].map((s) => (
            <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
        <Input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events…" className="w-auto min-w-56 flex-1"
        />
        {status || search ? (
          <Button variant="ghost" size="sm" onClick={() => { setStatus(""); setSearch(""); }}>Clear</Button>
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
        emptyTitle="No events found"
        emptyDescription="No events match these filters."
        actions={(r) => (
          <>
            <Button variant="ghost" size="icon" onClick={() => setManaging(r)} aria-label="Registrations">
              <Users />
            </Button>
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
        title="Add event" fields={FIELDS} submitLabel="Create event"
        onSubmit={(v) => create.mutateAsync(v)}
      />

      <RecordDialog
        open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        title="Edit event" description={editing ? editing.id : undefined}
        fields={FIELDS} initial={editing ? toValues(editing) : undefined} submitLabel="Save changes"
        onSubmit={(v) => update.mutateAsync({ id: editing!.id, body: v })}
      />

      <ConfirmDelete
        open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this event?"
        description="The event and all of its registrations are permanently removed."
        itemLabel={deleting ? `${deleting.name} — ${formatDate(deleting.date)}` : ""}
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />

      <RegistrationsDialog event={managed} onClose={() => setManaging(null)} />
    </PageShell>
  );
}

/**
 * Registrations for one event.
 *
 * The roster is a partial list by design — seed events carry a `registered`
 * count far larger than the names recorded — so the header shows both numbers
 * rather than implying the list is everyone.
 */
function RegistrationsDialog({
  event, onClose,
}: { event: CampusEvent | null; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidateAll();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ student_id: "", name: "" });

  React.useEffect(() => {
    if (event) { setForm({ student_id: "", name: "" }); setError(null); }
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!event) return null;
  const isFull = event.registered >= event.capacity;

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post(`/events/${event!.id}/registrations`, form);
      invalidate();
      toast.success("Registered", `${form.name} for ${event!.name}`);
      setForm({ student_id: "", name: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register.");
    } finally { setBusy(false); }
  }

  async function cancel(studentId: string) {
    try {
      await api.del(`/events/${event!.id}/registrations/${encodeURIComponent(studentId)}`);
      invalidate();
      toast.success("Registration cancelled");
    } catch (err) {
      toast.error("Could not cancel", err instanceof Error ? err.message : "");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrations · {event.name}</DialogTitle>
          <DialogDescription>
            {event.registered} of {event.capacity} places taken
            {event.registrations.length !== event.registered
              ? ` · ${event.registrations.length} names on record`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Roster
          </p>
          {event.registrations.length === 0 ? (
            <EmptyState className="py-6" title="No names recorded" description="No individual registrations are stored for this event yet." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {event.registrations.map((r) => (
                <li key={r.student_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{r.student_id}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => cancel(r.student_id)} aria-label="Cancel registration">
                    <X className="text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={register} className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Register a student
          </p>
          {isFull ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              This event is full ({event.registered}/{event.capacity}). New registrations will be rejected.
            </div>
          ) : null}
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="student_id">Student ID</Label>
              <Input id="student_id" required placeholder="20-40532" value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="student_name">Name</Label>
              <Input id="student_name" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Users />}
              Register
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
