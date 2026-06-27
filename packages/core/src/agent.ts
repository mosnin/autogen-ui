import { brandToPromptSection, type BrandKit } from "./brand";
import type { LLMClient, LLMSystemSegment, LLMTool } from "./llm";
import { validatePatchTargets } from "./patch";
import { componentCatalog, type ComponentDoc } from "./registry";
import {
  agentRequestSchema,
  agentResponseSchema,
  emptyDashboard,
  type AgentRequest,
  type AgentResponse,
  type ChatMessage,
  type Dashboard,
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

/** Telemetry payload emitted at the end of every agent turn. */
export interface TurnInfo {
  clientName: string;
  attempts: number;
  durationMs: number;
  patchCount: number;
  warningCount: number;
  hadRepair: boolean;
  /** Trimmed last error message if the turn fell over before resolving. */
  error?: string;
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
  /**
   * Custom-component **types** the agent should prefer over similar
   * built-ins. Listed by `type` name. Surfaces a "PREFER these" section
   * in the prompt so the agent reaches for host components first.
   */
  prefer?: string[];
  /**
   * Strict mode — the prompt explicitly forbids inventing new node types.
   * The agent must use only the documented components. Recommended for
   * production deployments inside host applications.
   */
  strict?: boolean;
  /** Extra product-specific guidance (tone, domain defaults, ...). */
  instructions?: string;
  /**
   * Host's brand kit — tokens, voice, content rules. Injected into the
   * system prompt so the agent picks props that match the host's identity.
   */
  brand?: BrandKit;
  /**
   * Bounded auto-repair: when the model's tool input fails Zod validation,
   * feed the error back and retry up to this many times. Default 2.
   */
  maxRepairAttempts?: number;
  /** Fires after each completed turn — for logging, metrics, observability. */
  onTurn?: (info: TurnInfo) => void;
  /**
   * When true, treat patch-target warnings (hallucinated id references) the
   * same as a Zod failure: feed them back to the model and retry, up to
   * `maxRepairAttempts`. If the final attempt still produces warnings, they
   * are returned on the response (no throw). Default false — backwards
   * compatible.
   */
  repairOnWarnings?: boolean;
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

const VISUAL_EXEMPLARS = `
EXEMPLARS — study the pattern, the proportions, the specificity of the data:

## Hero dashboard — one number dominates, three support
\`\`\`json
{ "op": "setRoot", "node": {
  "id": "root", "type": "Grid", "props": { "gap": 6, "layoutPreset": "hero" },
  "children": [
    { "id": "hero-mrr", "type": "Stat", "props": { "label": "Monthly Recurring Revenue", "value": "$248,479", "delta": "+18.3%", "trend": "up" },
      "style": { "span": 12, "p": 6, "rounded": "xl", "bg": "primary", "color": "primary-foreground", "shadow": "lg" } },
    { "id": "stat-users", "type": "Stat", "props": { "label": "Active Users", "value": "12,840", "delta": "+4.2%", "trend": "up" },
      "style": { "span": 4, "p": 5, "rounded": "lg", "shadow": "sm" } },
    { "id": "stat-churn", "type": "Stat", "props": { "label": "Churn Rate", "value": "2.1%", "delta": "-0.4pp", "trend": "down" },
      "style": { "span": 4, "p": 5, "rounded": "lg", "shadow": "sm" } },
    { "id": "stat-arpu", "type": "Stat", "props": { "label": "ARPU", "value": "$19.34", "delta": "+$1.20", "trend": "up" },
      "style": { "span": 4, "p": 5, "rounded": "lg", "shadow": "sm" } }
  ]
}}
\`\`\`

## Bento — asymmetric hero chart + accent stat sidebar
\`\`\`json
{ "op": "setRoot", "node": {
  "id": "root", "type": "Grid", "props": { "gap": 4, "layoutPreset": "bento" },
  "children": [
    { "id": "chart-revenue", "type": "Chart",
      "props": { "title": "Revenue Trend", "kind": "line",
        "data": [{"x":"Jan","y":41200},{"x":"Feb","y":48700},{"x":"Mar","y":45900},{"x":"Apr","y":62300},{"x":"May","y":71800},{"x":"Jun","y":89400}] },
      "style": { "span": 8, "p": 4, "rounded": "lg", "shadow": "sm" } },
    { "id": "stat-total", "type": "Stat",
      "props": { "label": "6-Month Total", "value": "$359,300", "delta": "+24%", "trend": "up" },
      "style": { "span": 4, "p": 6, "rounded": "lg", "bg": "primary", "color": "primary-foreground", "shadow": "md" } }
  ]
}}
\`\`\`

## Sidebar + detail — persistent nav, content pane
\`\`\`json
{ "op": "setRoot", "node": {
  "id": "root", "type": "Grid", "props": { "gap": 0, "layoutPreset": "sidebar-detail" },
  "children": [
    { "id": "sidebar", "type": "Stack", "props": { "gap": 1 },
      "style": { "span": 3, "p": 4, "bg": "muted", "height": "screen" },
      "children": [
        { "id": "nav-overview", "type": "Link", "props": { "label": "Overview", "to": "overview" } },
        { "id": "nav-analytics", "type": "Link", "props": { "label": "Analytics", "to": "analytics" } },
        { "id": "nav-settings", "type": "Link", "props": { "label": "Settings", "to": "settings" } }
      ] },
    { "id": "content", "type": "Stack", "style": { "span": 9, "p": 6 }, "children": [] }
  ]
}}
\`\`\`
`;

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
  brand?: BrandKit,
  prefer?: string[],
  strict?: boolean,
): string {
  const base = `You are the visual intelligence behind autogen-ui. You build and edit
beautiful, purposeful dashboards by emitting patches against a JSON spec tree.
You never write code or HTML — only spec patches.

A great dashboard is like a beautifully typeset magazine page: one thing dominates,
supporting elements lead the eye, generous breathing room, nothing unnecessary.
Never a spreadsheet. Never same-size boxes in a monotonous grid.

You will call the \`emit_patches\` tool with a single object:
  { "message": string, "patches": Patch[] }
"message" is a brief, confident note about what you changed.

COMPONENTS (only these may appear as a node \`type\`):
${buildCatalogText(extraComponents)}

${PATCH_REFERENCE}

OPINIONS (these encode taste, not just correctness):

1. Always call emit_patches. A question gets empty patches + the answer in "message".

2. Ids are stable and descriptive. Reuse them when editing — the UI animates in
   place. "stat-mrr" beats "n1". "chart-revenue-trend" beats "chart1".

3. Use the smallest patch set. setRoot only for a brand-new surface or full redesign.

4. Root is always a Grid. Children control width via style.span (1–12).

5. Vary spans with intention. A layout where everything is the same width is
   a failed design. One element should dominate. Others should support it.
   • Dominant element (hero stat, featured chart): span 8–12
   • Supporting KPIs in a row: span 3–4 (three or four across)
   • Secondary charts: span 6
   • Tables, headings, full-width elements: span 12

6. Set props.layoutPreset on Grid nodes to signal layout intent:
   • "bento"  — hero(8) + sidebar(4), then balanced pairs. Asymmetric, editorial.
   • "hero"   — full-width hero, then span-4 supporting cards below
   • "split"  — 7/5 alternating pairs; content + context
   • "sidebar-detail" — 3-col nav + 9-col content pane
   • "thirds" — equal span-4 thirds; feature comparisons, stat rows
   • "feed"   — full-width items; logs, activity, articles

7. Cards always have p:4 minimum, rounded:"lg", shadow:"sm". A Card with no
   padding is broken. A Card with no radius looks like 2010. These are not optional.

8. Numbers tell stories. "$248,479" is more believable than "$248,000". Trend lines
   should actually trend — rising, dipping, recovering — not be flat. Sample data
   should make the product feel real.

9. Charts always have a title and at least 5–6 data points forming a visible pattern.
   A chart with zeros or flat data is worse than no chart.

10. If the user only asks a question, answer in "message" with empty "patches".

${VISUAL_EXEMPLARS}`;

  const capSections = capabilities
    .map((c) => `\n\n## CAPABILITY: ${c.name}\n${c.systemPrompt.trim()}`)
    .join("");

  const extra = instructions ? `\n\n## ADDITIONAL INSTRUCTIONS\n${instructions}` : "";
  const brandSection = brandToPromptSection(brand);

  const preferSection =
    prefer && prefer.length > 0
      ? `\n\n## PREFER THESE COMPONENTS\nWhen multiple components could express the same thing, prefer the host's:\n${prefer
          .map((t) => `- ${t}`)
          .join(
            "\n",
          )}\nThese are the host application's own components and look native to their app.`
      : "";

  const strictSection = strict
    ? `\n\n## STRICT MODE\nYou MUST only use component \`type\` values from the catalog above. Never invent new types. If a needed UI pattern can't be expressed with the available components, compose it from \`Box\` with \`style\`, OR describe the gap in your "message" field and emit no patch for that piece.`
    : "";

  return base + capSections + extra + brandSection + preferSection + strictSection;
}

/**
 * Build cache-aware system segments: the static prompt (cacheable) and the
 * current-dashboard context (not cacheable, changes every turn).
 */
export function buildSystemSegments(opts: {
  capabilities?: CapabilityModule[];
  components?: ComponentDoc[];
  instructions?: string;
  brand?: BrandKit;
  prefer?: string[];
  strict?: boolean;
}): LLMSystemSegment[] {
  const text = buildBaseSystemPrompt(
    opts.capabilities ?? [],
    opts.components ?? [],
    opts.instructions,
    opts.brand,
    opts.prefer,
    opts.strict,
  );
  return [{ text, cache: true }];
}

const CONTEXT_CHAR_LIMIT = 15_000;

/** Build the per-request context message describing the current dashboard. */
export function buildContextMessage(request: AgentRequest): ChatMessage {
  const current = request.dashboard ?? emptyDashboard();
  const raw = JSON.stringify(current);
  const json =
    raw.length > CONTEXT_CHAR_LIMIT
      ? raw.slice(0, CONTEXT_CHAR_LIMIT) + "\n… (truncated — spec too large)"
      : raw;
  return {
    role: "user",
    content: `CURRENT DASHBOARD SPEC:\n\`\`\`json\n${json}\n\`\`\``,
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
  dashboard: Dashboard;
  maxRepairAttempts: number;
  repairOnWarnings: boolean;
  onTurn?: (info: TurnInfo) => void;
}

async function runWithRepair({
  client,
  system,
  initialMessages,
  dashboard,
  maxRepairAttempts,
  repairOnWarnings,
  onTurn,
}: RunArgs): Promise<AgentResponse> {
  const startedAt = Date.now();
  let messages = initialMessages;
  let lastError: string | undefined;
  const emit = (result: AgentResponse | null, attempts: number) => {
    if (!onTurn) return;
    try {
      onTurn({
        clientName: client.name,
        attempts,
        durationMs: Date.now() - startedAt,
        patchCount: result?.patches.length ?? 0,
        warningCount: result?.warnings?.length ?? 0,
        hadRepair: attempts > 1,
        error: lastError,
      });
    } catch {
      // never let telemetry crash the run
    }
  };

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    const result = await client.complete({
      system,
      messages,
      tools: [EMIT_PATCHES_TOOL],
      toolChoice: { name: EMIT_PATCHES_TOOL.name },
    });

    const call = result.toolCalls.find((c) => c.name === EMIT_PATCHES_TOOL.name);
    if (!call) {
      lastError = `${client.name} did not call emit_patches`;
      emit(null, attempt + 1);
      throw new Error(
        `[autogen-ui] ${client.name} did not call emit_patches. text="${result.text.slice(0, 200)}"`,
      );
    }

    const parsed = agentResponseSchema.safeParse(call.input);
    if (parsed.success) {
      const warnings = validatePatchTargets(dashboard, parsed.data.patches);
      if (warnings.length === 0) {
        emit(parsed.data, attempt + 1);
        return parsed.data;
      }
      if (!repairOnWarnings || attempt >= maxRepairAttempts) {
        const out = { ...parsed.data, warnings };
        emit(out, attempt + 1);
        return out;
      }
      messages = [
        ...messages,
        {
          role: "assistant",
          content: `(called emit_patches with: ${JSON.stringify(call.input).slice(0, 800)})`,
        },
        {
          role: "user",
          content: `Your last emit_patches call targeted ids that do not exist in the dashboard:\n${warnings.map((w) => `- ${w}`).join("\n")}\n\nRe-call emit_patches using only ids that exist in the dashboard you were given. Do NOT explain — just call the tool.`,
        },
      ];
      continue;
    }

    if (attempt >= maxRepairAttempts) {
      lastError = describeZodError(parsed.error);
      emit(null, attempt + 1);
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
  prefer,
  strict = false,
  instructions,
  brand,
  maxRepairAttempts = 2,
  repairOnWarnings = false,
  onTurn,
}: CreateUIAgentOptions): UIAgent {
  const system = buildSystemSegments({
    capabilities,
    components,
    instructions,
    brand,
    prefer,
    strict,
  });

  return {
    async run(request) {
      const parsed = agentRequestSchema.parse(request);
      const dashboard = parsed.dashboard ?? emptyDashboard();
      const initialMessages = [buildContextMessage(parsed), ...parsed.messages];
      return runWithRepair({
        client,
        system,
        initialMessages,
        dashboard,
        maxRepairAttempts,
        repairOnWarnings,
        onTurn,
      });
    },
  };
}

/** Expose the assembled system prompt (useful for streaming agents and tests). */
export function getSystemPrompt(
  capabilities: CapabilityModule[] = [],
  components: ComponentDoc[] = [],
  instructions?: string,
  brand?: BrandKit,
): string {
  return buildBaseSystemPrompt(capabilities, components, instructions, brand);
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
