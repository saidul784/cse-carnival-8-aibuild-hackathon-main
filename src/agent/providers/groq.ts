/**
 * Groq. Exposes an OpenAI-compatible endpoint, so the message and tool-call
 * mapping is shared with the OpenAI provider rather than duplicated.
 */

import { OpenAICompatibleProvider } from "./openai";

export class GroqProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super({
      id: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
      apiKey,
    });
  }
}
