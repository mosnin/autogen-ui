import { framesToResponse } from "./stream";
import type { StreamingUIAgent } from "./streaming-agent";
import type { AgentRequest } from "./schema";

/**
 * Framework-agnostic streaming POST handler (Web Request -> streaming Web
 * Response). Works directly as a Next.js App Router route export:
 *
 *   export const POST = createStreamingRouteHandler({ agent });
 *
 * The response body is NDJSON: one `StreamFrame` per line.
 */
export function createStreamingRouteHandler({
  agent,
}: {
  agent: StreamingUIAgent;
}) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      return framesToResponse(agent.runStream(body as AgentRequest));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
