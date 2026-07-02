// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardRenderer } from "./renderer";
import { emptyDashboard, type Dashboard } from "./schema";

afterEach(cleanup);

function dash(children: Dashboard["root"]["children"]): Dashboard {
  const d = emptyDashboard("render");
  return { ...d, root: { id: "root", type: "Grid", props: { gap: 4 }, children } };
}

describe("DashboardRenderer", () => {
  it("renders primitive text content (Heading, Text)", () => {
    render(
      <DashboardRenderer
        dashboard={dash([
          { id: "h", type: "Heading", props: { text: "Revenue up 12%", level: 2 } },
          { id: "t", type: "Text", props: { text: "Driven by enterprise expansion." } },
        ])}
      />,
    );
    expect(screen.getByText("Revenue up 12%")).toBeTruthy();
    expect(screen.getByText("Driven by enterprise expansion.")).toBeTruthy();
  });

  it("renders a Stat's label and value", () => {
    render(
      <DashboardRenderer
        dashboard={dash([{ id: "s", type: "Stat", props: { label: "Active Users", value: "12,840" } }])}
      />,
    );
    expect(screen.getByText("Active Users")).toBeTruthy();
  });

  it("resolves a bound prop from context state", () => {
    render(
      <DashboardRenderer
        dashboard={dash([{ id: "t", type: "Text", props: {}, bindings: { text: "{{state.msg}}" } }])}
        context={{ state: { msg: "Hello from state" } }}
      />,
    );
    expect(screen.getByText("Hello from state")).toBeTruthy();
  });

  it("skips a node whose `when` gate is falsy", () => {
    render(
      <DashboardRenderer
        dashboard={dash([
          { id: "shown", type: "Text", props: { text: "VISIBLE" } },
          { id: "hidden", type: "Text", props: { text: "SECRET" }, when: "{{state.show}}" },
        ])}
        context={{ state: { show: false } }}
      />,
    );
    expect(screen.getByText("VISIBLE")).toBeTruthy();
    expect(screen.queryByText("SECRET")).toBeNull();
  });

  it("does not crash on an unknown component type", () => {
    expect(() =>
      render(<DashboardRenderer dashboard={dash([{ id: "u", type: "NotARealComponent" } as never])} />),
    ).not.toThrow();
  });
});
