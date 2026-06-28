import type { LLMClient } from "@autogen-ui/core/server";
import {
  createAnthropicStreamClient,
  createOpenAIStreamClient,
} from "@autogen-ui/core/clients";

/**
 * Resolve an LLM client from env. Streaming-capable clients are used for both
 * routes — `createUIAgent` just calls `.complete`, the streaming agent calls
 * `.stream`. The route auto-detects whichever provider key is set.
 */
export function getClient(): LLMClient {
  const model = process.env.AUTOGEN_UI_MODEL || undefined;

  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropicStreamClient({ apiKey: process.env.ANTHROPIC_API_KEY, model });
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAIStreamClient({ apiKey: process.env.OPENAI_API_KEY, model });
  }
  throw new Error(
    "No model configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in apps/demo/.env.local",
  );
}

export const AGENT_INSTRUCTIONS =
  "Favor editorial, magazine-quality layouts — not spreadsheets. " +
  "Use real-looking data with specific numbers. " +
  "When the user is vague, make bold, opinionated design choices and explain them briefly. " +
  "Always open with the most important number as a Metric or large Chart, then support it with Stats. " +
  "Default to bento or hero layoutPreset for visual richness.";
