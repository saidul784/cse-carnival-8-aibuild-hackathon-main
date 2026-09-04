"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { PageShell, FilterBar } from "@/components/layout/PageShell";
import { RecordDialog, type FieldDef, type FormValues } from "@/components/common/RecordDialog";
import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { Badge, PriorityBadge } from "@/components/common/Badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/common/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useCrud } from "@/lib/use-crud";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Announcement } from "@/types";

const FIELDS: FieldDef[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "body", label: "Body", type: "textarea", required: true },
  {
    name: "priority", label: "Priority", type: "select", required: true, half: true,
    options: [
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
    ],
  },
  { name: "posted_by", label: "Posted by", type: "text", required: true, half: true },
  { name: "date", label: "Date posted", type: "date", half: true, help: "Defaults to today." },
  { name: "expires", label: "Expires", type: "date", required: true, half: true, help: "Stale after this date." },
];

const ACCENT: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-sky-500",
};

export default function AnnouncementsPage() {
  const [priority, setPriority] = React.useState("");
  const [activeOnly, setActiveOnly] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Announcement | null>(null);
  const [deleting, setDeleting] = React.useState<Announcement | null>(null);

  const { list, create, update, remove } = useCrud<Announcement>(
    "announcements",
    { priority, search, active_only: activeOnly ? "true" : "" },
    { singular: "Announcement" },
  );

  const toValues = (a: Announcement): FormValues => ({
    title: a.title, body: a.body, priority: a.priority,
    posted_by: a.posted_by, date: a.date, expires: a.expires,
  });

  return (
    <PageShell
      title="Announcements"
      description="Notice board, ordered by priority then recency."
      actions={<Button onClick={() => setCreating(true)}><Plus /> Post notice</Button>}
    >
      <FilterBar>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-auto min-w-40" aria-label="Filter by priority">
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notices…" className="w-auto min-w-56 flex-1"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox" checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          Active only
        </label>
        {priority || search || activeOnly ? (
          <Button variant="ghost" size="sm" onClick={() => { setPriority(""); setSearch(""); setActiveOnly(false); }}>
            Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {list.data ? `${list.data.length} shown` : null}
        </span>
      </FilterBar>

      {list.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="space-y-3 py-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </CardContent></Card>
          ))}
        </div>
      ) : list.error ? (
        <Card><ErrorState message={(list.error as Error).message} onRetry={() => list.refetch()} /></Card>
      ) : !list.data || list.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone className="size-5" />}
            title="No announcements"
            description={priority || search || activeOnly ? "No notices match these filters." : "Post the first notice to the board."}
            action={<Button onClick={() => setCreating(true)}><Plus /> Post notice</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.data.map((a) => (
            <Card key={a.id} className={cn("border-l-4", ACCENT[a.priority] ?? "border-l-border")}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold leading-snug">{a.title}</h3>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PriorityBadge priority={a.priority} />
                    {a.is_expired ? <Badge tone="neutral">Expired</Badge> : null}
                  </div>
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">{a.body}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {a.posted_by} · {formatDate(a.date)} · expires {formatDate(a.expires)}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(a)} aria-label="Edit">
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(a)} aria-label="Delete">
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RecordDialog
        open={creating} onOpenChange={setCreating}
        title="Post announcement" fields={FIELDS} submitLabel="Post notice"
        onSubmit={(v) => create.mutateAsync(v)}
      />

      <RecordDialog
        open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        title="Edit announcement" description={editing ? editing.id : undefined}
        fields={FIELDS} initial={editing ? toValues(editing) : undefined} submitLabel="Save changes"
        onSubmit={(v) => update.mutateAsync({ id: editing!.id, body: v })}
      />

      <ConfirmDelete
        open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this announcement?"
        itemLabel={deleting ? deleting.title : ""}
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />
    </PageShell>
  );
}
