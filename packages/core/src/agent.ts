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
EXEMPLARS — study the proportions, the data specificity, the intentional hierarchy:

## Hero — one Metric dominates, three Stats support
\`\`\`json
{ "op": "setRoot", "node": {
  "id": "root", "type": "Grid", "props": { "gap": 6, "layoutPreset": "hero" },
  "children": [
    { "id": "hero-mrr", "type": "Metric",
      "props": { "label": "Monthly Recurring Revenue", "value": "$248,479", "suffix": "", "description": "+18.3% vs Jan 2026", "trend": "up" },
      "style": { "span": 12 } },
    { "id": "stat-users", "type": "Stat",
      "props": { "label": "Active Users", "value": "12,840", "delta": "+4.2%", "trend": "up", "sparkline": [10200, 10800, 11100, 11600, 12000, 12400, 12840] },
      "style": { "span": 4, "rounded": "lg", "shadow": "sm" } },
    { "id": "stat-churn", "type": "Stat",
      "props": { "label": "Churn Rate", "value": "2.1%", "delta": "-0.4pp", "trend": "down", "sparkline": [3.2, 3.0, 2.8, 2.6, 2.5, 2.3, 2.1] },
      "style": { "span": 4, "rounded": "lg", "shadow": "sm" } },
    { "id": "stat-arpu", "type": "Stat",
      "props": { "label": "ARPU", "value": "$19.34", "delta": "+$1.20", "trend": "up", "sparkline": [16.2, 17.1, 17.8, 18.0, 18.5, 18.9, 19.34] },
      "style": { "span": 4, "rounded": "lg", "shadow": "sm" } }
  ]
}}
\`\`\`

## Bento — asymmetric chart + KPI + timeline sidebar
\`\`\`json
{ "op": "setRoot", "node": {
  "id": "root", "type": "Grid", "props": { "gap": 6, "layoutPreset": "bento" },
  "children": [
    { "id": "chart-revenue", "type": "Chart",
      "props": { "title": "Revenue vs. Cost", "subtitle": "Jan–Jun 2026", "kind": "area",
        "series": ["Revenue", "Cost"],
        "data": [
          {"label":"Jan","Revenue":41200,"Cost":28400},
          {"label":"Feb","Revenue":48700,"Cost":31200},
          {"label":"Mar","Revenue":45900,"Cost":29800},
          {"label":"Apr","Revenue":62300,"Cost":33100},
          {"label":"May","Revenue":71800,"Cost":38700},
          {"label":"Jun","Revenue":89400,"Cost":41200}
        ] },
      "style": { "span": 8 } },
    { "id": "metric-margin", "type": "Metric",
      "props": { "label": "Gross Margin", "value": "54.2", "suffix": "%", "description": "+6.1pp vs H1 2025", "trend": "up" },
      "style": { "span": 4 } },
    { "id": "activity", "type": "Timeline",
      "props": { "items": [
        { "id": "t1", "title": "Enterprise plan upgrade", "description": "Acme Corp → $2,400/mo", "timestamp": "2h ago", "status": "done" },
        { "id": "t2", "title": "Churn alert: 3 accounts at risk", "description": "Usage dropped >40% in 14 days", "timestamp": "5h ago", "status": "current" },
        { "id": "t3", "title": "Q2 billing cycle closed", "description": "$1.24M collected", "timestamp": "Yesterday", "status": "done" }
      ] },
      "style": { "span": 8 } },
    { "id": "ring-nps", "type": "RingProgress",
      "props": { "value": 72, "label": "NPS Score", "size": "lg" },
      "style": { "span": 4 } }
  ]
}}
\`\`\`

## Catalog + filter — TagGroup + EmptyState + real data
\`\`\`json
{ "op": "setRoot", "node": {
  "id": "root", "type": "Grid", "props": { "gap": 6 },
  "children": [
    { "id": "section-header", "type": "Section",
      "props": { "title": "Product Catalog", "description": "147 products across 6 categories" },
      "style": { "span": 12 } },
    { "id": "filter-tags", "type": "TagGroup",
      "props": { "tags": [
        { "label": "Electronics", "variant": "blue" },
        { "label": "Apparel", "variant": "purple" },
        { "label": "Home & Garden", "variant": "green" },
        { "label": "Sports", "variant": "amber" },
        { "label": "Beauty", "variant": "red" }
      ] },
      "style": { "span": 12 } },
    { "id": "catalog-table", "type": "Table",
      "props": {
        "columns": ["Product", "Category", "Price", "Stock", "Status"],
        "rows": [
          ["AirFlow Pro Headphones", "Electronics", "$149.00", "284", "In Stock"],
          ["Merino Wool Crewneck", "Apparel", "$89.00", "47", "Low Stock"],
          ["Bamboo Cutting Board Set", "Home & Garden", "$34.00", "0", "Out of Stock"],
          ["Trail Running Shoes X9", "Sports", "$124.00", "193", "In Stock"],
          ["Vitamin C Serum 30ml", "Beauty", "$42.00", "612", "In Stock"]
        ]
      },
      "style": { "span": 12 } }
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
   End every "message" with 1–2 brief follow-up suggestions: "Next I could add sparklines
   to each stat, or break this down by region — just ask."

2. Ids are stable and descriptive. Reuse them when editing — the UI animates in place.
   "stat-mrr" beats "n1". "chart-revenue-trend" beats "chart1".

3. Use the smallest patch set. setRoot only for a brand-new surface or full redesign.

4. Root is always a Grid. Children control width via style.span (1–12).

5. HIERARCHY IS MANDATORY. A layout where everything is the same width is a failed
   design. Every dashboard needs exactly one dominant element:
   • Use Metric (not Stat) when ONE number should visually own a section — large
     tabular font, centered, prefix ("$") or suffix ("%").
   • Dominant element (hero Metric, featured Chart): span 8–12
   • Supporting KPIs in a row: span 3–4 (three or four across)
   • Secondary charts: span 6
   • Tables, Sections, full-width elements: span 12
   • Never: four Stats all at span:3 with no larger anchor. Always place the big
     story first, then the supporting details.

6. Set props.layoutPreset on Grid nodes to signal layout intent:
   • "bento"  — hero(8) + sidebar(4), then balanced pairs. Asymmetric, editorial.
   • "hero"   — full-width hero first, then span-4 supporting cards below
   • "split"  — 7/5 alternating pairs; content + context
   • "sidebar-detail" — 3-col nav + 9-col content pane
   • "thirds" — equal span-4 thirds; feature comparisons, stat rows
   • "feed"   — full-width items; logs, activity, articles

7. Cards always have rounded:"lg" and shadow:"sm" minimum. A card with no radius
   looks like 2010. A card with no padding is broken. These are not optional.

8. REAL DATA TELLS STORIES. Never use placeholder values.
   • Currency: "$248,479" not "$250,000". "$19.34" not "$20".
   • Percentages: "18.3%" not "20%". "-0.4pp" not "-1%".
   • Dates: "Jan–Jun 2026", "Q2 2026", "2h ago", "Yesterday" — not "Period 1".
   • Names: "Acme Corp", "Jordan Lee", "Trail Running Shoes X9" — not "User A".
   • Trend data should actually trend — rising, dipping, recovering, NOT flat.
   • A chart with 3 identical bars is worse than no chart.

9. Charts always have title + subtitle + at least 5–6 data points forming a visible
   pattern. Use series:["A","B"] for grouped comparisons (two series max for clarity).

10. TYPOGRAPHY HAS MEANING. Use Heading level 1 for the page title (once, at top).
    Use Heading level 2 for section titles. Use Heading level 3 for card headers.
    Use Text for narrative paragraphs — not for data labels. Never wall-of-text.
    If you use Heading, do NOT duplicate it with a Section title — pick one.

11. Use EmptyState when a section has no data yet. Use TagGroup for category filters,
    labels, and multi-value selections — it shows range. Use Timeline for activity
    feeds, audit logs, and step-by-step processes. Use Stepper for onboarding flows,
    setup checklists, and any numbered multi-step sequence — always set `current`
    to the active step index. Use Callout to highlight one important insight per
    section (info/success/warning/error).

12. If the user only asks a question, answer in "message" with empty "patches".

13. DATA DENSITY WITHOUT CLUTTER. Stats are more alive with a mini-trend:
    add "sparkline": [n1, n2, ..., n7] to any Stat prop to show the last 7 periods
    in the top-right corner — no extra space needed. Use RingProgress for percentages
    and completion rates (goals, NPS, utilization). Both add information density
    without adding noise. Default to including sparkline on every KPI Stat.

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
