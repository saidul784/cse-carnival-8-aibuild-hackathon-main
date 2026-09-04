/**
 * The agent loop.
 *
 *   user question
 *     -> LLM (real tool/function calling)
 *     -> tool
 *     -> service layer
 *     -> Prisma
 *     -> database
 *     -> tool result
 *     -> LLM
 *     -> final answer
 *
 * The loop is provider-independent: it speaks the neutral message format from
 * ./providers and never knows which vendor answered.
 */

import {
  type AgentMessage,
  type LLMProvider,
  ProviderConfigError,
  ProviderRequestError,
  getProvider,
} from "./providers";
import { buildSystemPrompt } from "./prompt";
import { type Actor, currentActor } from "./policy";
import { executeTool, toolDefinitions } from "./tools/registry";

/** Hard ceiling on tool rounds, so a confused model cannot spin. */
const MAX_ROUNDS = 6;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TraceEntry {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  errorCode?: string;
  isWrite: boolean;
  durationMs: number;
  /** Trimmed for transport; the full result still goes to the model. */
  resultPreview: string;
}

export interface AgentResult {
  reply: string;
  trace: TraceEntry[];
  provider: string;
  model: string;
  rounds: number;
  actor: { name: string; student_id: string; role: string };
}

export class AgentError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.status = status;
  }
}

function preview(value: unknown, max = 400): string {
  let s: string;
  try {
    s = JSON.stringify(value);
  } catch {
    s = String(value);
  }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function runAgent(history: ChatTurn[]): Promise<AgentResult> {
  const actor: Actor = currentActor();

  let provider: LLMProvider;
  try {
    provider = await getProvider();
  } catch (e) {
    if (e instanceof ProviderConfigError) {
      throw new AgentError("LLM_NOT_CONFIGURED", e.message, 503);
    }
    throw e;
  }

  const system = buildSystemPrompt(actor);
  const tools = toolDefinitions(actor);

  const messages: AgentMessage[] = history
    .filter((m) => m.content.trim().length > 0)
    .map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : { role: "assistant" as const, content: m.content },
    );

  if (messages.length === 0) {
    throw new AgentError("VALIDATION_ERROR", "No message to answer.", 400);
  }

  const trace: TraceEntry[] = [];
  let rounds = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    rounds = round + 1;

    let response;
    try {
      response = await provider.chat({ system, messages, tools });
    } catch (e) {
      if (e instanceof ProviderRequestError) {
        throw new AgentError("LLM_REQUEST_FAILED", e.message, 502);
      }
      throw e;
    }

    // No tool calls: this is the answer.
    if (response.toolCalls.length === 0) {
      return {
        reply:
          response.text?.trim() ||
          "I could not produce an answer for that. Could you rephrase?",
        trace,
        provider: provider.id,
        model: provider.model,
        rounds,
        actor,
      };
    }

    messages.push({
      role: "assistant",
      content: response.text,
      toolCalls: response.toolCalls,
    });

    for (const call of response.toolCalls) {
      const outcome = await executeTool(call.name, call.arguments, actor);

      trace.push({
        tool: call.name,
        args: call.arguments,
        ok: outcome.ok,
        errorCode: outcome.errorCode,
        isWrite: outcome.isWrite,
        durationMs: outcome.durationMs,
        resultPreview: preview(outcome.result),
      });

      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(outcome.result),
      });
    }
  }

  // Ran out of rounds. Report honestly rather than inventing a conclusion.
  return {
    reply:
      "I looked this up but could not settle on an answer within a reasonable number of steps. Could you narrow the question down?",
    trace,
    provider: provider.id,
    model: provider.model,
    rounds,
    actor,
  };
}
