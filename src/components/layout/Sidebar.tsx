"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  DoorOpen,
  PartyPopper,
  Megaphone,
  ClipboardList,
  Bot,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/schedules", label: "Schedules", icon: CalendarDays },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/events", label: "Events", icon: PartyPopper },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/chat", label: "AI Assistant", icon: Bot },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 border-b border-border px-5 py-4"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <GraduationCap className="size-4" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">CampusOS</p>
        <p className="text-[11px] text-muted-foreground">AUST · CSE</p>
      </div>
    </Link>
  );
}

/** Fixed sidebar, desktop only. The mobile equivalent lives in Header. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-card lg:flex">
      <SidebarBrand />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
      <div className="border-t border-border px-5 py-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Live campus data. Every change is saved to the backend.
        </p>
      </div>
    </aside>
  );
}
