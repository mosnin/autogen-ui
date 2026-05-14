import type { CompiledStyle } from "./runtime";
import type { StyleCore, StyleSpec, UINode } from "./schema";
import { cn } from "./utils";

/**
 * Style engine: turns a token-based `StyleSpec` into Tailwind classes.
 *
 * Tailwind's scanner only sees literal, complete class strings, so every
 * class is spelled out in explicit lookup maps below. Class names are never
 * built by string interpolation. Responsive (`sm`/`md`/`lg`) and state
 * (`hover`/`focus`) partials are compiled with a prefix; the prefixed maps
 * are pre-generated and the full set is also concatenated into
 * `STATIC_SAFELIST` so the scanner sees them.
 *
 * Note: `span` is intentionally NOT compiled here — the renderer owns the
 * grid-span wrapper class.
 */

type Prefix = "" | "sm:" | "md:" | "lg:" | "hover:" | "focus:";

const PREFIXES: Prefix[] = ["", "sm:", "md:", "lg:", "hover:", "focus:"];

/* ------------------------------------------------------------------ *
 * Base (unprefixed) lookup maps — one literal class per enum value.
 * ------------------------------------------------------------------ */

const DISPLAY: Record<string, string> = {
  block: "block",
  flex: "flex",
  grid: "grid",
  "inline-flex": "inline-flex",
  hidden: "hidden",
};

const DIRECTION: Record<string, string> = {
  row: "flex-row",
  col: "flex-col",
};

const ALIGN: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const JUSTIFY: Record<string, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

const GAP: Record<number, string> = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  8: "gap-8",
  10: "gap-10",
  12: "gap-12",
  16: "gap-16",
};

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
  11: "grid-cols-11",
  12: "grid-cols-12",
};

const P: Record<number, string> = {
  0: "p-0", 1: "p-1", 2: "p-2", 3: "p-3", 4: "p-4",
  5: "p-5", 6: "p-6", 8: "p-8", 10: "p-10", 12: "p-12", 16: "p-16",
};
const PX: Record<number, string> = {
  0: "px-0", 1: "px-1", 2: "px-2", 3: "px-3", 4: "px-4",
  5: "px-5", 6: "px-6", 8: "px-8", 10: "px-10", 12: "px-12", 16: "px-16",
};
const PY: Record<number, string> = {
  0: "py-0", 1: "py-1", 2: "py-2", 3: "py-3", 4: "py-4",
  5: "py-5", 6: "py-6", 8: "py-8", 10: "py-10", 12: "py-12", 16: "py-16",
};
const PT: Record<number, string> = {
  0: "pt-0", 1: "pt-1", 2: "pt-2", 3: "pt-3", 4: "pt-4",
  5: "pt-5", 6: "pt-6", 8: "pt-8", 10: "pt-10", 12: "pt-12", 16: "pt-16",
};
const PB: Record<number, string> = {
  0: "pb-0", 1: "pb-1", 2: "pb-2", 3: "pb-3", 4: "pb-4",
  5: "pb-5", 6: "pb-6", 8: "pb-8", 10: "pb-10", 12: "pb-12", 16: "pb-16",
};
const M: Record<number, string> = {
  0: "m-0", 1: "m-1", 2: "m-2", 3: "m-3", 4: "m-4",
  5: "m-5", 6: "m-6", 8: "m-8", 10: "m-10", 12: "m-12", 16: "m-16",
};
const MX: Record<number, string> = {
  0: "mx-0", 1: "mx-1", 2: "mx-2", 3: "mx-3", 4: "mx-4",
  5: "mx-5", 6: "mx-6", 8: "mx-8", 10: "mx-10", 12: "mx-12", 16: "mx-16",
};
const MY: Record<number, string> = {
  0: "my-0", 1: "my-1", 2: "my-2", 3: "my-3", 4: "my-4",
  5: "my-5", 6: "my-6", 8: "my-8", 10: "my-10", 12: "my-12", 16: "my-16",
};

const BG: Record<string, string> = {
  background: "bg-background",
  foreground: "bg-foreground",
  card: "bg-card",
  "card-foreground": "bg-card-foreground",
  primary: "bg-primary",
  "primary-foreground": "bg-primary-foreground",
  secondary: "bg-secondary",
  "secondary-foreground": "bg-secondary-foreground",
  muted: "bg-muted",
  "muted-foreground": "bg-muted-foreground",
  accent: "bg-accent",
  "accent-foreground": "bg-accent-foreground",
  border: "bg-border",
  transparent: "bg-transparent",
};

