import type { CSSProperties } from "react";
import type { CompiledStyle, RendererExtensions } from "./runtime";
import type { StyleCore, StyleSpec, UINode } from "./schema";

/**
 * Style adapters — alternates to the default Tailwind-class compiler in
 * `./style`. Use these when the host doesn't use Tailwind (styled-components,
 * Emotion, vanilla CSS, Tamagui, ...). They emit only inline `CSSProperties`
 * referencing the same CSS variables the preset defines, so swapping in this
 * compiler keeps the BrandKit story intact.
 *
 * Pass into `<DashboardRenderer extensions={{ compileStyle: createInlineStyleCompiler() }} />`.
 */

const SPACING_PX: Record<number, string> = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
};

const FONT_SIZE_REM: Record<string, string> = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
};

const FONT_WEIGHT: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

const RADIUS_REM: Record<string, string> = {
  none: "0",
  sm: "calc(var(--radius, 0.5rem) - 4px)",
  md: "calc(var(--radius, 0.5rem) - 2px)",
  lg: "var(--radius, 0.5rem)",
  xl: "calc(var(--radius, 0.5rem) + 4px)",
  "2xl": "calc(var(--radius, 0.5rem) + 8px)",
  full: "9999px",
};

const SHADOW: Record<string, string> = {
  none: "none",
  sm: "0 1px 2px 0 hsl(0 0% 0% / 0.05)",
  md: "0 4px 6px -1px hsl(0 0% 0% / 0.1), 0 2px 4px -2px hsl(0 0% 0% / 0.1)",
  lg: "0 10px 15px -3px hsl(0 0% 0% / 0.1), 0 4px 6px -4px hsl(0 0% 0% / 0.1)",
  xl: "0 20px 25px -5px hsl(0 0% 0% / 0.1), 0 8px 10px -6px hsl(0 0% 0% / 0.1)",
};

function colorVar(token: string): string {
  // The BrandKit/preset tokens are written as HSL triplets without hsl().
  // We resolve via the same `hsl(var(--token))` pattern.
  const mapping: Record<string, string> = {
    background: "--background",
    foreground: "--foreground",
    card: "--card",
    "card-foreground": "--card-foreground",
    primary: "--primary",
    "primary-foreground": "--primary-foreground",
    secondary: "--secondary",
    "secondary-foreground": "--secondary-foreground",
    muted: "--muted",
    "muted-foreground": "--muted-foreground",
    accent: "--accent",
    "accent-foreground": "--accent-foreground",
    border: "--border",
    transparent: "transparent",
  };
  const cssVar = mapping[token];
  if (!cssVar) return "currentColor";
  if (cssVar === "transparent") return "transparent";
  return `hsl(var(${cssVar}))`;
}

function coreToStyle(core: StyleCore): CSSProperties {
  const s: CSSProperties = {};
  if (core.display) s.display = core.display;
  if (core.direction === "row") s.flexDirection = "row";
  if (core.direction === "col") s.flexDirection = "column";
  if (core.align) {
    s.alignItems = core.align === "start" ? "flex-start" : core.align === "end" ? "flex-end" : core.align;
  }
  if (core.justify) {
    s.justifyContent =
      core.justify === "start"
        ? "flex-start"
        : core.justify === "end"
          ? "flex-end"
          : core.justify === "between"
            ? "space-between"
            : core.justify === "around"
              ? "space-around"
              : core.justify === "evenly"
                ? "space-evenly"
                : "center";
  }
  if (core.wrap) s.flexWrap = "wrap";
  if (core.gap !== undefined && SPACING_PX[core.gap] !== undefined) s.gap = SPACING_PX[core.gap];

  if (core.width === "full") s.width = "100%";
  if (core.width === "screen") s.width = "100vw";
  if (core.width === "fit") s.width = "fit-content";
  if (core.height === "full") s.height = "100%";
  if (core.height === "screen") s.height = "100vh";
  if (core.height === "fit") s.height = "fit-content";
  if (core.grow) s.flexGrow = 1;

  if (core.p !== undefined && SPACING_PX[core.p] !== undefined) s.padding = SPACING_PX[core.p];
  if (core.px !== undefined && SPACING_PX[core.px] !== undefined) {
    s.paddingLeft = SPACING_PX[core.px];
    s.paddingRight = SPACING_PX[core.px];
  }
  if (core.py !== undefined && SPACING_PX[core.py] !== undefined) {
    s.paddingTop = SPACING_PX[core.py];
    s.paddingBottom = SPACING_PX[core.py];
  }
  if (core.pt !== undefined && SPACING_PX[core.pt] !== undefined) s.paddingTop = SPACING_PX[core.pt];
  if (core.pb !== undefined && SPACING_PX[core.pb] !== undefined) s.paddingBottom = SPACING_PX[core.pb];
  if (core.m !== undefined && SPACING_PX[core.m] !== undefined) s.margin = SPACING_PX[core.m];
  if (core.mx !== undefined && SPACING_PX[core.mx] !== undefined) {
    s.marginLeft = SPACING_PX[core.mx];
    s.marginRight = SPACING_PX[core.mx];
  }
  if (core.my !== undefined && SPACING_PX[core.my] !== undefined) {
    s.marginTop = SPACING_PX[core.my];
    s.marginBottom = SPACING_PX[core.my];
  }

  if (core.bg) s.backgroundColor = colorVar(core.bg);
  if (core.color) s.color = colorVar(core.color);
  if (core.borderColor) s.borderColor = colorVar(core.borderColor);
  if (core.borderWidth !== undefined) s.borderWidth = `${core.borderWidth}px`;
  if (core.rounded && RADIUS_REM[core.rounded]) s.borderRadius = RADIUS_REM[core.rounded];
  if (core.shadow && SHADOW[core.shadow]) s.boxShadow = SHADOW[core.shadow];

  if (core.fontSize && FONT_SIZE_REM[core.fontSize]) s.fontSize = FONT_SIZE_REM[core.fontSize];
  if (core.fontWeight && FONT_WEIGHT[core.fontWeight] !== undefined) s.fontWeight = FONT_WEIGHT[core.fontWeight];
  if (core.textAlign) s.textAlign = core.textAlign;
  if (core.italic) s.fontStyle = "italic";
  if (core.truncate) {
    s.overflow = "hidden";
    s.textOverflow = "ellipsis";
    s.whiteSpace = "nowrap";
  }
  return s;
}

export interface InlineStyleCompilerOptions {
  /** Optional default `style` merged before per-node styles. */
  base?: CSSProperties;
}

/**
 * Inline-style compiler. Translates the same `StyleSpec` vocabulary the
 * Tailwind compiler accepts, but emits a single `CSSProperties` object so
 * non-Tailwind hosts can use the framework without Tailwind in their build.
 *
 * Responsive overrides (`sm`/`md`/`lg`) and state variants (`hover`/`focus`)
 * are dropped because inline styles can't express them. Hosts needing those
 * should stay on the Tailwind compiler.
 */
export function createInlineStyleCompiler(
  opts: InlineStyleCompilerOptions = {},
): NonNullable<RendererExtensions["compileStyle"]> {
  return (style: StyleSpec, _node: UINode): CompiledStyle => {
    void _node;
    const core = coreToStyle(style as StyleCore);
    const out: CSSProperties = { ...(opts.base ?? {}), ...core };
    if (style.opacity !== undefined) out.opacity = style.opacity / 100;
    return Object.keys(out).length > 0 ? { style: out } : {};
  };
}
