import { describe, expect, it } from "vitest";
import {
  builtinFilters,
  evaluateBinding,
  getPath,
  resolveBindings,
  selectPath,
} from "./data";
import type { RuntimeContext } from "./runtime";
import { emptyDashboard, type UINode } from "./schema";

function ctx(partial: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    dashboard: emptyDashboard(),
    data: {},
    state: {},
    loading: {},
    errors: {},
    scope: {},
    dispatch: () => {},
    ...partial,
  };
}

describe("getPath / selectPath", () => {
  it("reads nested dot-paths", () => {
    expect(getPath({ a: { b: { c: 3 } } }, "a.b.c")).toBe(3);
  });
  it("returns null for unknown paths (never throws)", () => {
    expect(getPath({ a: 1 }, "a.b.c")).toBeNull();
    expect(getPath(null, "x")).toBeNull();
  });
  it("selectPath returns the whole value when no path", () => {
    expect(selectPath({ x: 1 })).toEqual({ x: 1 });
    expect(selectPath({ items: [1, 2] }, "items")).toEqual([1, 2]);
  });
});

describe("builtinFilters — format", () => {
  it("currency formats numbers and passes through non-numbers", () => {
    expect(builtinFilters.currency!(1234.5, "USD")).toMatch(/\$1,234\.50/);
    expect(builtinFilters.currency!("n/a")).toBe("n/a");
  });
  it("percent respects digits arg", () => {
    expect(builtinFilters.percent!(0.183, "1")).toMatch(/18\.3%/);
  });
  it("upper/lower coerce and null-guard", () => {
    expect(builtinFilters.upper!("hi")).toBe("HI");
    expect(builtinFilters.lower!(null)).toBe("");
  });
  it("truncate adds an ellipsis past the limit", () => {
    expect(builtinFilters.truncate!("abcdef", "3")).toBe("abc…");
    expect(builtinFilters.truncate!("ab", "3")).toBe("ab");
  });
  it("default substitutes for null/empty only", () => {
    expect(builtinFilters.default!(null, "N/A")).toBe("N/A");
    expect(builtinFilters.default!("", "N/A")).toBe("N/A");
    expect(builtinFilters.default!(0, "N/A")).toBe(0);
  });
});

describe("builtinFilters — compute", () => {
  const rows = [{ v: 10 }, { v: 20 }, { v: 30 }];
  it("length/count over arrays, strings, objects", () => {
    expect(builtinFilters.length!([1, 2, 3])).toBe(3);
    expect(builtinFilters.count!("abcd")).toBe(4);
    expect(builtinFilters.length!({ a: 1, b: 2 })).toBe(2);
  });
  it("sum/avg with a field arg", () => {
    expect(builtinFilters.sum!(rows, "v")).toBe(60);
    expect(builtinFilters.avg!(rows, "v")).toBe(20);
  });
  it("sum ignores non-numeric entries", () => {
    expect(builtinFilters.sum!([1, "x", 2])).toBe(3);
  });
});

describe("evaluateBinding", () => {
  it("returns a typed value for a whole-string token", () => {
    expect(evaluateBinding("{{state.count}}", ctx({ state: { count: 42 } }))).toBe(42);
  });
  it("reads data.* paths", () => {
    expect(evaluateBinding("{{data.user.name}}", ctx({ data: { user: { name: "Ada" } } }))).toBe("Ada");
  });
  it("interpolates embedded tokens as a string", () => {
    const out = evaluateBinding("Hi {{state.name}}!", ctx({ state: { name: "Sam" } }));
    expect(out).toBe("Hi Sam!");
  });
  it("applies a pipe filter chain", () => {
    const out = evaluateBinding("{{data.mrr | currency:USD}}", ctx({ data: { mrr: 2480 } }));
    expect(out).toMatch(/\$2,480/);
  });
  it("resolves loading.* flags", () => {
    expect(evaluateBinding("{{loading.items}}", ctx({ loading: { items: true } }))).toBe(true);
  });
  it("scope (ForEach) takes precedence over data", () => {
    const c = ctx({ scope: { item: { name: "Row" } }, data: { item: { name: "Global" } } });
    expect(evaluateBinding("{{item.name}}", c)).toBe("Row");
  });
  it("unknown filter is a no-op passthrough", () => {
    expect(evaluateBinding("{{state.x | bogus}}", ctx({ state: { x: "keep" } }))).toBe("keep");
  });
  it("returns a plain string unchanged when it has no token", () => {
    expect(evaluateBinding("literal", ctx())).toBe("literal");
  });
});

describe("resolveBindings", () => {
  it("returns the same reference when there are no bindings", () => {
    const node: UINode = { id: "n", type: "Text", props: { text: "x" } };
    expect(resolveBindings(node, ctx())).toBe(node);
  });
  it("fills bound props from context", () => {
    const node: UINode = { id: "n", type: "Stat", props: {}, bindings: { value: "{{state.v}}" } };
    const out = resolveBindings(node, ctx({ state: { v: 7 } }));
    expect(out.props?.value).toBe(7);
    expect(out).not.toBe(node); // new object, input untouched
  });
});
