"use client";

import * as React from "react";
import { ChevronRight, Database, PenLine, CircleAlert, ShieldBan } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TraceEntry {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  errorCode?: string;
  isWrite: boolean;
  durationMs: number;
  resultPreview: string;
}

/**
 * Shows the tool calls behind an answer.
 *
 * This is not decoration: it is the visible evidence that the assistant read
 * the live database rather than guessing, and that writes actually happened.
 */
export function ToolCallTrace({ trace }: { trace: TraceEntry[] }) {
  const [open, setOpen] = React.useState(false);
  if (trace.length === 0) return null;

  const writes = trace.filter((t) => t.isWrite && t.ok).length;
  const failures = trace.filter((t) => !t.ok).length;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        <Database className="size-3" />
        {trace.length} database {trace.length === 1 ? "lookup" : "lookups"}
        {writes > 0 ? ` · ${writes} change${writes === 1 ? "" : "s"}` : ""}
        {failures > 0 ? ` · ${failures} blocked` : ""}
      </button>

      {open ? (
        <ol className="mt-2 space-y-1.5 border-l border-border pl-3">
          {trace.map((t, i) => (
            <li key={i} className="text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {t.isWrite ? (
                  <PenLine className="size-3 text-amber-600" />
                ) : (
                  <Database className="size-3 text-muted-foreground" />
                )}
                <code className="rounded bg-muted px-1 py-0.5 font-medium">{t.tool}</code>
                {!t.ok ? (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    {t.errorCode === "FORBIDDEN" ? (
                      <ShieldBan className="size-3" />
                    ) : (
                      <CircleAlert className="size-3" />
                    )}
                    {t.errorCode ?? "failed"}
                  </span>
                ) : null}
                <span className="text-muted-foreground">{t.durationMs}ms</span>
              </div>
              {Object.keys(t.args).length > 0 ? (
                <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground">
                  {JSON.stringify(t.args)}
                </p>
              ) : null}
              <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground/70">
                → {t.resultPreview}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
