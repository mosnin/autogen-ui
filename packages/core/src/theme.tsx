"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "./schema";
import { cn } from "./utils";

/**
 * Theme layer: converts a `Theme` (HSL-triplet color tokens + radius) into
 * CSS custom properties matching the conventions in `styles.css`, and a
 * `<ThemeProvider>` client component that applies them to a wrapping div.
 */

const RADIUS: Record<string, string> = {
  none: "0rem",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
};

/**
 * Convert a `Theme` into a `CSSProperties` map of CSS custom properties:
 * each `colors` entry becomes `--<name>` (HSL triplet, no wrapper), and
 * `radius` becomes `--radius`.
 */
export function themeToCssVars(theme: Theme): CSSProperties {
  const vars: Record<string, string> = {};

  if (theme.colors) {
    for (const [name, value] of Object.entries(theme.colors)) {
      if (typeof value === "string") vars[`--${name}`] = value;
    }
  }

  if (theme.radius !== undefined) {
    const r = RADIUS[theme.radius];
    if (r) vars["--radius"] = r;
  }

  return vars as CSSProperties;
}

export interface ThemeProviderProps {
  theme: Theme;
  children?: ReactNode;
  className?: string;
}

/**
 * Applies a `Theme` to its subtree: sets the theme's CSS custom properties
 * on a wrapping div and toggles the `dark` class when `theme.mode` is
 * `"dark"`. The optional `font` is applied as the div's `font-family`.
 */
export function ThemeProvider({ theme, children, className }: ThemeProviderProps) {
  const style: CSSProperties = { ...themeToCssVars(theme) };
  if (theme.font) style.fontFamily = theme.font;

  return (
    <div className={cn(theme.mode === "dark" && "dark", className)} style={style}>
      {children}
    </div>
  );
}
