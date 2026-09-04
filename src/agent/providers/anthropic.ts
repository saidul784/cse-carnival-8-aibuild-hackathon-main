/** Anthropic Messages API. https://api.anthropic.com/v1/messages */

import {
  type ChatRequest,
  type LLMProvider,
  type LLMResponse,
  type ToolCall,
  postJson,
  ProviderRequestError,
} from "./index";

const URL = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic" as const;
  readonly model: string;
  #key: string;

  constructor(apiKey: string) {
    this.#key = apiKey;
    this.model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
  }

  async chat(req: ChatRequest): Promise<LLMResponse> {
    const body = {
      model: this.model,
      max_tokens: 2048,
      system: req.system,
      messages: toAnthropicMessages(req),
      tools: req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    };

    const json = (await postJson(this.id, URL, {
      "x-api-key": this.#key,
      "anthropic-version": VERSION,
    }, body)) as { content?: Block[]; stop_reason?: string };

    if (!Array.isArray(json.content)) {
      throw new ProviderRequestError(this.id, "Anthropic returned no content.");
    }

    let text: string | null = null;
    const toolCalls: ToolCall[] = [];

    for (const block of json.content) {
      if (block.type === "text") {
        text = (text ?? "") + block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input ?? {},
        });
      }
    }

    return { text, toolCalls };
  }
}

/**
 * Anthropic wants tool results as a `user` message of tool_result blocks, and
 * consecutive results must be merged into one message.
 */
function toAnthropicMessages(req: ChatRequest) {
  const out: { role: "user" | "assistant"; content: Block[] }[] = [];

  for (const m of req.messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: [{ type: "text", text: m.content }] });
      continue;
    }

    if (m.role === "assistant") {
      const blocks: Block[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      if (blocks.length) out.push({ role: "assistant", content: blocks });
      continue;
    }

    const block: Block = {
      type: "tool_result",
      tool_use_id: m.toolCallId,
      content: m.content,
    };
    const last = out[out.length - 1];
    if (last && last.role === "user" && last.content[0]?.type === "tool_result") {
      last.content.push(block);
    } else {
      out.push({ role: "user", content: [block] });
    }
  }

  return out;
}
