import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { capitalise } from "@/lib/format";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        high: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300",
        medium:
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300",
        low: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-300",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300",
        info: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* ---- Domain-specific badges, so colour meaning stays consistent ---- */

const PRIORITY_TONE = { high: "high", medium: "medium", low: "low" } as const;

export function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    PRIORITY_TONE[priority as keyof typeof PRIORITY_TONE] ?? "neutral";
  return <Badge tone={tone}>{capitalise(priority)}</Badge>;
}

const ASSIGNMENT_TONE: Record<string, BadgeProps["tone"]> = {
  pending: "medium",
  submitted: "success",
  graded: "info",
  late: "high",
};

export function AssignmentStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={ASSIGNMENT_TONE[status] ?? "neutral"}>{capitalise(status)}</Badge>
  );
}

const EVENT_TONE: Record<string, BadgeProps["tone"]> = {
  upcoming: "info",
  ongoing: "success",
  completed: "neutral",
  cancelled: "high",
  full: "medium",
};

export function EventStatusBadge({ status }: { status: string }) {
  return <Badge tone={EVENT_TONE[status] ?? "neutral"}>{capitalise(status)}</Badge>;
}

const ROOM_TYPE_TONE: Record<string, BadgeProps["tone"]> = {
  classroom: "info",
  lab: "success",
  seminar: "medium",
};

export function RoomTypeBadge({ type }: { type: string }) {
  return <Badge tone={ROOM_TYPE_TONE[type] ?? "neutral"}>{capitalise(type)}</Badge>;
}
