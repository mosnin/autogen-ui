import type { LLMClient, LLMSystemSegment, LLMTool } from "./llm";
import { componentCatalog, type ComponentDoc } from "./registry";
import {
  agentRequestSchema,
  agentResponseSchema,
  emptyDashboard,
  type AgentRequest,
  type AgentResponse,
  type ChatMessage,
} from "./schema";

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
  /**
   * Extra components the consumer has registered with the renderer.
   * Their `ComponentDoc` entries are appended to the catalog the model
   * sees, so the agent can actually use them.
   */
  components?: ComponentDoc[];
  /** Extra product-specific guidance (tone, domain defaults, ...). */
  instructions?: string;
  /**
   * Bounded auto-repair: when the model's tool input fails Zod validation,
   * feed the error back and retry up to this many times. Default 2.
   */
  maxRepairAttempts?: number;
}

/* ------------------------------------------------------------------ *
 * System prompt
 * ------------------------------------------------------------------ */

function buildCatalogText(extra: ComponentDoc[]): string {
  return [...componentCatalog, ...extra]
    .map(
      (c) =>
        `- ${c.type}${c.acceptsChildren ? " (container)" : ""}: ${c.description}\n    props: ${c.props}`,
    )
    .join("\n");
}

const PATCH_REFERENCE = `PATCH OPERATIONS:
Structure: setRoot{node}, setTitle{title}, append{parentId,node,index?},
  update{id,props}, replace{id,node}, move{id,parentId,index?}, remove{id}
Style/motion: setStyle{id,style|null}, setMotion{id,motion|null}, setTheme{theme}
Components: defineComponent{def}, removeComponent{name}
Data/behaviour: setDataSource{source}, removeDataSource{id},
  setState{path,value}, setBindings{id,bindings|null}, setEvents{id,events|null}

A UINode is { id, type, props?, bindings?, style?, motion?, events?, children? }.`;

function buildBaseSystemPrompt(
  capabilities: CapabilityModule[],
  extraComponents: ComponentDoc[],
  instructions?: string,
): string {
  const base = `You are the UI engine behind autogen-ui. You build and edit a
live dashboard by emitting patches against a JSON spec tree. You never write
code or HTML — only spec patches.

You will call the \`emit_patches\` tool with a single object:
  { "message": string, "patches": Patch[] }
"message" is a short friendly note about what you changed.

COMPONENTS (only these may appear as a node \`type\`):
${buildCatalogText(extraComponents)}

${PATCH_REFERENCE}

RULES:
1. Always call emit_patches — never reply in plain text.
2. Every node MUST have a unique, stable, descriptive id. Reuse ids when
   editing so the UI animates in place.
3. Prefer the smallest set of patches. Use setRoot only for a brand-new
   dashboard or a full redesign.
4. The root node should be a Grid. Size children with style.span (1-12).
5. Use realistic sample data unless the user provided real data.
6. If the user only asks a question, answer in "message" with empty "patches".`;

  const capSections = capabilities
    .map((c) => `\n\n## CAPABILITY: ${c.name}\n${c.systemPrompt.trim()}`)
    .join("");

  const extra = instructions ? `\n\n## ADDITIONAL INSTRUCTIONS\n${instructions}` : "";
  return base + capSections + extra;
}

/**
 * Build cache-aware system segments: the static prompt (cacheable) and the
 * current-dashboard context (not cacheable, changes every turn).
 */
export function buildSystemSegments(opts: {
  capabilities?: CapabilityModule[];
  components?: ComponentDoc[];
  instructions?: string;
}): LLMSystemSegment[] {
  const text = buildBaseSystemPrompt(
    opts.capabilities ?? [],
    opts.components ?? [],
    opts.instructions,
  );
  return [{ text, cache: true }];
}

/** Build the per-request context message describing the current dashboard. */
export function buildContextMessage(request: AgentRequest): ChatMessage {
  const current = request.dashboard ?? emptyDashboard();
  return {
    role: "user",
    content: `CURRENT DASHBOARD SPEC:\n\`\`\`json\n${JSON.stringify(current)}\n\`\`\``,
  };
}

/** The single tool the model calls every turn. Input is validated with Zod after. */
export const EMIT_PATCHES_TOOL: LLMTool = {
  name: "emit_patches",
  description:
    "Apply a list of patches to the live dashboard. Each patch is one of the documented ops " +
    "(see the system prompt). `message` is a short note shown to the user about what you changed; " +
    "leave `patches` empty if the user only asked a question.",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string" },
      patches: { type: "array", items: { type: "object" } },
    },
    required: ["patches"],
  },
};

/* ------------------------------------------------------------------ *
 * Auto-repair loop
 * ------------------------------------------------------------------ */

function describeZodError(err: { errors: { path: (string | number)[]; message: string }[] }): string {
  return err.errors
    .slice(0, 8)
    .map((e) => `- ${e.path.join(".") || "(root)"}: ${e.message}`)
    .join("\n");
}

interface RunArgs {
  client: LLMClient;
  system: LLMSystemSegment[];
  initialMessages: ChatMessage[];
  maxRepairAttempts: number;
}

async function runWithRepair({
  client,
  system,
  initialMessages,
  maxRepairAttempts,
}: RunArgs): Promise<AgentResponse> {
  let messages = initialMessages;

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    const result = await client.complete({
      system,
      messages,
      tools: [EMIT_PATCHES_TOOL],
      toolChoice: { name: EMIT_PATCHES_TOOL.name },
    });

    const call = result.toolCalls.find((c) => c.name === EMIT_PATCHES_TOOL.name);
    if (!call) {
      throw new Error(
        `[autogen-ui] ${client.name} did not call emit_patches. text="${result.text.slice(0, 200)}"`,
      );
    }

    const parsed = agentResponseSchema.safeParse(call.input);
    if (parsed.success) return parsed.data;

    if (attempt >= maxRepairAttempts) {
      throw new Error(
        `[autogen-ui] emit_patches input failed validation after ${attempt + 1} attempts:\n${describeZodError(parsed.error)}`,
      );
    }

    messages = [
      ...messages,
      {
        role: "assistant",
        content: `(called emit_patches with: ${JSON.stringify(call.input).slice(0, 800)})`,
      },
      {
        role: "user",
        content: `Your last emit_patches call failed validation:\n${describeZodError(parsed.error)}\n\nCall emit_patches again with corrected input. Do NOT explain — just call the tool.`,
      },
    ];
  }

  throw new Error("[autogen-ui] unreachable");
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export function createUIAgent({
  client,
  capabilities = [],
  components = [],
  instructions,
  maxRepairAttempts = 2,
}: CreateUIAgentOptions): UIAgent {
  const system = buildSystemSegments({ capabilities, components, instructions });

  return {
    async run(request) {
      const parsed = agentRequestSchema.parse(request);
      const initialMessages = [buildContextMessage(parsed), ...parsed.messages];
      return runWithRepair({ client, system, initialMessages, maxRepairAttempts });
    },
  };
}

/** Expose the assembled system prompt (useful for streaming agents and tests). */
export function getSystemPrompt(
  capabilities: CapabilityModule[] = [],
  components: ComponentDoc[] = [],
  instructions?: string,
): string {
  return buildBaseSystemPrompt(capabilities, components, instructions);
}

/**
 * Framework-agnostic POST handler (Web Request -> Web Response).
 * Works directly as a Next.js App Router route export.
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

// Re-export LLM types so existing imports `from "./agent"` keep working.
export type { LLMClient, LLMRequest, LLMResult, LLMSystemSegment, LLMTool, ToolCall, LLMEvent } from "./llm";
