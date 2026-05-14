"use client";

import { createElement, type ReactNode } from "react";
import { cn } from "../utils";
import { num, oneOf, str } from "./helpers";
import type { RegistryComponent } from "./types";

/**
 * Low-level layout primitives. These carry almost no opinion of their own —
 * styling comes from the node's `style` (compiled by the renderer) — so the
 * model can assemble novel layouts without new component code.
 *
 * `Divider` already exists in `primitives.tsx` and is not redefined here.
 */

/* ------------------------------------------------------------------ *
 * Box — generic container
 * ------------------------------------------------------------------ */

const BOX_TAGS = ["div", "section", "article", "header", "footer", "nav", "aside", "main"] as const;
type BoxTag = (typeof BOX_TAGS)[number];

/** Generic container. Renders a `div` (or `as` tag) wrapping its children. */
export const Box: RegistryComponent = ({ children, as }) => {
  const tag: BoxTag = oneOf(as, BOX_TAGS, "div");
  return createElement(tag, null, children);
};

/* ------------------------------------------------------------------ *
 * Image
 * ------------------------------------------------------------------ */

const IMG_ROUNDED: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

const IMG_ASPECT: Record<string, string> = {
  auto: "aspect-auto",
  square: "aspect-square",
  video: "aspect-video",
};

/** Image with `object-cover`. Props: `src`, `alt`, `rounded`, `aspect`. */
export const Image: RegistryComponent = ({ src, alt, rounded, aspect }) => {
  const r = oneOf(rounded, ["none", "sm", "md", "lg", "xl", "2xl", "full"] as const, "md");
  const a = oneOf(aspect, ["auto", "square", "video"] as const, "auto");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={str(src)}
      alt={str(alt)}
      className={cn("h-full w-full object-cover", IMG_ROUNDED[r], IMG_ASPECT[a])}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Icon — small built-in inline-SVG set
 * ------------------------------------------------------------------ */

const ICON_NAMES = [
  "check",
  "x",
  "arrow-up",
  "arrow-down",
  "star",
  "bolt",
  "dot",
  "chevron-right",
] as const;
type IconName = (typeof ICON_NAMES)[number];

const ICON_PATHS: Record<IconName, ReactNode> = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  "arrow-up": <path d="M12 19V5M5 12l7-7 7 7" />,
  "arrow-down": <path d="M12 5v14M19 12l-7 7-7-7" />,
  star: (
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  ),
  bolt: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />,
  dot: <circle cx="12" cy="12" r="4" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
};

/** Inline SVG icon from a small built-in set. Props: `name`, `size`. */
export const Icon: RegistryComponent = ({ name, size }) => {
  const n: IconName = oneOf(name, ICON_NAMES, "dot");
  const s = num(size, 16);
  const filled = n === "dot";
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block shrink-0"
      role="img"
      aria-label={n}
    >
      {ICON_PATHS[n]}
    </svg>
  );
};

/* ------------------------------------------------------------------ *
 * Spacer
 * ------------------------------------------------------------------ */

/** Flexible spacer that absorbs free space inside a flex container. */
export const Spacer: RegistryComponent = () => <div className="flex-1" aria-hidden="true" />;