const COLOR: Record<string, string> = {
  background: "text-background",
  foreground: "text-foreground",
  card: "text-card",
  "card-foreground": "text-card-foreground",
  primary: "text-primary",
  "primary-foreground": "text-primary-foreground",
  secondary: "text-secondary",
  "secondary-foreground": "text-secondary-foreground",
  muted: "text-muted",
  "muted-foreground": "text-muted-foreground",
  accent: "text-accent",
  "accent-foreground": "text-accent-foreground",
  border: "text-border",
  transparent: "text-transparent",
};

const BORDER_COLOR: Record<string, string> = {
  background: "border-background",
  foreground: "border-foreground",
  card: "border-card",
  "card-foreground": "border-card-foreground",
  primary: "border-primary",
  "primary-foreground": "border-primary-foreground",
  secondary: "border-secondary",
  "secondary-foreground": "border-secondary-foreground",
  muted: "border-muted",
  "muted-foreground": "border-muted-foreground",
  accent: "border-accent",
  "accent-foreground": "border-accent-foreground",
  border: "border-border",
  transparent: "border-transparent",
};

const BORDER_WIDTH: Record<number, string> = {
  0: "border-0",
  1: "border",
  2: "border-2",
};

const ROUNDED: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

const SHADOW: Record<string, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
};

const OPACITY: Record<number, string> = {
  0: "opacity-0",
  25: "opacity-25",
  50: "opacity-50",
  75: "opacity-75",
  100: "opacity-100",
};

const FONT_SIZE: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "4xl": "text-4xl",
};

const FONT_WEIGHT: Record<string, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const TEXT_ALIGN: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const WIDTH: Record<string, string> = {
  auto: "w-auto",
  full: "w-full",
  fit: "w-fit",
  screen: "w-screen",
  min: "w-min",
  max: "w-max",
};

const HEIGHT: Record<string, string> = {
  auto: "h-auto",
  full: "h-full",
  fit: "h-fit",
  screen: "h-screen",
};

const WRAP = "flex-wrap";
const ITALIC = "italic";
const TRUNCATE = "truncate";
const GROW = "grow";

/* ------------------------------------------------------------------ *
 * Prefixed-map generation. Tailwind needs to see literal prefixed
 * strings, so every base class is also emitted with each prefix into
 * STATIC_SAFELIST. The prefix is applied at runtime via `withPrefix`,
 * and the safelist guarantees the scanner has already seen the result.
 * ------------------------------------------------------------------ */

function withPrefix(prefix: Prefix, cls: string | undefined): string | undefined {
  if (!cls) return undefined;
  if (prefix === "") return cls;
  return cls
    .split(" ")
    .map((c) => `${prefix}${c}`)
    .join(" ");
}

/** Collect every class string a given core field map can produce. */
function allValues(map: Record<string | number, string>): string[] {
  return Object.values(map);
}

const ALL_BASE_CLASSES: string[] = [
  ...allValues(DISPLAY),
  ...allValues(DIRECTION),
  ...allValues(ALIGN),
  ...allValues(JUSTIFY),
  ...allValues(GAP),
  ...allValues(GRID_COLS),
  ...allValues(P),
  ...allValues(PX),
  ...allValues(PY),
  ...allValues(PT),
  ...allValues(PB),
  ...allValues(M),
  ...allValues(MX),
  ...allValues(MY),
  ...allValues(BG),
  ...allValues(COLOR),
  ...allValues(BORDER_COLOR),
  ...allValues(BORDER_WIDTH),
  ...allValues(ROUNDED),
  ...allValues(SHADOW),
  ...allValues(OPACITY),
  ...allValues(FONT_SIZE),
  ...allValues(FONT_WEIGHT),
  ...allValues(TEXT_ALIGN),
  ...allValues(WIDTH),
  ...allValues(HEIGHT),
  WRAP,
  ITALIC,
  TRUNCATE,
  GROW,
];

/**
 * Every class this engine can emit, including all prefixed variants —
 * concatenated so Tailwind's scanner sees literal complete strings.
 * Include this somewhere in scanned source (or a Tailwind safelist).
 */
export const STATIC_SAFELIST: string = PREFIXES.flatMap((prefix) =>
  ALL_BASE_CLASSES.map((c) => withPrefix(prefix, c) as string),
).join(" ");

/* ------------------------------------------------------------------ *
 * Core compiler
 * ------------------------------------------------------------------ */

