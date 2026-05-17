"use client";

import {
  DashboardRenderer,
  parseDashboard,
  useRuntime,
  type Dashboard,
} from "@autogen-ui/core";
import { useMemo } from "react";

// A live preview of a hardcoded Dashboard spec. Used throughout the docs to
// show what the renderer produces for a given JSON shape.
//
// The spec input is the partial Dashboard shape an author would actually
// write — version/components/dataSources/state default in via parseDashboard.
export type DemoSpec = Partial<Dashboard> & Pick<Dashboard, "id" | "root">;

export interface DemoProps {
  spec: DemoSpec;
  /** Optional caption rendered above the live render. */
  caption?: string;
}

export default function Demo({ spec, caption }: DemoProps) {
  // parseDashboard fills in defaults (components: {}, dataSources: {}, state: {}, version).
  const dashboard = useMemo(() => parseDashboard(spec), [spec]);
  const { data, state, dispatch } = useRuntime(dashboard);

  return (
    <div className="my-6 rounded-xl border border-border bg-card/40 p-5">
      {caption && (
        <div className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          {caption}
        </div>
      )}
      <DashboardRenderer
        dashboard={dashboard}
        context={{ data, state, dispatch }}
      />
    </div>
  );
}
