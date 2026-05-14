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
];
