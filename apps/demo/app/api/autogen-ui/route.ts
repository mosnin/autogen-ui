import { createRouteHandler, createUIAgent, type LLMClient, type UIAgent } from "@autogen-ui/core";
import { createAnthropicClient, createOpenAIClient } from "@autogen-ui/core/clients";

export const runtime = "nodejs";

function getClient(): LLMClient {
  const model = process.env.AUTOGEN_UI_MODEL || undefined;

  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY, model });
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY, model });
  }
  throw new Error(
    "No model configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in apps/demo/.env.local",
  );
}

let agent: UIAgent | undefined;
function getAgent(): UIAgent {
  if (!agent) {
    agent = createUIAgent({
      client: getClient(),
      instructions:
        "Favor clean, balanced dashboards. Default to dark-mode-friendly content. " +
        "When the user is vague, make tasteful assumptions and pick sensible sample data.",
    });
  }
  return agent;
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await createRouteHandler({ agent: getAgent() })(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
