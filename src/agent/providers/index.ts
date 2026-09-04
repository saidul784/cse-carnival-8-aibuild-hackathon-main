/**
 * Provider-independent LLM interface.
 *
 * Four providers, one shape. The agent loop in ../index.ts never learns which
 * one is in use: it hands over neutral messages and tool definitions and gets
 * back a normalised { text, toolCalls } response.
 *
 * Every provider talks to its vendor's documented HTTP API directly rather than
 * through an SDK. That keeps all four on one code path, avoids four dependency
 * trees drifting apart, and means the tool-call normalisation is visible in one
 * place instead of hidden behind four different abstractions.
 *
 * API keys are read from process.env inside server-only modules. Nothing here
 * is ever imported by a client component.
 */

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type AgentMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export interface LLMResponse {
  text: string | null;
  toolCalls: ToolCall[];
}

export interface ChatRequest {
  system: string;
  messages: AgentMessage[];
  tools: ToolDefinition[];
}

export interface LLMProvider {
  readonly id: ProviderId;
  readonly model: string;
  chat(req: ChatRequest): Promise<LLMResponse>;
}

export type ProviderId = "anthropic" | "openai" | "groq" | "google";

/** Thrown when no usable provider is configured. Surfaced to the user as-is. */
export class ProviderConfigError extends Error {
  readonly code = "LLM_NOT_CONFIGURED";
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

/** Thrown when a configured provider fails at request time. */
export class ProviderRequestError extends Error {
  readonly code = "LLM_REQUEST_FAILED";
  readonly provider: ProviderId;
  readonly status?: number;
  constructor(provider: ProviderId, message: string, status?: number) {
    super(message);
    this.name = "ProviderRequestError";
    this.provider = provider;
    this.status = status;
  }
}

const ENV_KEY: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
  google: "GOOGLE_API_KEY",
};

/** Placeholder values from .env.example must not count as configured. */
function realKey(name: string): string | null {
  const v = (process.env[name] ?? "").trim();
  if (!v || v === "your_key_here" || v.startsWith("your_")) return null;
  return v;
}

export function configuredProviders(): ProviderId[] {
  return (Object.keys(ENV_KEY) as ProviderId[]).filter((p) =>
    realKey(ENV_KEY[p]),
  );
}

/**
 * Resolve the provider to use.
 *
 * An explicit LLM_PROVIDER is honoured strictly: if its key is missing the call
 * fails with a clear message rather than quietly falling back to another
 * vendor. Silent switching would make a wrong answer impossible to explain.
 */
export async function getProvider(): Promise<LLMProvider> {
  const requested = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();
  const available = configuredProviders();

  if (requested) {
    if (!(requested in ENV_KEY)) {
      throw new ProviderConfigError(
        `LLM_PROVIDER is "${requested}", which is not a supported provider. Use one of: anthropic, openai, groq, google.`,
      );
    }
    const id = requested as ProviderId;
    const key = realKey(ENV_KEY[id]);
    if (!key) {
      throw new ProviderConfigError(
        `LLM_PROVIDER is set to "${id}" but ${ENV_KEY[id]} is not set in your .env file. ` +
          (available.length
            ? `Keys are present for: ${available.join(", ")}. Either set ${ENV_KEY[id]} or change LLM_PROVIDER.`
            : `No provider keys are set at all. Copy .env.example to .env and add one key.`),
      );
    }
    return build(id, key);
  }

  const first = available[0];
  if (!first) {
    throw new ProviderConfigError(
      "No LLM provider is configured. Copy .env.example to .env and set one of " +
        "ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY or GOOGLE_API_KEY, " +
        "then restart the server.",
    );
  }
  return build(first, realKey(ENV_KEY[first])!);
}

async function build(id: ProviderId, apiKey: string): Promise<LLMProvider> {
  switch (id) {
    case "anthropic": {
      const { AnthropicProvider } = await import("./anthropic");
      return new AnthropicProvider(apiKey);
    }
    case "openai": {
      const { OpenAIProvider } = await import("./openai");
      return new OpenAIProvider(apiKey);
    }
    case "groq": {
      const { GroqProvider } = await import("./groq");
      return new GroqProvider(apiKey);
    }
    case "google": {
      const { GeminiProvider } = await import("./gemini");
      return new GeminiProvider(apiKey);
    }
  }
}

/** Shared fetch with a timeout, so a hung vendor cannot hang the request. */
export async function postJson(
  provider: ProviderId,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = 60_000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "the request timed out"
        : e instanceof Error
          ? e.message
          : "network error";
    throw new ProviderRequestError(provider, `Could not reach ${provider}: ${msg}.`);
  }
  clearTimeout(timer);

  const text = await res.text();
  if (!res.ok) {
    // Vendor error bodies can echo the key; report status and a trimmed
    // message only.
    let detail = text.slice(0, 400);
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      if (j?.error?.message) detail = j.error.message;
    } catch {
      /* keep the trimmed raw text */
    }
    throw new ProviderRequestError(
      provider,
      `${provider} returned ${res.status}: ${detail}`,
      res.status,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderRequestError(provider, `${provider} returned unreadable JSON.`);
  }
}
