"use client";

import * as React from "react";
import { SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  disabled,
  placeholder = "Ask about classes, rooms, events, notices or deadlines…",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // Grow with the content, capped so the transcript stays visible.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a line.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && !disabled && value.trim()) onSubmit();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && !disabled && value.trim()) onSubmit();
      }}
      className="flex items-end gap-2 rounded-xl border border-border bg-card p-2"
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground",
          disabled && "cursor-not-allowed opacity-60",
        )}
      />
      <Button
        type="submit"
        size="icon"
        disabled={busy || disabled || !value.trim()}
        aria-label="Send message"
      >
        {busy ? <Square className="size-3.5 animate-pulse" /> : <SendHorizontal />}
      </Button>
    </form>
  );
}
