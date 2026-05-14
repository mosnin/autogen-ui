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
 * returns the model's raw text reply. `stream` is optional — when present,
 * the streaming agent (Phase 2) uses it to emit patches incrementally.
 */
export interface LLMClient {
  readonly name: string;
  complete(req: { system: string; messages: ChatMessage[] }): Promise<string>;
  stream?(req: {
    system: string;
    messages: ChatMessage[];
  }): AsyncIterable<string>;
}

/**
 * A capability module contributes a section to the system prompt describing
 * one slice of what the agent can do (styling, component definition, data,
 * ...). Phases register their own module so the prompt grows with the
 * runtime instead of drifting from it.
 */
export interface CapabilityModule {
  name: string;
  /** Markdown appended to the system prompt. */
  systemPrompt: string;
}

export interface UIAgent {
  run(request: AgentRequest): Promise<AgentResponse>;
}

export interface CreateUIAgentOptions {
  client: LLMClient;
  /** Capability modules whose prompt sections are appended, in order. */
  capabilities?: CapabilityModule[];
  /** Extra product-specific guidance (tone, domain defaults, ...). */
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

const PATCH_REFERENCE = `PATCH OPERATIONS (emit an ordered array):
Structure:
- { "op": "setRoot", "node": UINode }
- { "op": "setTitle", "title": string }
- { "op": "append", "parentId": string, "node": UINode, "index"?: number }
- { "op": "update", "id": string, "props": object }     shallow-merge props
- { "op": "replace", "id": string, "node": UINode }
- { "op": "move", "id": string, "parentId": string, "index"?: number }
- { "op": "remove", "id": string }
Styling & motion:
- { "op": "setStyle", "id": string, "style": StyleSpec | null }
- { "op": "setMotion", "id": string, "motion": MotionSpec | null }
- { "op": "setTheme", "theme": Theme }
Reusable components:
- { "op": "defineComponent", "def": ComponentDef }
- { "op": "removeComponent", "name": string }
Data & behaviour:
- { "op": "setDataSource", "source": DataSource }
- { "op": "removeDataSource", "id": string }
- { "op": "setState", "path": string, "value": JSON }
- { "op": "setBindings", "id": string, "bindings": Record<string,string> | null }
- { "op": "setEvents", "id": string, "events": EventMap | null }

A UINode is { "id": string, "type": string, "props"?, "bindings"?, "style"?,
"motion"?, "events"?, "children"?: UINode[] }.`;

function buildSystemPrompt(capabilities: CapabilityModule[], instructions?: string): string {
  const base = `You are the UI engine behind autogen-ui. You build and edit live
dashboards by emitting JSON patches against a component spec tree. You never
write code or HTML — only spec patches.

BUILT-IN COMPONENTS (always available as node \`type\` values):
${buildCatalogText()}

${PATCH_REFERENCE}

CORE RULES:
1. Respond with a SINGLE JSON object and nothing else:
   { "message": string, "patches": Patch[] }
2. Every node MUST have a unique, stable, descriptive "id". Reuse existing ids
   when editing so nodes animate in place.
3. Prefer the smallest set of patches. Use "setRoot" only for a brand-new
   dashboard or a full redesign.
4. The root node should be a "Grid". Size children with style.span (1-12).
5. Use realistic sample data unless the user supplied real data.
6. If the user only asks a question, answer in "message" with empty "patches".`;

  const capSections = capabilities
    .map((c) => `\n\n## CAPABILITY: ${c.name}\n${c.systemPrompt.trim()}`)
    .join("");

  const extra = instructions ? `\n\n## ADDITIONAL INSTRUCTIONS\n${instructions}` : "";

  return base + capSections + extra;
}

/** Pull a JSON object out of a reply that may be fenced or padded with prose. */
export function extractJson(text: string): unknown {
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

/** Build the per-request context message describing the current dashboard. */
export function buildContextMessage(request: AgentRequest): ChatMessage {
  const current = request.dashboard ?? emptyDashboard();
  return {
    role: "user",
    content: `CURRENT DASHBOARD SPEC:\n\`\`\`json\n${JSON.stringify(current)}\n\`\`\``,
  };
}

/**
 * Create a UI agent. Provider-agnostic: depends only on `LLMClient`, so the
 * same agent works with Anthropic, OpenAI, a local model, or a fake in tests.
 * Pass `capabilities` to extend what the agent knows how to do.
 */
export function createUIAgent({
  client,
  capabilities = [],
  instructions,
}: CreateUIAgentOptions): UIAgent {
  const system = buildSystemPrompt(capabilities, instructions);

  return {
    async run(request) {
      const parsed = agentRequestSchema.parse(request);
      const raw = await client.complete({
        system,
        messages: [buildContextMessage(parsed), ...parsed.messages],
      });

      let json: unknown;
      try {
        json = extractJson(raw);
      } catch {
        throw new Error(
          `[autogen-ui] ${client.name} did not return valid JSON. Got: ${raw.slice(0, 200)}`,
        );
      }
      return agentResponseSchema.parse(json);
    },
  };
}

/** Expose the assembled system prompt (useful for streaming agents and tests). */
export function getSystemPrompt(
  capabilities: CapabilityModule[] = [],
  instructions?: string,
): string {
  return buildSystemPrompt(capabilities, instructions);
}

/**
 * Framework-agnostic POST handler (Web Request -> Web Response).
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
