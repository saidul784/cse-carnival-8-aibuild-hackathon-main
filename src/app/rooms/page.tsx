"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, CalendarPlus, Loader2, X } from "lucide-react";
import { PageShell, FilterBar } from "@/components/layout/PageShell";
import { DataTable, type Column } from "@/components/common/DataTable";
import { RecordDialog, type FieldDef, type FormValues } from "@/components/common/RecordDialog";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Badge, RoomTypeBadge } from "@/components/common/Badge";
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
import type { Room } from "@/types";

const EQUIPMENT = [
  "projector", "whiteboard", "AC", "computers",
  "smart board", "microphone", "podium", "document camera",
];

const FIELDS: FieldDef[] = [
  { name: "room_number", label: "Room number", type: "text", required: true, half: true, placeholder: "7A03" },
  {
    name: "type", label: "Type", type: "select", required: true, half: true,
    options: [
      { value: "classroom", label: "Classroom" },
      { value: "lab", label: "Lab" },
      { value: "seminar", label: "Seminar hall" },
    ],
  },
  { name: "capacity", label: "Capacity", type: "number", required: true, half: true },
  { name: "floor", label: "Floor", type: "number", required: true, half: true },
  {
    name: "status", label: "Status", type: "select", half: true,
    options: [
      { value: "available", label: "Available" },
      { value: "unavailable", label: "Unavailable" },
    ],
  },
  {
    name: "equipment", label: "Equipment", type: "tags",
    placeholder: "projector, whiteboard, AC",
    help: `Comma separated. Known values: ${EQUIPMENT.join(", ")}.`,
  },
];

export default function RoomsPage() {
  const [type, setType] = React.useState("");
  const [minCapacity, setMinCapacity] = React.useState("");
  const [equipment, setEquipment] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Room | null>(null);
  const [deleting, setDeleting] = React.useState<Room | null>(null);
  const [bookingRoom, setBookingRoom] = React.useState<Room | null>(null);

  const { list, create, update, remove } = useCrud<Room>(
    "rooms",
    { type, min_capacity: minCapacity, equipment },
    { singular: "Room" },
  );

  const columns: Column<Room>[] = [
    {
      key: "room_number",
      header: "Room",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.room_number}</p>
          <p className="text-xs text-muted-foreground">Floor {r.floor}</p>
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (r) => <RoomTypeBadge type={r.type} /> },
    {
      key: "capacity",
      header: "Capacity",
      cell: (r) => <span className="tabular-nums">{r.capacity}</span>,
    },
    {
      key: "equipment",
      header: "Equipment",
      hideOnMobile: true,
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.equipment.map((e) => (
            <Badge key={e} tone="neutral">{e}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "bookings",
      header: "Bookings",
      cell: (r) => (
        <button
          onClick={() => setBookingRoom(r)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {r.bookings.length}
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) =>
        r.status === "available" ? (
          <Badge tone="success">Available</Badge>
        ) : (
          <Badge tone="high">Unavailable</Badge>
        ),
    },
  ];

  const toValues = (r: Room): FormValues => ({
    room_number: r.room_number, type: r.type, capacity: String(r.capacity),
    floor: String(r.floor), status: r.status, equipment: r.equipment.join(", "),
  });

  return (
    <PageShell
      title="Rooms"
      description="Classrooms, labs and seminar halls, with equipment and bookings."
      actions={<Button onClick={() => setCreating(true)}><Plus /> Add room</Button>}
    >
      <FilterBar>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto min-w-36" aria-label="Filter by type">
          <option value="">All types</option>
          <option value="classroom">Classroom</option>
          <option value="lab">Lab</option>
          <option value="seminar">Seminar</option>
        </Select>
        <Input
          type="number" value={minCapacity} onChange={(e) => setMinCapacity(e.target.value)}
          placeholder="Min capacity" className="w-36" aria-label="Minimum capacity"
        />
        <Select value={equipment} onChange={(e) => setEquipment(e.target.value)} className="w-auto min-w-44" aria-label="Filter by equipment">
          <option value="">Any equipment</option>
          {EQUIPMENT.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
        {type || minCapacity || equipment ? (
          <Button variant="ghost" size="sm" onClick={() => { setType(""); setMinCapacity(""); setEquipment(""); }}>
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
        emptyTitle="No rooms found"
        emptyDescription="No rooms match these filters."
        actions={(r) => (
          <>
            <Button variant="ghost" size="icon" onClick={() => setBookingRoom(r)} aria-label="Bookings">
              <CalendarPlus />
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
        title="Add room" fields={FIELDS} submitLabel="Create room"
        onSubmit={(v) => create.mutateAsync(v)}
      />

      <RecordDialog
        open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        title="Edit room" description={editing ? `${editing.room_number} · ${editing.id}` : undefined}
        fields={FIELDS} initial={editing ? toValues(editing) : undefined} submitLabel="Save changes"
        onSubmit={(v) => update.mutateAsync({ id: editing!.id, body: v })}
      />

      <ConfirmDelete
        open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this room?"
        description="The room and all of its bookings are permanently removed."
        itemLabel={deleting ? `Room ${deleting.room_number} — ${deleting.type}, capacity ${deleting.capacity}` : ""}
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />

      <BookingsDialog room={bookingRoom} onClose={() => setBookingRoom(null)} />
    </PageShell>
  );
}

/** Bookings for one room: list, cancel, and create with conflict feedback. */
function BookingsDialog({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidateAll();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    booked_by: "", date: "", start_time: "", end_time: "", purpose: "",
  });

  React.useEffect(() => {
    if (room) {
      setForm({ booked_by: "", date: "", start_time: "", end_time: "", purpose: "" });
      setError(null);
    }
  }, [room]);

  if (!room) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/rooms/${room!.id}/bookings`, form);
      invalidate();
      toast.success("Room booked", `${room!.room_number} on ${form.date}`);
      setForm({ booked_by: "", date: "", start_time: "", end_time: "", purpose: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the booking.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(bookingId: string) {
    try {
      await api.del(`/rooms/${room!.id}/bookings/${bookingId}`);
      invalidate();
      toast.success("Booking cancelled");
    } catch (err) {
      toast.error("Could not cancel", err instanceof Error ? err.message : "");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bookings · Room {room.room_number}</DialogTitle>
          <DialogDescription>
            {room.type} · capacity {room.capacity} · {room.equipment.join(", ")}
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Current bookings
          </p>
          {room.bookings.length === 0 ? (
            <EmptyState className="py-6" title="No bookings" description="This room is free." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {room.bookings.map((b) => (
                <li key={b.booking_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formatDate(b.date)} · {formatTimeRange(b.start_time, b.end_time)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.booked_by}{b.purpose ? ` — ${b.purpose}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => cancel(b.booking_id)} aria-label="Cancel booking">
                    <X className="text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            New booking
          </p>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="booked_by">Booked by</Label>
              <Input id="booked_by" required value={form.booked_by}
                onChange={(e) => setForm({ ...form, booked_by: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" required value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purpose">Purpose</Label>
              <Input id="purpose" value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Start</Label>
              <Input id="start_time" type="time" required value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">End</Label>
              <Input id="end_time" type="time" required value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
              Book room
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
