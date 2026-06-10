"use client";

import {
  BrandProvider,
  DashboardRenderer,
  brandPresets,
  useRuntime,
  type BrandPresetName,
} from "@autogen-ui/core";
import { useState } from "react";
import { revenueSeed } from "@/lib/seed";

/**
 * Same dashboard, six brand kits. The swatches sit below the demo so the
 * affordance is quiet — the surface itself is the subject.
 */
export function BrandSwitcher() {
  const [name, setName] = useState<BrandPresetName>("violet");
  const { data, state, dispatch } = useRuntime(revenueSeed);

  return (
    <div>
      <BrandProvider kit={brandPresets[name]}>
        <div className="overflow-hidden rounded-3xl border border-border bg-card/40 p-8 transition-colors duration-500 sm:p-12">
          <DashboardRenderer
            dashboard={revenueSeed}
            context={{ data, state, dispatch }}
          />
        </div>
      </BrandProvider>
      <div className="mt-8 flex items-center justify-center gap-2">
        {(Object.keys(brandPresets) as BrandPresetName[]).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setName(n)}
            aria-pressed={name === n}
            aria-label={`Switch to ${n} theme`}
            title={n}
            className={`grid h-7 w-7 place-items-center rounded-full border transition-all ${
              name === n
                ? "border-foreground/30 ring-2 ring-ring/30 ring-offset-2 ring-offset-background"
                : "border-border hover:border-foreground/20"
            }`}
          >
            <span
              className="h-3.5 w-3.5 rounded-full"
              style={{
                background: `hsl(${brandPresets[n].colors?.primary ?? "0 0% 50%"})`,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
