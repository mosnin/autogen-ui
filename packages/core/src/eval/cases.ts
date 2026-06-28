import { emptyDashboard, type Dashboard } from "../schema";
import { assertValidPatches, type EvalCase } from "./harness";

/**
 * Illustrative golden cases for generation quality. They are model-agnostic:
 * run them against `createFakeClient` with scripted replies in unit tests, or
 * against a real agent in CI. Each `expect` runs `assertValidPatches` plus a
 * case-specific assertion.
 */

/** A small seeded dashboard used by the edit/restyle cases. */
function seededDashboard(): Dashboard {
  const d = emptyDashboard("seeded");
  return {
    ...d,
    title: "Sales",
    root: {
      id: "root",
      type: "Grid",
      props: { gap: 4 },
      children: [
        { id: "revenue-stat", type: "Stat", props: { label: "Revenue", value: "$0" } },
      ],
    },
  };
}

export const goldenCases: EvalCase[] = [
  {
    name: "build: new sales dashboard from scratch",
    messages: [{ role: "user", content: "Build me a sales dashboard with a few KPIs." }],
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      if (result.patches.length === 0) return "expected patches that build a dashboard";
      const buildsTree = result.patches.some(
        (p) => p.op === "setRoot" || p.op === "append" || p.op === "replace",
      );
      return buildsTree ? null : "expected a setRoot/append/replace to build the tree";
    },
  },
  {
    name: "edit: update an existing node's props",
    messages: [{ role: "user", content: "Change the revenue figure to $1.2M." }],
    dashboard: seededDashboard(),
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      const update = result.patches.find((p) => p.op === "update");
      if (!update || update.op !== "update") return "expected an update patch";
      return update.id === "revenue-stat"
        ? null
        : `update should target "revenue-stat", got "${update.id}"`;
    },
  },
  {
    name: "question: answer without mutating",
    messages: [{ role: "user", content: "What does the revenue stat currently show?" }],
    dashboard: seededDashboard(),
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      if (result.patches.length !== 0) return "a pure question should yield empty patches";
      return result.message && result.message.trim().length > 0
        ? null
        : "expected a non-empty message answering the question";
    },
  },
  {
    name: "restyle: adjust a node's style",
    messages: [{ role: "user", content: "Make the revenue stat stand out — bigger and bold." }],
    dashboard: seededDashboard(),
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      const styled = result.patches.some(
        (p) => p.op === "setStyle" && p.id === "revenue-stat",
      );
      return styled ? null : "expected a setStyle patch targeting revenue-stat";
    },
  },
  {
    name: "define: create a reusable component",
    messages: [{ role: "user", content: "Define a reusable KpiCard component I can reuse." }],
    dashboard: seededDashboard(),
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      const def = result.patches.find((p) => p.op === "defineComponent");
      if (!def || def.op !== "defineComponent") return "expected a defineComponent patch";
      return /^[A-Z][A-Za-z0-9]*$/.test(def.def.name)
        ? null
        : `component name "${def.def.name}" is not PascalCase`;
    },
  },
  {
    name: "visual: hero dashboard has varied spans",
    messages: [
      {
        role: "user",
        content: "Build a SaaS metrics dashboard with MRR, churn, and a revenue chart.",
      },
    ],
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      if (result.patches.length === 0) return "expected patches";
      // Find all nodes that have explicit spans
      const spans = new Set<number>();
      function collectSpans(patches: typeof result.patches) {
        for (const p of patches) {
          if (p.op === "setRoot") collectNodeSpans(p.node);
          if (p.op === "append") collectNodeSpans(p.node);
          if (p.op === "replace") collectNodeSpans(p.node);
        }
      }
      function collectNodeSpans(node: { style?: { span?: number }; children?: typeof node[] }) {
        if (node.style?.span !== undefined) spans.add(node.style.span);
        for (const child of node.children ?? []) collectNodeSpans(child);
      }
      collectSpans(result.patches);
      return spans.size >= 2
        ? null
        : "expected at least 2 different span values — visual hierarchy requires variety";
    },
  },
  {
    name: "visual: cards have minimum polish (rounded + shadow)",
    messages: [
      { role: "user", content: "Build a card-based product overview with 3 feature cards." },
    ],
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      const cards: Array<{ style?: { rounded?: string; shadow?: string } }> = [];
      function collectCards(patches: typeof result.patches) {
        for (const p of patches) {
          if (p.op === "setRoot") walkForCards(p.node);
          if (p.op === "append") walkForCards(p.node);
          if (p.op === "replace") walkForCards(p.node);
        }
      }
      function walkForCards(node: { type?: string; style?: { rounded?: string; shadow?: string }; children?: typeof node[] }) {
        if (node.type === "Card") cards.push(node);
        for (const child of node.children ?? []) walkForCards(child);
      }
      collectCards(result.patches);
      if (cards.length === 0) return null; // no cards — not a failure of this test
      const unpolished = cards.filter((c) => !c.style?.rounded && !c.style?.shadow);
      return unpolished.length === 0
        ? null
        : `${unpolished.length} Card(s) missing rounded/shadow — cards need visual polish`;
    },
  },
  {
    name: "visual: chart includes title and non-empty data",
    messages: [
      { role: "user", content: "Show me a line chart of monthly sales for the past 6 months." },
    ],
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      let chartFound = false;
      let chartHasTitle = false;
      let chartHasData = false;
      function checkCharts(patches: typeof result.patches) {
        for (const p of patches) {
          if (p.op === "setRoot") walkCharts(p.node);
          if (p.op === "append") walkCharts(p.node);
          if (p.op === "replace") walkCharts(p.node);
        }
      }
      function walkCharts(node: { type?: string; props?: Record<string, unknown>; children?: typeof node[] }) {
        if (node.type === "Chart") {
          chartFound = true;
          if (typeof node.props?.title === "string" && node.props.title.trim()) chartHasTitle = true;
          const data = node.props?.data;
          if (Array.isArray(data) && data.length >= 3) chartHasData = true;
        }
        for (const child of node.children ?? []) walkCharts(child);
      }
      checkCharts(result.patches);
      if (!chartFound) return "expected a Chart node";
      if (!chartHasTitle) return "Chart missing title prop";
      if (!chartHasData) return "Chart needs at least 3 data points";
      return null;
    },
  },
  {
    name: "visual: uses TagGroup or EmptyState where appropriate",
    messages: [
      { role: "user", content: "Build a product catalog dashboard with category filtering and an empty results state." },
    ],
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      if (result.patches.length === 0) return "expected patches";
      let hasTagOrEmpty = false;
      function walk(node: { type?: string; children?: typeof node[] }) {
        if (node.type === "TagGroup" || node.type === "Tag" || node.type === "EmptyState") {
          hasTagOrEmpty = true;
        }
        for (const child of node.children ?? []) walk(child);
      }
      for (const p of result.patches) {
        if (p.op === "setRoot") walk(p.node);
        if (p.op === "append") walk(p.node);
        if (p.op === "replace") walk(p.node);
      }
      return hasTagOrEmpty ? null : "expected TagGroup, Tag, or EmptyState for catalog + filter UI";
    },
  },
  {
    name: "visual: Metric used for the single most important KPI",
    messages: [
      { role: "user", content: "Build an executive summary with the single most important business metric front and center, then supporting stats." },
    ],
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      let metricFound = false;
      function walk(node: { type?: string; children?: typeof node[] }) {
        if (node.type === "Metric") metricFound = true;
        for (const child of node.children ?? []) walk(child);
      }
      for (const p of result.patches) {
        if (p.op === "setRoot") walk(p.node);
        if (p.op === "append") walk(p.node);
        if (p.op === "replace") walk(p.node);
      }
      return metricFound ? null : "expected a Metric node for the hero KPI — Metric is for the single number that dominates the view";
    },
  },
  {
    name: "visual: RingProgress or Sparkline used in supporting role",
    messages: [
      { role: "user", content: "Show team performance — completion rates, trend lines, and individual stats." },
    ],
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      if (result.patches.length === 0) return "expected patches";
      let hasCompact = false;
      function walk(node: { type?: string; props?: Record<string, unknown>; children?: typeof node[] }) {
        if (node.type === "RingProgress" || node.type === "Sparkline") hasCompact = true;
        // Stat with sparkline prop also counts
        if (node.type === "Stat" && Array.isArray(node.props?.sparkline)) hasCompact = true;
        for (const child of node.children ?? []) walk(child);
      }
      for (const p of result.patches) {
        if (p.op === "setRoot") walk(p.node);
        if (p.op === "append") walk(p.node);
        if (p.op === "replace") walk(p.node);
      }
      return hasCompact ? null : "expected RingProgress, Sparkline, or Stat with sparkline prop — these add density without clutter";
    },
  },
  {
    name: "visual: Stat uses sparkline prop for mini trends",
    messages: [
      { role: "user", content: "Build a KPI dashboard with 4 key metrics. Each stat should show a mini trend line." },
    ],
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      if (result.patches.length === 0) return "expected patches";
      let statWithSparkline = false;
      function walk(node: { type?: string; props?: Record<string, unknown>; children?: typeof node[] }) {
        if (node.type === "Stat" && Array.isArray(node.props?.sparkline) && (node.props.sparkline as unknown[]).length >= 3) {
          statWithSparkline = true;
        }
        for (const child of node.children ?? []) walk(child);
      }
      for (const p of result.patches) {
        if (p.op === "setRoot") walk(p.node);
        if (p.op === "append") walk(p.node);
        if (p.op === "replace") walk(p.node);
      }
      return statWithSparkline ? null : "expected at least one Stat with a sparkline array prop for mini trend visualization";
    },
  },
  {
    name: "visual: Callout used for insight, not just a text block",
    messages: [
      { role: "user", content: "Build a marketing campaign dashboard. Surface the most important insight prominently." },
    ],
    expect: (result) => {
      const base = assertValidPatches(result);
      if (base) return base;
      if (result.patches.length === 0) return "expected patches";
      let calloutFound = false;
      function walk(node: { type?: string; children?: typeof node[] }) {
        if (node.type === "Callout") calloutFound = true;
        for (const child of node.children ?? []) walk(child);
      }
      for (const p of result.patches) {
        if (p.op === "setRoot") walk(p.node);
        if (p.op === "append") walk(p.node);
        if (p.op === "replace") walk(p.node);
      }
      return calloutFound ? null : "expected a Callout to surface the key insight — Callout is specifically for actionable, prominent messages";
    },
  },
];
