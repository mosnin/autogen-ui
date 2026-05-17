"use client";

import {
  DashboardRenderer,
  parseDashboard,
  useRuntime,
} from "@autogen-ui/core";
import { useMemo } from "react";

// The canonical controlled-input loop: an Input whose `value` is bound to
// `state.q` and whose `onChange` writes `{{event.value}}` back to `state.q`.
// A second Text node echoes the live value.
export default function FormDemo() {
  const dashboard = useMemo(
    () =>
      parseDashboard({
        id: "form-demo",
        state: { q: "" },
        root: {
          id: "root",
          type: "Stack",
          props: { direction: "col", gap: 4 },
          children: [
            {
              id: "input",
              type: "Input",
              props: { placeholder: "Type something..." },
              bindings: { value: "{{state.q}}" },
              events: {
                onChange: [
                  { type: "setState", path: "q", value: "{{event.value}}" },
                ],
              },
            },
            {
              id: "echo",
              type: "Text",
              props: { text: "" },
              bindings: { text: "You typed: {{state.q | default:nothing yet}}" },
            },
          ],
        },
      }),
    [],
  );

  const { data, state, dispatch } = useRuntime(dashboard);

  return (
    <div className="my-6 rounded-xl border border-border bg-card/40 p-5">
      <DashboardRenderer
        dashboard={dashboard}
        context={{ data, state, dispatch }}
      />
      <div className="mt-4 border-t border-border pt-3 font-mono text-xs text-muted-foreground">
        state ={" "}
        <span className="text-foreground/80">{JSON.stringify(state)}</span>
      </div>
    </div>
  );
}
