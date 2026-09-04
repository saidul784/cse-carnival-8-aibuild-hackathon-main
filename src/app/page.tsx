"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  DoorOpen,
  PartyPopper,
  Megaphone,
  ClipboardList,
  ArrowRight,
  Clock,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import { PageShell, SectionTitle } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PriorityBadge, AssignmentStatusBadge } from "@/components/common/Badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/common/EmptyState";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { formatDate, formatTimeRange, relativeDays, pluralise } from "@/lib/format";
import type { Overview } from "@/types";

const TILES = [
  { key: "schedules", label: "Classes", href: "/schedules", icon: CalendarDays },
  { key: "rooms", label: "Rooms", href: "/rooms", icon: DoorOpen },
  { key: "events", label: "Events", href: "/events", icon: PartyPopper },
  { key: "announcements", label: "Announcements", href: "/announcements", icon: Megaphone },
  { key: "assignments", label: "Assignments", href: "/assignments", icon: ClipboardList },
] as const;

export default function OverviewPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.stats,
    queryFn: () => api.get<Overview>("/stats"),
  });

  if (error) {
    return (
      <PageShell title="Overview">
        <Card>
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Overview"
      description={
        data
          ? `Live campus data · academic week ${data.context.academic_week.label}`
          : "Loading live campus data…"
      }
    >
      {/* Count tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TILES.map(({ key, label, href, icon: Icon }) => (
          <Link key={key} href={href} className="group">
            <Card className="transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center justify-between gap-2 py-4">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {label}
                  </p>
                  {isLoading || !data ? (
                    <Skeleton className="mt-1.5 h-7 w-10" />
                  ) : (
                    <p className="text-2xl font-semibold tabular-nums">
                      {data.counts[key]}
                    </p>
                  )}
                </div>
                <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Next class */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Next class</CardTitle>
              <Link
                href="/schedules"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Timetable <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading || !data ? (
                <Skeleton className="h-16 w-full" />
              ) : data.next_class ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {data.next_class.schedule.course}
                      </span>
                      <Badge tone="outline">
                        Section {data.next_class.schedule.section}
                      </Badge>
                      {data.next_class.is_today ? (
                        <Badge tone="success">Today</Badge>
                      ) : (
                        <Badge tone="info">
                          {data.next_class.day}, {formatDate(data.next_class.date)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {data.next_class.schedule.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {formatTimeRange(
                          data.next_class.schedule.start_time,
                          data.next_class.schedule.end_time,
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        Room {data.next_class.schedule.room}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  className="py-6"
                  title="No upcoming classes"
                  description="Nothing scheduled in the next two weeks."
                />
              )}
            </CardContent>
          </Card>

          {/* Due this week */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Due this week</CardTitle>
                {data ? (
                  <p className="text-xs text-muted-foreground">
                    {data.assignments.due_this_week.window.label}
                  </p>
                ) : null}
              </div>
              <Link
                href="/assignments"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                All <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading || !data ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : data.assignments.due_this_week.assignments.length === 0 ? (
                <EmptyState
                  className="py-8"
                  title="Nothing due this week"
                  description="No deadlines fall inside the current academic week."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {data.assignments.due_this_week.assignments.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.course} · {formatDate(a.deadline)} ·{" "}
                          {relativeDays(a.days_remaining)}
                        </p>
                      </div>
                      <AssignmentStatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Today */}
          <Card>
            <CardHeader>
              <CardTitle>
                Today{data ? ` · ${data.today.day}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !data ? (
                <Skeleton className="h-12 w-full" />
              ) : data.today.is_weekend ? (
                <p className="text-sm text-muted-foreground">
                  It&apos;s the weekend — the university week runs Sunday to
                  Thursday. {data.today.events.length === 0
                    ? "No events on campus today."
                    : null}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>Classes</SectionTitle>
                    {data.today.classes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No classes scheduled.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {data.today.classes.map((c) => (
                          <li key={c.id} className="text-sm">
                            <span className="font-medium">{c.course}</span>{" "}
                            <span className="text-muted-foreground">
                              {formatTimeRange(c.start_time, c.end_time)} · {c.room}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <SectionTitle>Events</SectionTitle>
                    {data.today.events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nothing on campus today.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {data.today.events.map((e) => (
                          <li key={e.id} className="text-sm">
                            <span className="font-medium">{e.name}</span>{" "}
                            <span className="text-muted-foreground">
                              {formatTimeRange(e.start_time, e.end_time)} · {e.venue}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Overdue warning */}
          {data && data.assignments.overdue_count > 0 ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-start gap-3 py-4">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    {pluralise(data.assignments.overdue_count, "assignment")} overdue
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.assignments.overdue
                      .slice(0, 3)
                      .map((a) => a.course)
                      .join(", ")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* High priority notices */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>High priority</CardTitle>
              <Link
                href="/announcements"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                All <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading || !data ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : data.announcements.high_priority_active.length === 0 ? (
                <EmptyState className="py-8" title="No high priority notices" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.announcements.high_priority_active.map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{a.title}</p>
                        <PriorityBadge priority={a.priority} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {a.body}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {a.posted_by} · {formatDate(a.date)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Rooms today */}
          <Card>
            <CardHeader>
              <CardTitle>Rooms today</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !data ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-semibold tabular-nums text-emerald-600">
                      {data.rooms.free_today}
                    </p>
                    <p className="text-xs text-muted-foreground">Free</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold tabular-nums">
                      {data.rooms.booked_today}
                    </p>
                    <p className="text-xs text-muted-foreground">Booked</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold tabular-nums">
                      {data.rooms.total}
                    </p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming events */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Upcoming events</CardTitle>
              <Link
                href="/events"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                All <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading || !data ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : data.events.upcoming.length === 0 ? (
                <EmptyState className="py-8" title="No upcoming events" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.events.upcoming.map((e) => (
                    <li key={e.id} className="px-5 py-3">
                      <p className="text-sm font-medium leading-snug">{e.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(e.date)} · {e.venue} · {e.registered}/
                        {e.capacity} registered
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
