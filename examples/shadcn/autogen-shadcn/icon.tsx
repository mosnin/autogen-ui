"use client";

import { icons } from "lucide-react";
import type { ComponentType } from "react";
import type { RegistryComponent } from "@autogen-ui/core";

/**
 * Icon, backed by the full lucide-react set.
 *
 * The framework's built-in `Icon` ships eight hand-rolled SVG paths
 * (`check`, `x`, `arrow-up`, `arrow-down`, `star`, `bolt`, `dot`,
 * `chevron-right`). shadcn/ui already depends on lucide-react, so we throw
 * that ceiling out: this component resolves ANY lucide icon name at runtime.
 *
 * The agent emits kebab-case names (`shopping-cart`, `trending-up`); lucide
 * keys its `icons` record by PascalCase (`ShoppingCart`, `TrendingUp`), so we
 * normalise. Unknown names fall back to a neutral dot rather than throwing,
 * which keeps a hallucinated icon name from blanking out the surface.
 */

type IconCmp = ComponentType<{
  size?: number | string;
  className?: string;
  "aria-label"?: string;
  role?: string;
}>;

const ICONS = icons as unknown as Record<string, IconCmp | undefined>;

/** `shopping-cart` / `shopping cart` / `ShoppingCart` -> `ShoppingCart`. */
function toPascalCase(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join("");
}

export const LucideIcon: RegistryComponent = ({ name, size }) => {
  const raw = typeof name === "string" && name.trim() ? name : "circle-dot";
  const Cmp = ICONS[toPascalCase(raw)] ?? ICONS[raw] ?? ICONS.Circle;
  if (!Cmp) return null;
  const px = typeof size === "number" && Number.isFinite(size) ? size : 16;
  return <Cmp size={px} className="inline-block shrink-0" aria-label={raw} role="img" />;
};
