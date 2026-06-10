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
 * Same dashboard, six brand kits. Click a swatch and watch the entire
 * surface re-skin — that's the BrandKit story made tactile.
 */
export function BrandSwitcher() {
  const [name, setName] = useState<BrandPresetName>("violet");
  const { data, state, dispatch } = useRuntime(revenueSeed);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Your brand · live
        </div>
        <div className="flex items-center gap-1.5">
          {(Object.keys(brandPresets) as BrandPresetName[]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setName(n)}
              aria-pressed={name === n}
              title={n}
              className={`grid h-6 w-6 place-items-center rounded-md border transition-all ${
                name === n
                  ? "border-foreground/30 ring-2 ring-ring/40"
                  : "border-border hover:border-foreground/20"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  background: `hsl(${brandPresets[n].colors?.primary ?? "0 0% 50%"})`,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <BrandProvider kit={brandPresets[name]}>
        <div className="bg-background p-6 transition-colors duration-500">
          <DashboardRenderer
            dashboard={revenueSeed}
            context={{ data, state, dispatch }}
          />
        </div>
      </BrandProvider>
    </div>
  );
}
