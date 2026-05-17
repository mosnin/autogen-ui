"use client";

import {
  DashboardRenderer,
  parseDashboard,
  useRuntime,
  type Dashboard,
} from "@autogen-ui/core";
import { useMemo, useState } from "react";

// A live binding demo. The slider mutates a local React value, which is fed
// in via the Dashboard's `state` so the binding expression sees it through
// the standard {{state.x | filter}} pipeline.
export default function BindingPlayground() {
  const [value, setValue] = useState(1234.56);

  const dashboard = useMemo<Dashboard>(
    () =>
      parseDashboard({
        id: "binding-demo",
        state: { x: value },
        root: {
          id: "root",
          type: "Grid",
          props: { gap: 4 },
          children: [
            {
              id: "raw",
              type: "Text",
              bindings: { text: "raw value = {{state.x}}" },
              props: { text: "" },
            },
            {
              id: "currency",
              type: "Text",
              bindings: { text: "currency = {{state.x | currency:USD}}" },
              props: { text: "" },
            },
            {
              id: "percent",
              type: "Text",
              bindings: { text: "percent = {{state.x | percent:2}}" },
              props: { text: "" },
            },
            {
              id: "number",
              type: "Text",
              bindings: { text: "number = {{state.x | number:1}}" },
              props: { text: "" },
            },
          ],
        },
      }),
    [value],
  );

  const { data, state, dispatch } = useRuntime(dashboard);

  return (
    <div className="my-6 rounded-xl border border-border bg-card/40 p-5">
      <label className="block text-xs uppercase tracking-wider text-muted-foreground">
        state.x
      </label>
      <input
        type="range"
        min={0}
        max={5000}
        step={0.01}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mt-2 w-full"
      />
      <div className="mt-1 font-mono text-xs text-muted-foreground">
        {value.toFixed(2)}
      </div>
      <div className="mt-4">
        <DashboardRenderer
          dashboard={dashboard}
          context={{ data, state, dispatch }}
        />
      </div>
    </div>
  );
}
