import {
  createStreamingRouteHandler,
  createStreamingUIAgent,
  streamingCapabilities,
  type StreamingUIAgent,
} from "@autogen-ui/core/server";
import { AGENT_INSTRUCTIONS, getClient } from "@/lib/llm";

export const runtime = "nodejs";

let agent: StreamingUIAgent | undefined;
function getAgent(): StreamingUIAgent {
  if (!agent) {
    agent = createStreamingUIAgent({
      client: getClient(),
      capabilities: streamingCapabilities,
      instructions: AGENT_INSTRUCTIONS,
    });
  }
  return agent;
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await createStreamingRouteHandler({ agent: getAgent() })(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
