import { describe, expect, it } from "vitest";
import {
  emptyDashboard,
  migrateDashboard,
  nodeIdSchema,
  patchSchema,
  SPEC_VERSION,
  uiNodeSchema,
} from "./schema";

describe("nodeIdSchema — injection hardening", () => {
  it("accepts ordinary ids", () => {
    for (const id of ["stat-mrr", "row__0", "chart:revenue.v2", "n_abc_1"]) {
      expect(nodeIdSchema.safeParse(id).success).toBe(true);
    }
  });
  it("rejects HTML-significant characters", () => {
    for (const id of ['x"onx', "<script>", "a&b", "a>b", "a'b", "a`b"]) {
      expect(nodeIdSchema.safeParse(id).success).toBe(false);
    }
  });
  it("rejects empty ids", () => {
    expect(nodeIdSchema.safeParse("").success).toBe(false);
  });
});

describe("uiNodeSchema", () => {
  it("accepts a valid node tree", () => {
    const ok = uiNodeSchema.safeParse({
      id: "root",
      type: "Grid",
      children: [{ id: "a", type: "Stat", props: { label: "L", value: 1 } }],
    });
    expect(ok.success).toBe(true);
  });
  it("rejects a node whose id carries an injection payload", () => {
    expect(uiNodeSchema.safeParse({ id: 'x"><img>', type: "Stat" }).success).toBe(false);
  });
  it("rejects a node missing a type", () => {
    expect(uiNodeSchema.safeParse({ id: "a" }).success).toBe(false);
  });
});

describe("patchSchema", () => {
  it("validates a representative set of ops", () => {
    const ops = [
      { op: "setRoot", node: { id: "r", type: "Grid" } },
      { op: "update", id: "a", props: { x: 1 } },
      { op: "append", parentId: "r", node: { id: "b", type: "Card" } },
      { op: "setScreen", name: "settings", node: { id: "s", type: "Grid" } },
      { op: "removeScreen", name: "settings" },
      { op: "setLayout", node: null },
    ];
    for (const op of ops) expect(patchSchema.safeParse(op).success).toBe(true);
  });
  it("rejects an unknown op", () => {
    expect(patchSchema.safeParse({ op: "nuke", id: "a" }).success).toBe(false);
  });
});

describe("migrateDashboard", () => {
  it("stamps a versionless/legacy input to the current spec version", () => {
    const migrated = migrateDashboard({
      id: "legacy",
      root: { id: "root", type: "Grid", children: [] },
    });
    expect(migrated.version).toBe(SPEC_VERSION);
    expect(migrated.functions).toBeDefined();
  });
  it("round-trips a current dashboard", () => {
    const d = emptyDashboard("x");
    const migrated = migrateDashboard(d);
    expect(migrated.version).toBe(SPEC_VERSION);
    expect(migrated.id).toBe("x");
  });
});
