import { describe, expect, it } from "vitest";
import { prepareServerSpec, renderDashboardPlaceholder } from "./server-render";
import { emptyDashboard, type Dashboard } from "./schema";

function withChildren(): Dashboard {
  const d = emptyDashboard("ssr");
  return {
    ...d,
    root: {
      id: "root",
      type: "Grid",
      children: [
        { id: "s1", type: "Stat", props: { label: "MRR", value: 1 }, style: { span: 3 } },
        { id: "c1", type: "Chart", props: { kind: "area", data: [] }, style: { span: 9 } },
      ],
    },
  };
}

describe("prepareServerSpec", () => {
  it("enumerates top-level ids in order and estimates a positive height", () => {
    const spec = prepareServerSpec(withChildren());
    expect(spec.topLevelIds).toEqual(["s1", "c1"]);
    expect(spec.estimatedHeight).toBeGreaterThan(0);
  });
});

describe("renderDashboardPlaceholder — XSS escaping", () => {
  it("escapes an id that would break out of the data-id attribute", () => {
    const d = emptyDashboard("x");
    const malicious: Dashboard = {
      ...d,
      root: {
        id: "root",
        type: "Grid",
        // Cast: we are deliberately bypassing the schema to prove the RENDERER
        // escapes even if an un-validated spec reaches it (defense in depth).
        children: [{ id: 'x" onmouseover="alert(1)', type: "Stat" } as never],
      },
    };
    const html = renderDashboardPlaceholder(malicious);
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).toContain("&quot;");
  });

  it("escapes angle brackets so no tag can be injected via an id", () => {
    const d = emptyDashboard("x");
    const malicious: Dashboard = {
      ...d,
      root: { id: "root", type: "Grid", children: [{ id: "<script>evil</script>", type: "Stat" } as never] },
    };
    const html = renderDashboardPlaceholder(malicious);
    expect(html).not.toContain("<script>evil");
    expect(html).toContain("&lt;script&gt;");
  });

  it("clamps span to the 1-12 grid range", () => {
    const d = emptyDashboard("x");
    const wild: Dashboard = {
      ...d,
      root: { id: "root", type: "Grid", children: [{ id: "s", type: "Stat", style: { span: 999 } } as never] },
    };
    const html = renderDashboardPlaceholder(wild);
    // 12/12 => 100%, never > 100
    expect(html).toContain("width:100%");
  });
});
