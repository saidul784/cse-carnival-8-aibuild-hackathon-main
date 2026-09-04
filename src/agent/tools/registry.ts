/**
 * Tool registry and dispatcher.
 *
 * Agent tool -> service -> Prisma -> database. Nothing here reads seed JSON and
 * nothing memoises a result.
 *
 * Failures are returned to the model as structured tool results rather than
 * thrown. A refused booking or a full event is information the agent needs in
 * order to explain itself; an exception would just end the turn.
 */

import { z } from "zod";
import type { ArgSpec } from "./schemas";
import type { ToolDefinition } from "../providers";
import { type Actor, canUseTool, isWriteTool } from "../policy";
import { isAppError } from "@/server/lib/errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Tool<T = any> {
  name: string;
  description: string;
  args: ArgSpec<T>;
  write?: boolean;
  run: (args: T, actor: Actor) => Promise<unknown>;
}

import { readTools } from "./read.tools";
import { actionTools } from "./action.tools";

export const allTools: Tool[] = [...readTools, ...actionTools];

const byName = new Map(allTools.map((t) => [t.name, t]));

/** Tool definitions the current actor is permitted to see. */
export function toolDefinitions(actor: Actor): ToolDefinition[] {
  return allTools
    .filter((t) => canUseTool(actor, t.name).allowed)
    .map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.args.json,
    }));
}

export interface ToolOutcome {
  ok: boolean;
  name: string;
  /** What is sent back to the model. */
  result: unknown;
  /** Set when the call failed or was refused, for the UI trace. */
  errorCode?: string;
  durationMs: number;
  isWrite: boolean;
}

export async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
  actor: Actor,
): Promise<ToolOutcome> {
  const started = Date.now();
  const isWrite = isWriteTool(name);
  const done = (ok: boolean, result: unknown, errorCode?: string): ToolOutcome => ({
    ok,
    name,
    result,
    errorCode,
    durationMs: Date.now() - started,
    isWrite,
  });

  const tool = byName.get(name);
  if (!tool) {
    return done(false, { error: `No tool named "${name}" exists.` }, "UNKNOWN_TOOL");
  }

  const permission = canUseTool(actor, name);
  if (!permission.allowed) {
    return done(false, { refused: true, reason: permission.reason }, "FORBIDDEN");
  }

  const parsed = tool.args.zod.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return done(
      false,
      {
        error: "Invalid arguments for this tool.",
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          problem: i.message,
        })),
      },
      "VALIDATION_ERROR",
    );
  }

  try {
    const result = await tool.run(parsed.data, actor);
    // A tool may decline on ownership grounds without throwing.
    const refused =
      result && typeof result === "object" && "refused" in result;
    return done(!refused, result, refused ? "FORBIDDEN" : undefined);
  } catch (e) {
    if (isAppError(e)) {
      return done(
        false,
        { error: e.message, code: e.code, ...(e.details ? { details: e.details } : {}) },
        e.code,
      );
    }
    console.error(`[agent] tool ${name} failed:`, e);
    return done(
      false,
      { error: "That operation could not be completed." },
      "INTERNAL_ERROR",
    );
  }
}

export { z };
