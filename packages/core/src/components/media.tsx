"use client";

import { cn } from "../utils";
import { bool, num, oneOf, str } from "./helpers";
import type { ComponentRegistry, RegistryComponent } from "./types";
import type { ComponentDoc } from "../registry";

/* ------------------------------------------------------------------ *
 * Avatar
 * ------------------------------------------------------------------ */

const AVATAR_SIZES = ["sm", "md", "lg", "xl"] as const;

const AVATAR_PX: Record<(typeof AVATAR_SIZES)[number], number> = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 56,
};

const AVATAR_TEXT: Record<(typeof AVATAR_SIZES)[number], string> = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-base",
};

const AVATAR_DOT: Record<(typeof AVATAR_SIZES)[number], string> = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
  xl: "h-3 w-3",
};

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

export const Avatar: RegistryComponent = ({ src, name, size, online }) => {
  const s = oneOf(size, AVATAR_SIZES, "md");
  const px = AVATAR_PX[s];
  const source = str(src);
  const label = str(name);
  const isOnline = bool(online, false);

  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: px, height: px }}
      aria-label={label || undefined}
    >
      {source ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={label}
          className="h-full w-full rounded-full object-cover border border-border"
        />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full",
            "bg-primary text-primary-foreground font-semibold select-none",
            AVATAR_TEXT[s],
          )}
        >
          {initialsFor(label)}
        </span>
      )}
      {isOnline && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-background bg-emerald-500",
            AVATAR_DOT[s],
          )}
        />
      )}
    </span>
  );
};

/* ------------------------------------------------------------------ *
 * Skeleton
 * ------------------------------------------------------------------ */

const SKELETON_HEIGHTS = ["sm", "md", "lg"] as const;

const SKELETON_H: Record<(typeof SKELETON_HEIGHTS)[number], string> = {
  sm: "h-3",
  md: "h-4",
  lg: "h-6",
};

export const Skeleton: RegistryComponent = ({ lines, height }) => {
  const count = Math.max(1, num(lines, 1));
  const h = oneOf(height, SKELETON_HEIGHTS, "md");
  return (
    <div className="flex flex-col gap-2 w-full" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => {
        const isLast = i === count - 1 && count > 1;
        return (
          <div
            key={i}
            className={cn(
              "animate-pulse rounded-md bg-muted",
              SKELETON_H[h],
              isLast ? "w-2/3" : "w-full",
            )}
          />
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * CodeBlock
 * ------------------------------------------------------------------ */

export const CodeBlock: RegistryComponent = ({ code, language }) => {
  const lang = str(language);
  return (
    <div className="relative rounded-lg border border-border bg-muted/50 overflow-hidden">
      {lang && (
        <span
          className={cn(
            "absolute right-2 top-2 rounded-full border border-border bg-background",
            "px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide",
          )}
        >
          {lang}
        </span>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-foreground">{str(code)}</code>
      </pre>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Quote
 * ------------------------------------------------------------------ */

export const Quote: RegistryComponent = ({ text, author }) => {
  const who = str(author);
  return (
    <blockquote className="border-l-4 border-primary pl-4 py-1 italic text-foreground">
      <p className="text-sm leading-relaxed">{str(text)}</p>
      {who && <footer className="mt-2 text-xs not-italic text-muted-foreground">— {who}</footer>}
    </blockquote>
  );
};

/* ------------------------------------------------------------------ *
 * Kbd
 * ------------------------------------------------------------------ */

export const Kbd: RegistryComponent = ({ keys }) => {
  const parts = str(keys)
    .split(/\s*\+\s*/)
    .filter(Boolean);
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {parts.map((k, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          <kbd
            className={cn(
              "inline-flex items-center justify-center rounded-md border border-border bg-muted",
              "px-1.5 py-0.5 text-[11px] font-medium font-mono text-foreground shadow-sm min-w-[1.5rem]",
            )}
          >
            {k}
          </kbd>
          {i < parts.length - 1 && (
            <span className="text-muted-foreground text-xs" aria-hidden="true">
              +
            </span>
          )}
        </span>
      ))}
    </span>
  );
};

/* ------------------------------------------------------------------ *
 * Registry, catalog, default spans
 * ------------------------------------------------------------------ */

export const mediaComponents: ComponentRegistry = {
  Avatar,
  Skeleton,
  CodeBlock,
  Quote,
  Kbd,
};

export const mediaCatalog: ComponentDoc[] = [
  {
    type: "Avatar",
    description:
      "User avatar. Shows the image at `src`, or falls back to initials from `name`. Optional online indicator.",
    props: "src?: string, name?: string, size?: 'sm'|'md'|'lg'|'xl', online?: boolean",
    acceptsChildren: false,
  },
  {
    type: "Skeleton",
    description: "Animated placeholder bars used while content is loading.",
    props: "lines?: number (default 1), height?: 'sm'|'md'|'lg'",
    acceptsChildren: false,
  },
  {
    type: "CodeBlock",
    description: "Monospaced code block with a language pill in the top-right (label only, no highlighting).",
    props: "code: string, language?: string",
    acceptsChildren: false,
  },
  {
    type: "Quote",
    description: "Left-bordered blockquote with optional author footer.",
    props: "text: string, author?: string",
    acceptsChildren: false,
  },
  {
    type: "Kbd",
    description: "Inline keyboard hint, e.g. '⌘ + K' or 'Ctrl + S'. Splits on '+'.",
    props: "keys: string",
    acceptsChildren: false,
  },
];

export const mediaDefaultSpans: Record<string, number> = {
  Avatar: 2,
  Skeleton: 6,
  CodeBlock: 12,
  Quote: 12,
  Kbd: 2,
};
