"use client";

import { PageShell } from "@/components/layout/PageShell";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default function ChatPage() {
  return (
    <PageShell
      title="AI Assistant"
      description="Ask about classes, rooms, events, notices and deadlines — every answer is read from the live database."
    >
      <ChatPanel />
    </PageShell>
  );
}
