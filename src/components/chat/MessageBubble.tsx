"use client";

import * as React from "react";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolCallTrace, type TraceEntry } from "./ToolCallTrace";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  trace?: TraceEntry[];
  error?: boolean;
}

/** Minimal markdown: paragraphs, bullets and **bold**. */
function renderContent(text: string) {
  const blocks = text.split(/\n{2,}/);

  return blocks.map((block, bi) => {
    const lines = block.split("\n");
    const isList = lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l));

    if (isList) {
      return (
        <ul key={bi} className="my-1.5 list-disc space-y-1 pl-5">
          {lines.map((l, li) => (
            <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={bi} className="my-1.5 first:mt-0 last:mb-0">
        {lines.map((l, li) => (
          <React.Fragment key={li}>
            {li > 0 ? <br /> : null}
            {inline(l)}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      <div className={cn("min-w-0 max-w-[85%]", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : message.error
                ? "border border-destructive/40 bg-destructive/10 text-foreground"
                : "border border-border bg-card",
          )}
        >
          {renderContent(message.content)}
        </div>

        {!isUser && message.trace?.length ? (
          <ToolCallTrace trace={message.trace} />
        ) : null}
      </div>
    </div>
  );
}
