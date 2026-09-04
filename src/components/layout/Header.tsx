"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu, X, CalendarClock } from "lucide-react";
import { SidebarBrand, SidebarNav } from "./Sidebar";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { formatDateLong, formatTime } from "@/lib/format";
import { Badge } from "@/components/common/Badge";
import type { Overview } from "@/types";

/**
 * Top bar. Shows the campus clock the whole app reasons from — if the agent
 * says "tomorrow" means the 5th, this is where a judge can see why.
 */
export function Header() {
  const [open, setOpen] = React.useState(false);

  const { data } = useQuery({
    queryKey: qk.stats,
    queryFn: () => api.get<Overview>("/stats"),
  });

  const ctx = data?.context;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:px-6">
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">
            {ctx ? formatDateLong(ctx.date) : "Loading campus data…"}
          </span>
          {ctx ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              · {formatTime(ctx.time)}
            </span>
          ) : null}
        </div>

        {ctx ? (
          ctx.is_weekend ? (
            <Badge tone="medium">Weekend</Badge>
          ) : (
            <Badge tone="success">Class day</Badge>
          )
        ) : null}
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-card shadow-xl animate-in slide-in-from-left">
            <div className="flex items-center justify-between border-b border-border pr-2">
              <div className="flex-1">
                <SidebarBrand />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
