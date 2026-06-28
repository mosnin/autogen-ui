// Probe REAL generation quality. Unlike the eval suite (which drives a scripted
// fake client to test the plumbing), this hits a real model and measures what it
// actually emits: hallucinated id references, missing required props, unknown
// component types, whether edits reuse ids (animate in place) vs redraw, and
// basic structural sanity. Each final dashboard spec is dumped to disk so you
// can eyeball the actual output.
//
//   ANTHROPIC_API_KEY=sk-...  pnpm --filter @autogen-ui/core probe:llm
//   OPENAI_API_KEY=sk-...     pnpm --filter @autogen-ui/core probe:llm
//
// Optional env:
//   AUTOGEN_UI_MODEL=...        override the model id
//   AUTOGEN_UI_PROBE_OUT=dir    where to dump specs (default ./.probe-output)
//   AUTOGEN_UI_PROBE_ONLY=name  run only scenarios whose name includes this
//
// Exits 2 (skip) when no API key is set.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyPatches,
  createUIAgent,
  defaultCapabilities,
  emptyDashboard,
  type AgentResponse,
  type ChatMessage,
  type Dashboard,
  type Patch,
  type TurnInfo,
  type UINode,
} from "../src/index";
import { createAnthropicClient, createOpenAIClient } from "../src/clients/index";
import { defaultRegistry } from "../src/registry";
import { validatePatchProps } from "../src/component-schemas";

/* ------------------------------------------------------------------ *
 * Client resolution
 * ------------------------------------------------------------------ */

function resolveClient() {
  const model = process.env.AUTOGEN_UI_MODEL || undefined;
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY, model, maxTokens: 8192 });
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY, model });
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Scenarios — cold prompts that stress different axes. Multi-turn ones
 * also measure whether the model edits in place (reuses ids) on turn 2+.
 * ------------------------------------------------------------------ */

interface Scenario {
  name: string;
  turns: string[];
}

