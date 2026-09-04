/** Google Gemini generateContent API. */

import {
  type ChatRequest,
  type LLMProvider,
  type LLMResponse,
  type ToolCall,
  postJson,
  ProviderRequestError,
} from "./index";

interface Part {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: Part[] } }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiProvider implements LLMProvider {
  readonly id = "google" as const;
  readonly model: string;
  #key: string;

  constructor(apiKey: string) {
    this.#key = apiKey;
    this.model = process.env.GOOGLE_MODEL?.trim() || "gemini-2.0-flash";
  }

  async chat(req: ChatRequest): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: toContents(req),
      tools: [
        {
          functionDeclarations: req.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: stripUnsupported(t.parameters),
          })),
        },
      ],
    };

    const json = (await postJson(
      this.id,
      url,
      { "x-goog-api-key": this.#key },
      body,
    )) as GenerateContentResponse;

    if (json.promptFeedback?.blockReason) {
      throw new ProviderRequestError(
        this.id,
        `Gemini blocked the request (${json.promptFeedback.blockReason}).`,
      );
    }

    const parts = json.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new ProviderRequestError(this.id, "Gemini returned no content.");
    }

    let text: string | null = null;
    const toolCalls: ToolCall[] = [];
    let n = 0;

    for (const p of parts) {
      if (typeof p.text === "string" && p.text.length) {
        text = (text ?? "") + p.text;
      }
      if (p.functionCall) {
        // Gemini does not issue call ids; synthesise stable ones so the rest of
        // the agent can match results to calls uniformly.
        toolCalls.push({
          id: `gemini-${Date.now()}-${n++}`,
          name: p.functionCall.name,
          arguments: p.functionCall.args ?? {},
        });
      }
    }

    return { text, toolCalls };
  }
}

function toContents(req: ChatRequest) {
  const out: { role: "user" | "model"; parts: Part[] }[] = [];

  for (const m of req.messages) {
    if (m.role === "user") {
      out.push({ role: "user", parts: [{ text: m.content }] });
      continue;
    }

    if (m.role === "assistant") {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls ?? []) {
        parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
      }
      if (parts.length) out.push({ role: "model", parts });
      continue;
    }

    // Tool results go back as a user turn carrying functionResponse parts.
    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(m.content);
      payload =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : { result: parsed };
    } catch {
      payload = { result: m.content };
    }

    const part: Part = {
      functionResponse: { name: m.name, response: payload },
    };
    const last = out[out.length - 1];
    if (last && last.role === "user" && last.parts[0]?.functionResponse) {
      last.parts.push(part);
    } else {
      out.push({ role: "user", parts: [part] });
    }
  }

  return out;
}

/**
 * Gemini rejects some JSON Schema keywords that the other providers accept.
 * Strip them rather than maintaining a second set of schemas.
 */
function stripUnsupported(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripUnsupported);
  if (!schema || typeof schema !== "object") return schema;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "additionalProperties" || k === "$schema" || k === "default") continue;
    out[k] = stripUnsupported(v);
  }
  return out;
}
