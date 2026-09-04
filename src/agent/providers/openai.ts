/** OpenAI Chat Completions API. */

import {
  type ChatRequest,
  type LLMProvider,
  type LLMResponse,
  type ProviderId,
  type ToolCall,
  postJson,
  ProviderRequestError,
} from "./index";

export interface OpenAICompatibleOptions {
  id: ProviderId;
  url: string;
  model: string;
  apiKey: string;
}

interface ChatCompletion {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: {
        id: string;
        function: { name: string; arguments: string };
      }[];
    };
  }[];
}

/**
 * Shared implementation for every OpenAI-compatible endpoint. Groq exposes the
 * same wire format, so it reuses this rather than duplicating the mapping.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: ProviderId;
  readonly model: string;
  #key: string;
  #url: string;

  constructor(opts: OpenAICompatibleOptions) {
    this.id = opts.id;
    this.model = opts.model;
    this.#key = opts.apiKey;
    this.#url = opts.url;
  }

  async chat(req: ChatRequest): Promise<LLMResponse> {
    const messages: Record<string, unknown>[] = [
      { role: "system", content: req.system },
    ];

    for (const m of req.messages) {
      if (m.role === "user") {
        messages.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        messages.push({
          role: "assistant",
          content: m.content ?? null,
          ...(m.toolCalls?.length
            ? {
                tool_calls: m.toolCalls.map((tc) => ({
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.arguments),
                  },
                })),
              }
            : {}),
        });
      } else {
        messages.push({
          role: "tool",
          tool_call_id: m.toolCallId,
          content: m.content,
        });
      }
    }

    const body = {
      model: this.model,
      messages,
      tools: req.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice: "auto",
    };

    const json = (await postJson(
      this.id,
      this.#url,
      { Authorization: `Bearer ${this.#key}` },
      body,
    )) as ChatCompletion;

    const message = json.choices?.[0]?.message;
    if (!message) {
      throw new ProviderRequestError(this.id, `${this.id} returned no message.`);
    }

    const toolCalls: ToolCall[] = [];
    for (const tc of message.tool_calls ?? []) {
      let args: Record<string, unknown> = {};
      try {
        args = tc.function.arguments
          ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
          : {};
      } catch {
        // A malformed argument blob is reported to the model as a tool error
        // rather than crashing the turn.
        args = { __parse_error: tc.function.arguments };
      }
      toolCalls.push({ id: tc.id, name: tc.function.name, arguments: args });
    }

    return { text: message.content ?? null, toolCalls };
  }
}

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super({
      id: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      apiKey,
    });
  }
}
