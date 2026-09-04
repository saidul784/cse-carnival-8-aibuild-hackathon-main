/**
 * Chat endpoint.
 *
 * Runs entirely server-side: the LLM key is read from process.env here and
 * never reaches the browser. The client sends conversation turns and receives
 * an answer plus a tool trace.
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { handle, ok, readJson, fail, NO_STORE } from "@/server/lib/http";
import { AgentError, runAgent } from "@/agent";
import { configuredProviders } from "@/agent/providers";
import { currentActor } from "@/agent/policy";
import { AppError } from "@/server/lib/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1)
    .max(40),
});

/** Whether the assistant is usable, for the UI to show up front. */
export async function GET() {
  return handle(async () => {
    const providers = configuredProviders();
    const actor = currentActor();
    return ok({
      ready: providers.length > 0,
      configured_providers: providers,
      active_provider:
        (process.env.LLM_PROVIDER || "").trim().toLowerCase() || providers[0] || null,
      actor: { name: actor.name, student_id: actor.student_id, role: actor.role },
    });
  });
}

export async function POST(req: Request) {
  try {
    const parsed = BodySchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Send { messages: [{ role, content }] }.",
        parsed.error.issues,
      );
    }

    const result = await runAgent(parsed.data.messages);
    return ok(result);
  } catch (e) {
    // AgentError carries its own code and status (503 when no provider is
    // configured, 502 when the vendor call failed). Preserve both rather than
    // flattening them into the generic AppError set.
    if (e instanceof AgentError) {
      return NextResponse.json(
        { ok: false, error: { code: e.code, message: e.message } },
        { status: e.status, headers: NO_STORE },
      );
    }
    return fail(e);
  }
}
