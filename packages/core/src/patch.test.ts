import { describe, expect, it } from "vitest";
import { applyPatch, applyPatches, findNode, validatePatchTargets } from "./patch";
import { emptyDashboard, type Dashboard, type Patch, type UINode } from "./schema";

function seed(): Dashboard {
  const d = emptyDashboard("seed");
  return {
    ...d,
    root: {
      id: "root",
      type: "Grid",
      props: { gap: 4 },
      children: [
        { id: "a", type: "Stat", props: { label: "A", value: "1" } },
        { id: "b", type: "Card", props: { title: "B" }, children: [
          { id: "b1", type: "Text", props: { text: "hi" } },
        ] },
      ],
    },
  };
}

describe("applyPatch — tree structure", () => {
  it("setRoot replaces the whole root", () => {
    const d = seed();
    const node: UINode = { id: "root2", type: "Grid", children: [] };
    const out = applyPatch(d, { op: "setRoot", node });
    expect(out.root.id).toBe("root2");
  });

  it("update merges props without dropping existing ones", () => {
    const d = seed();
    const out = applyPatch(d, { op: "update", id: "a", props: { value: "2" } });
    const a = findNode(out.root, "a")!;
    expect(a.props).toEqual({ label: "A", value: "2" });
  });

  it("append adds a child at the end by default", () => {
    const d = seed();
    const out = applyPatch(d, {
      op: "append",
      parentId: "root",
      node: { id: "c", type: "Divider" },
    });
    expect(out.root.children?.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("append honors an explicit index", () => {
    const d = seed();
    const out = applyPatch(d, {
      op: "append",
      parentId: "root",
      node: { id: "c", type: "Divider" },
      index: 0,
    });
    expect(out.root.children?.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("remove deletes a node but never the root", () => {
    const d = seed();
    expect(applyPatch(d, { op: "remove", id: "a" }).root.children?.map((c) => c.id)).toEqual(["b"]);
    expect(applyPatch(d, { op: "remove", id: "root" }).root.id).toBe("root");
  });

  it("move relocates a node under a new parent", () => {
    const d = seed();
    const out = applyPatch(d, { op: "move", id: "a", parentId: "b" });
    expect(out.root.children?.map((c) => c.id)).toEqual(["b"]);
    expect(findNode(out.root, "b")?.children?.map((c) => c.id)).toEqual(["b1", "a"]);
  });

  it("replace swaps a node in place", () => {
    const d = seed();
    const out = applyPatch(d, {
      op: "replace",
      id: "a",
      node: { id: "a", type: "Badge", props: { label: "X" } },
    });
    expect(findNode(out.root, "a")?.type).toBe("Badge");
  });
});

describe("applyPatch — style / bindings / events / state", () => {
  it("setStyle sets and clears", () => {
    const d = seed();
    const withStyle = applyPatch(d, { op: "setStyle", id: "a", style: { span: 6 } });
    expect(findNode(withStyle.root, "a")?.style).toEqual({ span: 6 });
    const cleared = applyPatch(withStyle, { op: "setStyle", id: "a", style: null });
    expect(findNode(cleared.root, "a")?.style).toBeUndefined();
  });

  it("setBindings and setEvents attach and clear", () => {
    const d = seed();
    const b = applyPatch(d, { op: "setBindings", id: "a", bindings: { value: "{{state.x}}" } });
    expect(findNode(b.root, "a")?.bindings).toEqual({ value: "{{state.x}}" });
    const e = applyPatch(b, {
      op: "setEvents",
      id: "a",
      events: { onClick: [{ type: "setState", path: "x", value: 1 }] },
    });
    expect(findNode(e.root, "a")?.events?.onClick).toHaveLength(1);
  });

  it("setState writes a dot-path into state", () => {
    const d = seed();
    const out = applyPatch(d, { op: "setState", path: "filters.range", value: "30d" });
    const filters = (out.state as Record<string, Record<string, unknown>>).filters;
    expect(filters?.range).toBe("30d");
  });
});

describe("applyPatch — screens & layout (Phase 0 additions)", () => {
  it("setScreen / removeScreen add and drop named screens", () => {
    const d = seed();
    const withScreen = applyPatch(d, {
      op: "setScreen",
      name: "settings",
      node: { id: "settings_root", type: "Grid", children: [] },
    });
    expect(withScreen.screens?.settings?.id).toBe("settings_root");
    const dropped = applyPatch(withScreen, { op: "removeScreen", name: "settings" });
    expect(dropped.screens).toBeUndefined();
  });

  it("setLayout sets and clears the persistent layout", () => {
    const d = seed();
    const layout: UINode = { id: "shell", type: "Grid", children: [{ id: "o", type: "Outlet" }] };
    const withLayout = applyPatch(d, { op: "setLayout", node: layout });
    expect(withLayout.layout?.id).toBe("shell");
    expect(applyPatch(withLayout, { op: "setLayout", node: null }).layout).toBeUndefined();
  });
});

describe("applyPatch — immutability & no-ops", () => {
  it("does not mutate the input dashboard", () => {
    const d = seed();
    const snapshot = JSON.stringify(d);
    applyPatch(d, { op: "update", id: "a", props: { value: "999" } });
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  it("treats an unknown target id as a no-op", () => {
    const d = seed();
    const out = applyPatch(d, { op: "update", id: "nope", props: { value: "x" } });
    expect(JSON.stringify(out.root)).toBe(JSON.stringify(d.root));
  });

  it("applyPatches folds a batch in order", () => {
    const d = seed();
    const patches: Patch[] = [
      { op: "update", id: "a", props: { value: "2" } },
      { op: "append", parentId: "root", node: { id: "c", type: "Divider" } },
      { op: "remove", id: "b" },
    ];
    const out = applyPatches(d, patches);
    expect(out.root.children?.map((c) => c.id)).toEqual(["a", "c"]);
    expect(findNode(out.root, "a")?.props?.value).toBe("2");
  });
});

describe("validatePatchTargets — hallucinated id detection", () => {
  it("flags updates/appends to ids that do not exist", () => {
    const d = seed();
    const warnings = validatePatchTargets(d, [
      { op: "update", id: "ghost", props: {} },
      { op: "append", parentId: "phantom", node: { id: "z", type: "Divider" } },
    ]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/ghost/);
    expect(warnings[1]).toMatch(/phantom/);
  });

  it("does not flag ids created earlier in the same batch", () => {
    const d = seed();
    const warnings = validatePatchTargets(d, [
      { op: "append", parentId: "root", node: { id: "new", type: "Card" } },
      { op: "update", id: "new", props: { title: "T" } },
    ]);
    expect(warnings).toHaveLength(0);
  });
});
