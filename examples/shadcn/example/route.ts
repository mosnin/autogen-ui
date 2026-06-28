/**
 * Reference server wiring. Copy into e.g.
 * `app/api/autogen-ui/stream/route.ts` of your shadcn app.
 *
 * The shadcn-specific line is `instructions: shadcnInstructions` — it tells the
 * agent it's targeting shadcn/ui and that `Icon` accepts the full lucide set.
 */

import {
  createStreamingRouteHandler,
  createStreamingUIAgent,
  streamingCapabilities,
} from "@autogen-ui/core/server";
import { createAnthropicStreamClient } from "@autogen-ui/core/clients";
import { shadcnInstructions } from "@/autogen-shadcn";

export const runtime = "nodejs";

const agent = createStreamingUIAgent({
  client: createAnthropicStreamClient({ apiKey: process.env.ANTHROPIC_API_KEY! }),
  capabilities: streamingCapabilities,
  instructions: shadcnInstructions,
});

export const POST = createStreamingRouteHandler({ agent });