const SCENARIOS: Scenario[] = [
  {
    name: "revenue-dashboard (build + edit)",
    turns: [
      "Build a SaaS revenue dashboard with MRR, churn rate, active users, and a revenue-over-time chart. Use realistic sample data.",
      "Make the revenue chart full width and add a table of the top 5 customers by spend.",
    ],
  },
  {
    name: "interactive-filter (state + bindings + actions)",
    turns: [
      "Build an orders dashboard with a search Input bound to state.q, a status Select, and a Table. Wire the inputs to state with onChange actions. Include sample data.",
    ],
  },
  {
    name: "multi-screen-app (screens + layout + icons)",
    turns: [
      "Build an admin app with three screens (Home, Analytics, Settings) using a persistent layout with a sidebar and an Outlet. Put an Icon next to each nav item and wire navigation.",
    ],
  },
  {
    name: "contact-form (forms + validation)",
    turns: [
      "Build a contact form with a name field, an email field that validates as an email, a message textarea, a subscribe switch, and a submit button. Wire it to state.",
    ],
  },
  {
    name: "data-density (Metric + RingProgress + Sparkline + Callout)",
    turns: [
      "Build an executive health dashboard: one dominant hero Metric for MRR, three KPI Stats with sparklines, two RingProgress rings for NPS and utilization, and a Callout highlighting the most important insight.",
    ],
  },
  {
    name: "catalog-filter (TagGroup + Table + EmptyState)",
    turns: [
      "Build a product catalog with a TagGroup for category filters, a Table of products, and an EmptyState that shows when no category is selected. Use realistic product data.",
    ],
  },
  {
    name: "activity-flow (Timeline + Stepper + bento layout)",
    turns: [
      "Build an onboarding dashboard with a Stepper showing progress through 4 steps, a Timeline of recent account events, and a bento-layout hero card with a welcome Metric.",
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Tree helpers + scoring
 * ------------------------------------------------------------------ */

function walk(node: UINode, acc: UINode[]): void {
  acc.push(node);
  for (const child of node.children ?? []) walk(child, acc);
}

function allNodes(d: Dashboard): UINode[] {
  const acc: UINode[] = [];
  walk(d.root, acc);
  if (d.layout) walk(d.layout, acc);
  for (const screen of Object.values(d.screens ?? {})) walk(screen, acc);
  return acc;
}

function collectIds(d: Dashboard): Set<string> {
  return new Set(allNodes(d).map((n) => n.id));
}

function maxDepth(node: UINode): number {
  if (!node.children || node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(maxDepth));
}

const ID_TARGET_OPS = new Set([
  "update",
  "replace",
  "remove",
  "move",
  "setStyle",
  "setMotion",
  "setBindings",
  "setEvents",
]);

interface TurnScore {
  ok: boolean;
  error?: string;
  patchCount: number;
  warnings: number; // hallucinated id references
  propWarnings: number; // missing required / wrong-typed props
  unknownTypes: string[]; // node types with no registry entry / definition
  usedSetRoot: boolean;
  targetedExistingIds: number; // edit ops that hit a pre-existing id
  targetedMissingIds: number; // edit ops that hit an id not present before
  nodeCount: number;
  depth: number;
  rootIsGrid: boolean;
  attempts: number;
  durationMs: number;
  score: number;
}

function knownType(type: string, d: Dashboard): boolean {
  return type in defaultRegistry || type in (d.components ?? {}) || type === "Outlet";
}

function scoreTurn(
  res: AgentResponse,
  before: Dashboard,
  after: Dashboard,
  isEdit: boolean,
  turn: TurnInfo | null,
): TurnScore {
  const prevIds = collectIds(before);
  const patches = res.patches as Patch[];

  let targetedExisting = 0;
  let targetedMissing = 0;
  let usedSetRoot = false;
  for (const p of patches) {
    if (p.op === "setRoot") usedSetRoot = true;
    if (ID_TARGET_OPS.has(p.op)) {
      const id = (p as { id?: string }).id;
      if (id) (prevIds.has(id) ? (targetedExisting += 1) : (targetedMissing += 1));
    }
    if (p.op === "append" || p.op === "move") {
      const pid = (p as { parentId?: string }).parentId;
      if (pid) (prevIds.has(pid) ? (targetedExisting += 1) : (targetedMissing += 1));
    }
  }

  const nodes = allNodes(after);
  const unknownTypes = [...new Set(nodes.map((n) => n.type).filter((t) => !knownType(t, after)))];
  const propWarnings = validatePatchProps(patches).length;

  let score = 100;
  if ((res.warnings?.length ?? 0) > 0) score -= 25;
  if (propWarnings > 0) score -= 20;
  if (unknownTypes.length > 0) score -= 25;
  if (after.root.type !== "Grid") score -= 10;
  if (isEdit && usedSetRoot) score -= 15; // full redraw on an edit kills continuity
  if (isEdit && targetedExisting === 0 && targetedMissing === 0 && !usedSetRoot) score -= 10;

  return {
    ok: true,
    patchCount: patches.length,
    warnings: res.warnings?.length ?? 0,
    propWarnings,
    unknownTypes,
    usedSetRoot,
    targetedExistingIds: targetedExisting,
    targetedMissingIds: targetedMissing,
    nodeCount: nodes.length,
    depth: maxDepth(after.root),
    rootIsGrid: after.root.type === "Grid",
    attempts: turn?.attempts ?? 1,
    durationMs: turn?.durationMs ?? 0,
    score: Math.max(0, score),
  };
}

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

function pct(n: number): string {
  return `${n.toFixed(0)}%`;
}

async function main(): Promise<number> {
  const client = resolveClient();
  if (!client) {
    process.stdout.write(
      "\n[skip] No ANTHROPIC_API_KEY or OPENAI_API_KEY set — nothing to probe.\n" +
        "       ANTHROPIC_API_KEY=sk-... pnpm --filter @autogen-ui/core probe:llm\n\n",
    );
    return 2;
  }

  const outDir = process.env.AUTOGEN_UI_PROBE_OUT || ".probe-output";
  mkdirSync(outDir, { recursive: true });
  const only = process.env.AUTOGEN_UI_PROBE_ONLY;
  const scenarios = only ? SCENARIOS.filter((s) => s.name.includes(only)) : SCENARIOS;

  // Capture per-turn telemetry. repairOnWarnings stays OFF so hallucinated ids
  // surface as warnings we can measure instead of being silently retried away.
  // Boxed in an object so its type stays stable across the closure capture.
  const tele: { last: TurnInfo | null } = { last: null };
  const agent = createUIAgent({
    client,
    capabilities: defaultCapabilities,
    onTurn: (info) => {
      tele.last = info;
    },
  });

  process.stdout.write(`\nProbing generation quality with ${client.name}\n`);
  process.stdout.write(`Specs dumped to ${outDir}/\n`);
  process.stdout.write("(base catalog — the shadcn drop-in additionally lifts the 8-icon ceiling)\n");

  const allScores: TurnScore[] = [];

  for (const scenario of scenarios) {
    process.stdout.write(`\n# ${scenario.name}\n`);
    let dashboard: Dashboard = emptyDashboard();
    const messages: ChatMessage[] = [];

    for (let t = 0; t < scenario.turns.length; t++) {
      const prompt = scenario.turns[t]!;
      const isEdit = t > 0;
      messages.push({ role: "user", content: prompt });
      const before = dashboard;

      let score: TurnScore;
      try {
        tele.last = null;
        const res = await agent.run({ messages: [...messages], dashboard: before });
        dashboard = applyPatches(before, res.patches);
        messages.push({ role: "assistant", content: res.message ?? "" });
        score = scoreTurn(res, before, dashboard, isEdit, tele.last);
      } catch (err) {
        score = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          patchCount: 0,
          warnings: 0,
          propWarnings: 0,
          unknownTypes: [],
          usedSetRoot: false,
          targetedExistingIds: 0,
          targetedMissingIds: 0,
          nodeCount: 0,
          depth: 0,
          rootIsGrid: false,
          attempts: tele.last?.attempts ?? 1,
          durationMs: tele.last?.durationMs ?? 0,
          score: 0,
        };
      }
      allScores.push(score);

      const turnLabel = `  turn ${t + 1}${isEdit ? " (edit)" : ""}`;
      if (!score.ok) {
        process.stdout.write(`${turnLabel}: FAILED — ${score.error}\n`);
        continue;
      }
      const flags: string[] = [];
      if (score.warnings > 0) flags.push(`${score.warnings} hallucinated-id`);
      if (score.propWarnings > 0) flags.push(`${score.propWarnings} prop-issue`);
      if (score.unknownTypes.length > 0) flags.push(`unknown:${score.unknownTypes.join(",")}`);
      if (isEdit && score.usedSetRoot) flags.push("redrew-via-setRoot");
      if (!score.rootIsGrid) flags.push("root-not-Grid");
      process.stdout.write(
        `${turnLabel}: score ${score.score}/100 · ${score.patchCount} patches · ` +
          `${score.nodeCount} nodes · depth ${score.depth} · ${score.attempts} attempt(s) · ` +
          `${(score.durationMs / 1000).toFixed(1)}s` +
          (isEdit
            ? ` · ids hit existing/missing ${score.targetedExistingIds}/${score.targetedMissingIds}`
            : "") +
          (flags.length ? `\n          ⚠ ${flags.join(" · ")}` : " ✓") +
          "\n",
      );
    }

    const safe = scenario.name.replace(/[^a-z0-9]+/gi, "-");
    writeFileSync(join(outDir, `${safe}.json`), JSON.stringify(dashboard, null, 2));
  }

  /* Summary */
  const ran = allScores.filter((s) => s.ok);
  const failed = allScores.length - ran.length;
  const avg = ran.length ? ran.reduce((a, s) => a + s.score, 0) / ran.length : 0;
  const withWarnings = ran.filter((s) => s.warnings > 0).length;
  const withProp = ran.filter((s) => s.propWarnings > 0).length;
  const withUnknown = ran.filter((s) => s.unknownTypes.length > 0).length;

  process.stdout.write("\n— summary —\n");
  process.stdout.write(`  turns run:            ${ran.length} (${failed} failed)\n`);
  process.stdout.write(`  avg heuristic score:  ${avg.toFixed(0)}/100\n`);
  process.stdout.write(`  turns w/ hallucinated ids: ${withWarnings} (${pct((withWarnings / Math.max(ran.length, 1)) * 100)})\n`);
  process.stdout.write(`  turns w/ prop issues:      ${withProp} (${pct((withProp / Math.max(ran.length, 1)) * 100)})\n`);
  process.stdout.write(`  turns w/ unknown types:    ${withUnknown} (${pct((withUnknown / Math.max(ran.length, 1)) * 100)})\n`);
  process.stdout.write(
    "\nNote: the heuristic score measures spec *correctness*, not whether the UI\n" +
      "looks good. Open the dumped specs (or render them) to judge visual quality.\n\n",
  );

  return failed > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`\n[error] ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
