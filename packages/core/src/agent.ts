import {
  agentRequestSchema,
  agentResponseSchema,
  emptyDashboard,
  type AgentRequest,
  type AgentResponse,
  type ChatMessage,
} from "./schema";
import { componentCatalog } from "./registry";

/**
 * Provider-agnostic chat completion client. Implement this to plug in any
 * model backend; `complete` receives a system prompt + chat transcript and
 * must return the model's raw text reply (expected to contain JSON).
 */
export interface LLMClient {
  /** Human-readable provider name, used in errors/logs. */
  readonly name: string;
  complete(req: { system: string; messages: ChatMessage[] }): Promise<string>;
}

/** A configured agent that turns a chat turn into dashboard patches. */
export interface UIAgent {
  run(request: AgentRequest): Promise<AgentResponse>;
}

export interface CreateUIAgentOptions {
  client: LLMClient;
  /**
   * Extra product-specific guidance appended to the system prompt
   * (tone, domain defaults, layout preferences, ...).
   */
  instructions?: string;
}

function buildCatalogText(): string {
  return componentCatalog
    .map(
      (c) =>
        `- ${c.type}${c.acceptsChildren ? " (container)" : ""}: ${c.description}\n    props: ${c.props}`,
    )
    .join("\n");
}

const PATCH_REFERENCE = `Patch operations (emit an ordered array):
- { "op": "setRoot", "node": UINode }              replace the whole tree
- { "op": "setTitle", "title": string }            set the dashboard title
- { "op": "append", "parentId": string, "node": UINode, "index"?: number }
- { "op": "update", "id": string, "props": object } shallow-merge props of a node
- { "op": "replace", "id": string, "node": UINode } swap a node (keep its id)
- { "op": "move", "id": string, "parentId": string, "index"?: number }
- { "op": "remove", "id": string }

A UINode is { "id": string, "type": string, "props"?: object, "children"?: UINode[] }.`;

function buildSystemPrompt(instructions?: string): string {
  return `You are the UI engine behind autogen-ui. You build and edit dashboards by
emitting JSON patches against a component spec tree. You never write code or
HTML — only spec patches.

AVAILABLE COMPONENTS (you may only use these \`type\` values):
${buildCatalogText()}

${PATCH_REFERENCE}

RULES:
1. Respond with a SINGLE JSON object and nothing else:
   { "message": string, "patches": Patch[] }
   "message" is a short, friendly note to the user about what you changed.
2. Every node MUST have a unique, stable, descriptive "id" (e.g. "revenue_stat").
   Reuse existing ids when editing a node so it animates in place.
3. Prefer the smallest set of patches. To tweak one node, use "update"/"replace",
   not "setRoot". Use "setRoot" only for a brand-new dashboard or a full redesign.
4. The root node should be a "Grid". Place Cards/Stats/Charts directly in it and
   size them with the "span" prop (1-12 columns).
5. Put realistic, plausible sample data in charts/tables/stats unless the user
   supplied real data. Keep dashboards visually balanced.
6. If the user only asks a question, answer it in "message" with an empty
   "patches" array.${instructions ? `\n\nADDITIONAL INSTRUCTIONS:\n${instructions}` : ""}`;
}

/** Pull a JSON object out of a model reply that may be fenced or padded with prose. */
function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) t = fence[1].trim();
  if (!t.startsWith("{")) {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  }
  return JSON.parse(t);
}

/**
 * Create a UI agent. The agent is provider-agnostic: it only depends on the
 * `LLMClient` interface, so the same agent works with Anthropic, OpenAI, a
 * local model, or a fake client in tests.
 */
export function createUIAgent({ client, instructions }: CreateUIAgentOptions): UIAgent {
  const system = buildSystemPrompt(instructions);

  return {
    async run(request) {
      const { messages, dashboard } = agentRequestSchema.parse(request);
      const current = dashboard ?? emptyDashboard();

      const contextMessage: ChatMessage = {
        role: "user",
        content: `CURRENT DASHBOARD SPEC:\n\`\`\`json\n${JSON.stringify(current)}\n\`\`\``,
      };

      const raw = await client.complete({
        system,
        messages: [contextMessage, ...messages],
      });

      let parsed: unknown;
      try {
        parsed = extractJson(raw);
      } catch {
        throw new Error(
          `[autogen-ui] ${client.name} did not return valid JSON. Got: ${raw.slice(0, 200)}`,
        );
      }

      return agentResponseSchema.parse(parsed);
    },
  };
}

/**
 * Build a framework-agnostic POST handler (Web Request -> Web Response).
 * Works directly as a Next.js App Router route export:
 *
 *   export const POST = createRouteHandler({ agent });
 */
export function createRouteHandler({ agent }: { agent: UIAgent }) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      const result = await agent.run(body as AgentRequest);
      return Response.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
