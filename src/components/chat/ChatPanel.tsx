"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, TriangleAlert, RotateCcw } from "lucide-react";
import { MessageBubble, type ChatMessage } from "./MessageBubble";
import { Composer } from "./Composer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/common/Badge";
import { api, ApiError } from "@/lib/api-client";
import type { TraceEntry } from "./ToolCallTrace";

interface ChatStatus {
  ready: boolean;
  configured_providers: string[];
  active_provider: string | null;
  actor: { name: string; student_id: string; role: string };
}

interface AgentResponse {
  reply: string;
  trace: TraceEntry[];
  provider: string;
  model: string;
  rounds: number;
}

const SUGGESTIONS = [
  "When is my next class?",
  "What assignments do I have due this week?",
  "Show me all high priority announcements.",
  "Which labs have a projector and can fit at least 30 people?",
  "I'm free until 2 PM — is there anything on campus I could drop into?",
  "Book Room 7A02 tomorrow from 3 PM to 5 PM.",
];

let idCounter = 0;
const nextId = () => `m${idCounter++}`;

export function ChatPanel() {
  const qc = useQueryClient();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["chat", "status"],
    queryFn: () => api.get<ChatStatus>("/chat"),
  });

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setBusy(true);

    try {
      const res = await api.post<AgentResponse>("/chat", {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: res.reply, trace: res.trace },
      ]);

      // A write through the agent changes the same database the dashboard
      // reads, so drop every cached list.
      if (res.trace.some((t) => t.isWrite && t.ok)) {
        qc.invalidateQueries();
      }
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: message, error: true },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const notReady = status && !status.ready;

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-96 flex-col gap-3">
      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
        <Bot className="size-3.5 text-muted-foreground" />
        {statusLoading ? (
          <span className="text-muted-foreground">Checking assistant…</span>
        ) : notReady ? (
          <span className="text-destructive">No LLM provider configured</span>
        ) : (
          <>
            <span className="text-muted-foreground">Acting as</span>
            <Badge tone="info">
              {status?.actor.name} · {status?.actor.student_id}
            </Badge>
            {status?.active_provider ? (
              <Badge tone="neutral">{status.active_provider}</Badge>
            ) : null}
          </>
        )}
        {messages.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7"
            onClick={() => setMessages([])}
          >
            <RotateCcw className="size-3" /> New chat
          </Button>
        ) : null}
      </div>

      {notReady ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">The assistant needs an API key</p>
            <p className="mt-1 text-muted-foreground">
              Copy <code className="rounded bg-muted px-1">.env.example</code> to{" "}
              <code className="rounded bg-muted px-1">.env</code>, set one of{" "}
              <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code>,{" "}
              <code className="rounded bg-muted px-1">OPENAI_API_KEY</code>,{" "}
              <code className="rounded bg-muted px-1">GROQ_API_KEY</code> or{" "}
              <code className="rounded bg-muted px-1">GOOGLE_API_KEY</code>, then
              restart the server. The dashboard works without it.
            </p>
          </div>
        </div>
      ) : null}

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Bot className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Ask CampusOS anything</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Answers come from the live database — including changes made in
                the dashboard a moment ago.
              </p>
            </div>
            <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  disabled={notReady}
                  onClick={() => send(s)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {busy ? (
              <div className="flex items-center gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Bot className="size-3.5" />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Reading campus data…
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={() => send(input)}
        busy={busy}
        disabled={!!notReady}
      />
    </div>
  );
}