/** Compile a single `StyleCore` partial to classes, prepending `prefix`. */
function coreToClasses(core: StyleCore, prefix: Prefix): string[] {
  const out: (string | undefined)[] = [];

  if (core.display !== undefined) out.push(withPrefix(prefix, DISPLAY[core.display]));
  if (core.direction !== undefined) out.push(withPrefix(prefix, DIRECTION[core.direction]));
  if (core.align !== undefined) out.push(withPrefix(prefix, ALIGN[core.align]));
  if (core.justify !== undefined) out.push(withPrefix(prefix, JUSTIFY[core.justify]));
  if (core.wrap) out.push(withPrefix(prefix, WRAP));
  if (core.gap !== undefined) out.push(withPrefix(prefix, GAP[core.gap]));
  if (core.gridCols !== undefined) out.push(withPrefix(prefix, GRID_COLS[core.gridCols]));

  // span is intentionally skipped — the renderer owns grid-span classes.

  if (core.width !== undefined) out.push(withPrefix(prefix, WIDTH[core.width]));
  if (core.height !== undefined) out.push(withPrefix(prefix, HEIGHT[core.height]));
  if (core.grow) out.push(withPrefix(prefix, GROW));

  if (core.p !== undefined) out.push(withPrefix(prefix, P[core.p]));
  if (core.px !== undefined) out.push(withPrefix(prefix, PX[core.px]));
  if (core.py !== undefined) out.push(withPrefix(prefix, PY[core.py]));
  if (core.pt !== undefined) out.push(withPrefix(prefix, PT[core.pt]));
  if (core.pb !== undefined) out.push(withPrefix(prefix, PB[core.pb]));
  if (core.m !== undefined) out.push(withPrefix(prefix, M[core.m]));
  if (core.mx !== undefined) out.push(withPrefix(prefix, MX[core.mx]));
  if (core.my !== undefined) out.push(withPrefix(prefix, MY[core.my]));

  if (core.bg !== undefined) out.push(withPrefix(prefix, BG[core.bg]));
  if (core.color !== undefined) out.push(withPrefix(prefix, COLOR[core.color]));
  if (core.borderColor !== undefined) out.push(withPrefix(prefix, BORDER_COLOR[core.borderColor]));
  if (core.borderWidth !== undefined) out.push(withPrefix(prefix, BORDER_WIDTH[core.borderWidth]));
  if (core.rounded !== undefined) out.push(withPrefix(prefix, ROUNDED[core.rounded]));
  if (core.shadow !== undefined) out.push(withPrefix(prefix, SHADOW[core.shadow]));

  if (core.fontSize !== undefined) out.push(withPrefix(prefix, FONT_SIZE[core.fontSize]));
  if (core.fontWeight !== undefined) out.push(withPrefix(prefix, FONT_WEIGHT[core.fontWeight]));
  if (core.textAlign !== undefined) out.push(withPrefix(prefix, TEXT_ALIGN[core.textAlign]));
  if (core.italic) out.push(withPrefix(prefix, ITALIC));
  if (core.truncate) out.push(withPrefix(prefix, TRUNCATE));

  return out.filter((c): c is string => Boolean(c));
}

/** Pull only the `StyleCore` fields out of a full `StyleSpec`. */
function pickCore(spec: StyleSpec): StyleCore {
  const { sm, md, lg, hover, focus, className, ...core } = spec;
  void sm;
  void md;
  void lg;
  void hover;
  void focus;
  void className;
  return core;
}

/**
 * Compile a `StyleSpec` into a `CompiledStyle` (className + inline style).
 * Pure; `node` is accepted for parity with `RendererExtensions.compileStyle`
 * but the renderer owns the grid span, so it is not consulted here.
 */
export function compileStyle(style: StyleSpec, node: UINode): CompiledStyle {
  void node;

  const classes: string[] = [
    ...coreToClasses(pickCore(style), ""),
    ...(style.sm ? coreToClasses(style.sm, "sm:") : []),
    ...(style.md ? coreToClasses(style.md, "md:") : []),
    ...(style.lg ? coreToClasses(style.lg, "lg:") : []),
    ...(style.hover ? coreToClasses(style.hover, "hover:") : []),
    ...(style.focus ? coreToClasses(style.focus, "focus:") : []),
  ];

  // `opacity` is a free 0-100 number; emit the nearest stepped utility,
  // and fall back to inline style for arbitrary values.
  const inline: CompiledStyle["style"] = {};
  if (style.opacity !== undefined) {
    const stepped = OPACITY[style.opacity];
    if (stepped) classes.push(stepped);
    else inline.opacity = style.opacity / 100;
  }

  const className = cn(...classes, style.className) || undefined;
  const hasInline = Object.keys(inline).length > 0;

  return {
    ...(className ? { className } : {}),
    ...(hasInline ? { style: inline } : {}),
  };
}
