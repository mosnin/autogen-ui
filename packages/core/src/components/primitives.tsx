"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EASE_OUT } from "../_easing";
import { useRuntimeContext } from "../runtime-context";
import { cn } from "../utils";
import { arr, bool, num, oneOf, str } from "./helpers";
import type { RegistryComponent } from "./types";

/** Slugify a string for use as an `id` (lowercase, non-alphanum -> dash). */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

const GAP: Record<number, string> = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
};

/**
 * Responsive 12-column grid. Children control their own width via the
 * `span` prop, which the renderer turns into responsive column classes.
 */
export const Grid: RegistryComponent = ({ children, gap }) => (
  <div className={cn("grid grid-cols-1 sm:grid-cols-6 lg:grid-cols-12", GAP[num(gap, 6)] ?? "gap-6")}>
    {children}
  </div>
);

/** Vertical or horizontal flex stack. */
export const Stack: RegistryComponent = ({ children, direction, gap, align }) => {
  const dir = oneOf(direction, ["row", "col"] as const, "col");
  return (
    <div
      className={cn(
        "flex",
        dir === "row" ? "flex-row flex-wrap" : "flex-col",
        GAP[num(gap, 4)] ?? "gap-4",
        align === "center" && "items-center",
        align === "end" && "items-end",
      )}
    >
      {children}
    </div>
  );
};

/** A titled section header followed by its children. */
export const Section: RegistryComponent = ({ children, title, description }) => (
  <section className="space-y-6 py-4">
    {(str(title) || str(description)) && (
      <header className="space-y-1.5 pb-3 border-b border-border/60">
        {str(title) && (
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{str(title)}</h2>
        )}
        {str(description) && (
          <p className="text-sm text-muted-foreground leading-relaxed">{str(description)}</p>
        )}
      </header>
    )}
    {children}
  </section>
);

/** Card with refined depth and a 1px hover lift. Size with `span` (1-12). */
export const Card: RegistryComponent = ({ children, title, description }) => (
  <motion.div
    whileHover={{ y: -1 }}
    transition={{ duration: 0.18, ease: EASE_OUT }}
    className={cn(
      "rounded-lg border border-border bg-card text-card-foreground shadow-rest",
      "p-5 flex flex-col gap-3 h-full transition-shadow duration-200 hover:shadow-lift",
    )}
  >
    {(str(title) || str(description)) && (
      <div className="space-y-1">
        {str(title) && <h3 className="font-semibold leading-none tracking-tight">{str(title)}</h3>}
        {str(description) && (
          <p className="text-sm text-muted-foreground">{str(description)}</p>
        )}
      </div>
    )}
    {children}
  </motion.div>
);

/* ------------------------------------------------------------------ *
 * Display
 * ------------------------------------------------------------------ */

/** Count-up animation for numeric values. Renders the formatted string. */
function CountUpNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (latest) => format(latest));
  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.7,
      ease: EASE_OUT,
    });
    return controls.stop;
  }, [value, motionValue]);
  return <motion.span>{rounded}</motion.span>;
}

const SPARKLINE_HEIGHTS: Record<string, string> = {
  sm: "h-4 w-16",
  md: "h-6 w-24",
  lg: "h-9 w-32",
};

function SparklineSVG({
  data,
  sizeClass,
  color,
  trend,
}: {
  data: number[];
  sizeClass: string;
  color: string;
  trend: boolean;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 80;
  const H = 24;
  const step = W / (data.length - 1);
  const coords = data.map((v, i) => ({
    x: i * step,
    y: H - ((v - min) / range) * (H - 2) - 1,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;
  const isUp = trend && data[data.length - 1]! >= data[0]!;
  const strokeColor = trend
    ? isUp ? "hsl(var(--success))" : "hsl(var(--danger))"
    : color;
  const fillColor = trend
    ? isUp ? "hsl(var(--success) / 0.15)" : "hsl(var(--danger) / 0.15)"
    : `${color.replace(")", " / 0.12)")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={sizeClass} aria-hidden>
      <motion.path d={area} fill={fillColor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} />
      <motion.path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
      />
    </svg>
  );
}

/** Reusable by StatSparkline (backward compat). */
function StatSparkline({ data }: { data: number[] }) {
  return <SparklineSVG data={data} sizeClass="h-5 w-20" color="hsl(var(--chart-1))" trend={false} />;
}

/** Standalone sparkline component — inline trend line from a number array. */
export const Sparkline: RegistryComponent = ({ data, size, trend, color }) => {
  const nums = arr<unknown>(data)
    .map((n) => (typeof n === "number" ? n : Number(n)))
    .filter((n) => Number.isFinite(n));
  const s = oneOf(size, ["sm", "md", "lg"] as const, "md");
  const showTrend = bool(trend, true);
  const c = str(color, "hsl(var(--chart-1))");
  return <SparklineSVG data={nums} sizeClass={SPARKLINE_HEIGHTS[s]!} color={c} trend={showTrend} />;
};

/**
 * A KPI tile. Numeric `value` counts up on first render and on change.
 * `sparkline?: number[]` adds a tiny inline trend.
 */
export const Stat: RegistryComponent = ({ label, value, delta, trend, sparkline }) => {
  const t = oneOf(trend, ["up", "down", "flat"] as const, "flat");
  const labelText = str(label, "Metric");
  const numericValue = typeof value === "number" ? value : NaN;
  const isNumeric = Number.isFinite(numericValue);
  const fallbackText = isNumeric ? numericValue.toLocaleString() : str(value, "—");
  const spark = arr<unknown>(sparkline)
    .map((n) => (typeof n === "number" ? n : Number(n)))
    .filter((n) => Number.isFinite(n));

  return (
    <div className="group rounded-lg border border-border bg-card p-5 flex flex-col gap-1.5 h-full shadow-rest transition-shadow duration-200 hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {labelText}
        </span>
        {spark.length > 1 && <StatSparkline data={spark} />}
      </div>
      <span
        role="text"
        aria-label={`${labelText}: ${fallbackText}`}
        className="font-tabular text-3xl font-semibold tracking-tight leading-none"
      >
        {isNumeric ? (
          <CountUpNumber value={numericValue} format={(n) => Math.round(n).toLocaleString()} />
        ) : (
          fallbackText
        )}
      </span>
      {str(delta) && (
        <span
          className={cn(
            "text-xs font-medium font-tabular inline-flex items-center gap-0.5",
            t === "up" && "text-[hsl(var(--success))]",
            t === "down" && "text-[hsl(var(--danger))]",
            t === "flat" && "text-muted-foreground",
          )}
        >
          {t === "up" && (
            <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M6 2.5 10.5 7H7.5v2.5h-3V7H1.5z" />
            </svg>
          )}
          {t === "down" && (
            <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M6 9.5 1.5 5H4.5V2.5h3V5H10.5z" />
            </svg>
          )}
          {str(delta)}
        </span>
      )}
    </div>
  );
};

/**
 * Hero number for "one metric that matters". Larger than Stat, no border,
 * centered — designed to dominate a full-width or half-width section.
 */
export const Metric: RegistryComponent = ({ label, value, prefix, suffix, description, trend }) => {
  const labelText = str(label);
  const numericValue = typeof value === "number" ? value : NaN;
  const isNumeric = Number.isFinite(numericValue);
  const displayValue = isNumeric ? numericValue.toLocaleString() : str(value, "—");
  const t = oneOf(trend, ["up", "down", "flat"] as const, "flat");

  return (
    <div className="flex flex-col items-center justify-center text-center py-6 gap-2">
      {labelText && (
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {labelText}
        </span>
      )}
      <div className="flex items-baseline gap-1.5" role="text" aria-label={`${labelText}: ${str(prefix)}${displayValue}${str(suffix)}`}>
        {str(prefix) && (
          <span className="text-2xl font-semibold text-muted-foreground font-tabular">{str(prefix)}</span>
        )}
        <span className="font-tabular text-6xl font-bold tracking-tighter leading-none text-foreground">
          {isNumeric ? (
            <CountUpNumber value={numericValue} format={(n) => Math.round(n).toLocaleString()} />
          ) : (
            displayValue
          )}
        </span>
        {str(suffix) && (
          <span className="text-2xl font-semibold text-muted-foreground font-tabular">{str(suffix)}</span>
        )}
      </div>
      {str(description) && (
        <p
          className={cn(
            "text-sm font-medium font-tabular inline-flex items-center gap-1",
            t === "up" && "text-[hsl(var(--success))]",
            t === "down" && "text-[hsl(var(--danger))]",
            t === "flat" && "text-muted-foreground",
          )}
        >
          {t === "up" && (
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M6 2.5 10.5 7H7.5v2.5h-3V7H1.5z" />
            </svg>
          )}
          {t === "down" && (
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M6 9.5 1.5 5H4.5V2.5h3V5H10.5z" />
            </svg>
          )}
          {str(description)}
        </p>
      )}
    </div>
  );
};

function useTypewriter(target: string, speedMs: number): string {
  const [shown, setShown] = useState(speedMs <= 0 ? target : "");
  useEffect(() => {
    if (speedMs <= 0) {
      setShown(target);
      return;
    }
    setShown("");
    if (!target) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(target.slice(0, i));
      if (i >= target.length) clearInterval(id);
    }, speedMs);
    return () => clearInterval(id);
  }, [target, speedMs]);
  return shown;
}

const REVEAL_VARIANTS = ["none", "words", "chars"] as const;

export const Heading: RegistryComponent = ({ text, level, reveal }) => {
  const lvl = oneOf(String(num(level, 2)), ["1", "2", "3"] as const, "2");
  const cls = {
    "1": "text-4xl font-bold tracking-tighter leading-tight",
    "2": "text-2xl font-semibold tracking-tight",
    "3": "text-lg font-semibold tracking-tight",
  }[lvl];
  const content = str(text);
  const slug = content ? slugify(content) : "";
  const id = slug || undefined;
  const mode = oneOf(reveal, REVEAL_VARIANTS, "none");
  let body: ReactNode = content;
  if (content && (mode === "words" || mode === "chars")) {
    const parts = mode === "words" ? content.split(/(\s+)/) : Array.from(content);
    body = parts.map((part, i) =>
      /^\s+$/.test(part) ? (
        <span key={i}>{part}</span>
      ) : (
        <motion.span
          key={i}
          aria-hidden={part === ""}
          style={{ display: "inline-block" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.36,
            ease: EASE_OUT,
            delay: 0.04 + i * (mode === "words" ? 0.05 : 0.025),
          }}
        >
          {part}
        </motion.span>
      ),
    );
  }
  if (lvl === "1") return <h1 id={id} className={cls}>{body}</h1>;
  if (lvl === "3") return <h3 id={id} className={cls}>{body}</h3>;
  return <h2 id={id} className={cls}>{body}</h2>;
};

export const Text: RegistryComponent = ({ text, muted, typewriter, typewriterSpeed }) => {
  const full = str(text);
  const isTw = bool(typewriter, false);
  const speed = isTw ? Math.max(0, num(typewriterSpeed, 14)) : 0;
  const shown = useTypewriter(full, speed);
  const showCaret = isTw && shown.length < full.length;
  return (
    <p
      className={cn(
        "text-sm leading-relaxed",
        muted ? "text-muted-foreground" : "text-foreground",
      )}
      aria-label={isTw ? full : undefined}
    >
      {shown}
      {showCaret && (
        <motion.span
          aria-hidden
          className="ml-0.5 inline-block h-[1em] w-[2px] -mb-[2px] align-middle bg-primary"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
        />
      )}
    </p>
  );
};

const BADGE_VARIANT: Record<string, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  outline: "border border-border text-foreground",
};

export const Badge: RegistryComponent = ({ label, variant }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium w-fit",
      BADGE_VARIANT[str(variant, "default")] ?? BADGE_VARIANT.default,
    )}
  >
    {str(label)}
  </span>
);

/* ------------------------------------------------------------------ *
 * Tag / TagGroup
 * ------------------------------------------------------------------ */

const TAG_VARIANT: Record<string, string> = {
  default: "bg-secondary text-secondary-foreground border border-border/60",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  red: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
};

export const Tag: RegistryComponent = ({ label, variant, removable }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium w-fit",
      TAG_VARIANT[str(variant, "default")] ?? TAG_VARIANT.default,
    )}
  >
    {str(label)}
    {bool(removable, false) && (
      <span aria-hidden="true" className="ml-0.5 opacity-40 hover:opacity-80 cursor-pointer transition-opacity leading-none">
        ×
      </span>
    )}
  </span>
);

export const TagGroup: RegistryComponent = ({ tags, variant }) => {
  const items = Array.isArray(tags) ? tags : [];
  const groupVariant = str(variant, "default");
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((tag: unknown, i: number) => {
        const label =
          typeof tag === "string" ? tag
          : typeof tag === "object" && tag !== null ? str((tag as Record<string, unknown>).label)
          : String(tag ?? "");
        const tv =
          typeof tag === "object" && tag !== null
            ? str((tag as Record<string, unknown>).variant, groupVariant)
            : groupVariant;
        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
              TAG_VARIANT[tv] ?? TAG_VARIANT.default,
            )}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
};

const BUTTON_VARIANT: Record<string, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-border bg-transparent hover:bg-accent",
  ghost: "bg-transparent hover:bg-accent",
};

/** Presentational button — surfaces intent, does not wire side effects. */
export const Button: RegistryComponent = ({ label, variant, disabled, ariaLabel }) => {
  const isDisabled = bool(disabled, false);
  const labelText = str(label);
  const aria = str(ariaLabel) || (labelText ? undefined : "Button");
  return (
    <button
      type="button"
      disabled={isDisabled || undefined}
      aria-disabled={isDisabled || undefined}
      {...(aria ? { "aria-label": aria } : {})}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
        "transition-colors w-fit",
        BUTTON_VARIANT[str(variant, "default")] ?? BUTTON_VARIANT.default,
        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
      )}
    >
      {labelText || "Button"}
    </button>
  );
};

export const Divider: RegistryComponent = () => <hr className="border-border" />;

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

export const Timeline: RegistryComponent = ({ items, children }) => {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <div className="relative flex flex-col gap-0">
      {safeItems.map((item, i) => {
        const isDone = item.status === "done";
        const isCurrent = item.status === "current";
        const isLast = i === safeItems.length - 1;
        return (
          <div key={item.id ?? i} className="flex gap-4">
            {/* Timeline rail */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {isDone ? (
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mt-1 w-0.5 grow",
                    isDone ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
            {/* Content */}
            <div className={cn("flex flex-col gap-1 pb-6", isLast && "pb-0")}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isCurrent ? "text-primary" : "text-foreground",
                  )}
                >
                  {item.title}
                </span>
                {item.timestamp && (
                  <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                )}
              </div>
              {item.description && (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              )}
            </div>
          </div>
        );
      })}
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Callout
 * ------------------------------------------------------------------ */

const CALLOUT_STYLES = {
  info: {
    border: "border-l-4 border-primary",
    bg: "bg-primary/5",
    icon: "text-primary",
    title: "text-primary",
  },
  warning: {
    border: "border-l-4 border-[hsl(var(--warning))]",
    bg: "bg-[hsl(var(--warning)/0.08)]",
    icon: "text-[hsl(var(--warning))]",
    title: "text-[hsl(var(--warning))]",
  },
  success: {
    border: "border-l-4 border-[hsl(var(--success))]",
    bg: "bg-[hsl(var(--success)/0.08)]",
    icon: "text-[hsl(var(--success))]",
    title: "text-[hsl(var(--success))]",
  },
  error: {
    border: "border-l-4 border-[hsl(var(--danger))]",
    bg: "bg-[hsl(var(--danger)/0.08)]",
    icon: "text-[hsl(var(--danger))]",
    title: "text-[hsl(var(--danger))]",
  },
} as const;

const CALLOUT_ICONS = {
  info: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0 3.5c-.69 0-1.25.56-1.25 1.25v3.5a1.25 1.25 0 1 0 2.5 0v-3.5C9.25 8.06 8.69 7.5 8 7.5Z" />
    </svg>
  ),
  warning: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  ),
  success: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.22a.75.75 0 0 0-1.06 0L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06Z" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.343 13.657A8 8 0 1 1 13.656 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.75.75 0 0 0-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 1 0 1.06 1.06L8 9.06l1.97 1.97a.75.75 0 1 0 1.06-1.06L9.06 8l1.97-1.97a.75.75 0 1 0-1.06-1.06L8 6.94 6.03 4.97Z" />
    </svg>
  ),
};

export const Callout: RegistryComponent = ({ variant = "info", title, content, children }) => {
  const safeVariant = (variant as string) in CALLOUT_STYLES ? (variant as keyof typeof CALLOUT_STYLES) : "info";
  const styles = CALLOUT_STYLES[safeVariant];
  const titleText = str(title);
  const contentText = str(content);
  return (
    <div className={cn("flex gap-3 rounded-r-lg p-4", styles.border, styles.bg)}>
      <div className={styles.icon}>{CALLOUT_ICONS[safeVariant]}</div>
      <div className="flex flex-col gap-1">
        {titleText && <p className={cn("text-sm font-semibold", styles.title)}>{titleText}</p>}
        {contentText && <p className="text-sm text-foreground/80">{contentText}</p>}
        {children}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Stepper
 * ------------------------------------------------------------------ */

export const Stepper: RegistryComponent = ({ steps, current = 0, children }) => {
  const safeSteps = Array.isArray(steps) ? steps : [];
  const safeCurrentRaw = typeof current === "number" ? current : 0;
  const safeCurrent = Math.max(0, Math.min(safeSteps.length - 1, safeCurrentRaw));
  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex items-center">
        {/* Connecting track */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500"
          style={{ width: safeSteps.length > 1 ? `${(safeCurrent / (safeSteps.length - 1)) * 100}%` : "0%" }}
        />
        <div className="relative z-10 flex w-full justify-between">
          {safeSteps.map((step, i) => {
            const isDone = i < safeCurrent;
            const isActive = i === safeCurrent;
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : isActive
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "max-w-[80px] text-center text-xs",
                    isActive ? "font-semibold text-primary" : isDone ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
};

/** Circular ring progress with centered label. */
export const RingProgress: RegistryComponent = ({ value, label, size, color }) => {
  const pct = Math.max(0, Math.min(100, num(value, 0)));
  const s = oneOf(size, ["sm", "md", "lg"] as const, "md");
  const dim = s === "sm" ? 64 : s === "lg" ? 120 : 88;
  const strokeW = s === "sm" ? 6 : s === "lg" ? 10 : 8;
  const r = (dim - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const labelText = str(label);
  const strokeColor = str(color, "hsl(var(--primary))");

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} role="img" aria-label={`${labelText || "Progress"}: ${pct}%`}>
          <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeW} />
          <motion.circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-tabular font-semibold", s === "sm" ? "text-xs" : s === "lg" ? "text-xl" : "text-sm")}>
            {pct}%
          </span>
        </div>
      </div>
      {labelText && <span className="text-xs text-muted-foreground text-center">{labelText}</span>}
    </div>
  );
};

export const Progress: RegistryComponent = ({ label, value }) => {
  const pct = Math.max(0, Math.min(100, num(value, 0)));
  const labelText = str(label);
  return (
    <div className="space-y-1">
      {labelText && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{labelText}</span>
          <span className="font-medium">{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        {...(labelText ? { "aria-label": labelText } : {})}
        className="h-2 w-full rounded-full bg-muted overflow-hidden"
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
};

/** Bulleted or numbered list. `items` is a string[]. */
export const List: RegistryComponent = ({ items, ordered }) => {
  const list = arr<string>(items).map((i) => String(i));
  const inner = list.map((item, i) => (
    <li key={i} className="text-sm leading-relaxed">
      {item}
    </li>
  ));
  return ordered ? (
    <ol className="list-decimal pl-5 space-y-1 text-foreground">{inner}</ol>
  ) : (
    <ul className="list-disc pl-5 space-y-1 text-foreground">{inner}</ul>
  );
};

/** Simple data table. `columns: string[]`, `rows: (string|number)[][]`. */
export const Table: RegistryComponent = ({ node, columns, rows, caption }) => {
  const { dispatch } = useRuntimeContext();
  const cols = arr<string>(columns).map((c) => String(c));
  const data = arr<unknown[]>(rows);
  const captionText = str(caption);
  const onRowClick = (node?.events as Record<string, unknown> | undefined)?.onRowClick;
  const rowClickActions = Array.isArray(onRowClick) ? onRowClick : null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table
        className="w-full text-sm"
        {...(captionText ? { "aria-label": captionText } : {})}
      >
        {captionText && (
          <caption className="px-3 py-2 text-left text-sm text-muted-foreground caption-top">
            {captionText}
          </caption>
        )}
        <thead className="bg-muted/50">
          <tr>
            {cols.map((c, i) => (
              <th
                key={i}
                scope="col"
                className="px-3 py-2 text-left font-medium text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => {
            const cells = arr(row);
            const rowPayload: Record<string, unknown> = { index: ri, row };
            // If row is an object-keyed map, also surface its fields.
            if (row && typeof row === "object" && !Array.isArray(row)) {
              Object.assign(rowPayload, row as Record<string, unknown>);
            } else {
              cols.forEach((col, ci) => {
                if (col) rowPayload[col] = cells[ci];
              });
            }
            return (
              <tr
                key={ri}
                onClick={
                  rowClickActions
                    ? () => dispatch(rowClickActions as never, rowPayload)
                    : undefined
                }
                className={cn(
                  "border-t border-border",
                  rowClickActions && "cursor-pointer transition-colors hover:bg-accent/50",
                )}
              >
                {cells.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2">
                    {typeof cell === "number" ? cell.toLocaleString() : String(cell ?? "")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Data viz — dependency-free SVG charts
 * ------------------------------------------------------------------ */

interface Point {
  label: string;
  value: number;
}

interface NamedSeries {
  name: string;
  color: string;
  points: Point[];
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

function formatAxisValue(n: number): string {
  if (n >= 1_000_000) return `${parseFloat((n / 1_000_000).toPrecision(2))}M`;
  if (n >= 1_000) return `${parseFloat((n / 1_000).toPrecision(2))}K`;
  return `${Math.round(n)}`;
}

function toPoints(data: unknown): Point[] {
  return arr<Record<string, unknown>>(data).map((d, i) => ({
    label: str(d?.label, String(i + 1)),
    value: num(d?.value, 0),
  }));
}

function toNamedSeries(data: unknown, seriesKeys: string[]): NamedSeries[] {
  const rows = arr<Record<string, unknown>>(data);
  return seriesKeys.slice(0, 5).map((key, si) => ({
    name: key,
    color: CHART_COLORS[si] ?? CHART_COLORS[0],
    points: rows.map((d, i) => ({
      label: str(d?.label, String(i + 1)),
      value: num(d?.[key], 0),
    })),
  }));
}

/**
 * Chart: `kind` of "bar"|"line"|"area"|"pie"|"donut", `data: {label,value}[]`.
 * For multi-series bar/line pass `series: ["key1","key2"]` and wide-format rows.
 * Rendered as inline SVG — no charting dependency.
 */
export const Chart: RegistryComponent = ({ kind, data, title, subtitle, series }) => {
  const k = oneOf(kind, ["bar", "line", "area", "pie", "donut"] as const, "bar");
  const seriesKeys = arr<string>(series).filter((s): s is string => typeof s === "string");
  const isMulti = seriesKeys.length > 1 && k !== "pie" && k !== "donut";
  const namedSeries = isMulti ? toNamedSeries(data, seriesKeys) : null;
  const points = isMulti ? [] : toPoints(data);
  const titleText = str(title);
  const subtitleText = str(subtitle);
  const baseLabel = titleText || `${k} chart`;
  const ariaLabel = isMulti
    ? `${baseLabel}, ${seriesKeys.length} series`
    : `${baseLabel}, ${points.length} data ${points.length === 1 ? "point" : "points"}`;

  // Auto-compute trend from first → last value for a subtle indicator.
  const trendPct = (() => {
    if (points.length < 2) return null;
    const first = points[0]!.value;
    const last = points[points.length - 1]!.value;
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  })();
  const trendUp = trendPct !== null && trendPct > 0;
  const trendDown = trendPct !== null && trendPct < 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 h-full">
      {(titleText || subtitleText) && (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            {titleText && (
              <h3 className="font-semibold text-base leading-none tracking-tight">{titleText}</h3>
            )}
            {subtitleText && (
              <p className="text-xs text-muted-foreground">{subtitleText}</p>
            )}
          </div>
          {trendPct !== null && (
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium font-tabular",
                trendUp && "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
                trendDown && "bg-[hsl(var(--danger)/0.12)] text-[hsl(var(--danger))]",
                !trendUp && !trendDown && "bg-muted text-muted-foreground",
              )}
            >
              {trendUp ? "▲" : trendDown ? "▼" : "—"} {Math.abs(trendPct).toFixed(1)}%
            </span>
          )}
        </div>
      )}
      {isMulti && namedSeries ? (
        <>
          <MultiSeriesChartBody kind={k} series={namedSeries} ariaLabel={ariaLabel} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {namedSeries.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        </>
      ) : points.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
          <svg className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l5-5 4 4 5-7 4 4" />
          </svg>
          <p className="text-xs">No data to display</p>
        </div>
      ) : k === "pie" || k === "donut" ? (
        <>
          <PieChartBody points={points} donut={k === "donut"} ariaLabel={ariaLabel} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {points.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {p.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <ChartBody kind={k} points={points} ariaLabel={ariaLabel} />
      )}
    </div>
  );
};

function PieChartBody({
  points,
  donut,
  ariaLabel,
}: {
  points: Point[];
  donut: boolean;
  ariaLabel: string;
}): ReactNode {
  const R = 80;
  const CX = 120;
  const CY = 90;
  const W = 240;
  const H = 180;
  const total = points.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  const [hovered, setHovered] = useState<number | null>(null);

  let angle = -Math.PI / 2;
  const slices = points.map((p, i) => {
    const sweep = (Math.max(0, p.value) / total) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    const x1 = CX + R * Math.cos(start);
    const y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const d = donut
      ? `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${CX + (R - 36) * Math.cos(angle)} ${CY + (R - 36) * Math.sin(angle)} A ${R - 36} ${R - 36} 0 ${largeArc} 0 ${CX + (R - 36) * Math.cos(start)} ${CY + (R - 36) * Math.sin(start)} Z`
      : `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { d, color: CHART_COLORS[i % CHART_COLORS.length]!, pct: ((p.value / total) * 100).toFixed(1), label: p.label };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[180px]" role="img" aria-label={ariaLabel}>
      <title>{ariaLabel}</title>
      {slices.map((s, i) => (
        <motion.path
          key={i}
          d={s.d}
          fill={s.color}
          opacity={hovered === null || hovered === i ? 1 : 0.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: hovered === null || hovered === i ? 1 : 0.5 }}
          onHoverStart={() => setHovered(i)}
          onHoverEnd={() => setHovered(null)}
          style={{ cursor: "pointer" }}
        />
      ))}
      {hovered !== null && slices[hovered] && (
        <text x={CX} y={CY + 5} textAnchor="middle" className="text-[11px] font-tabular fill-foreground" fontSize="11">
          {slices[hovered]!.pct}%
        </text>
      )}
    </svg>
  );
}

function MultiSeriesChartBody({
  kind,
  series,
  ariaLabel,
}: {
  kind: "bar" | "line" | "area";
  series: NamedSeries[];
  ariaLabel: string;
}): ReactNode {
  const W = 480;
  const H = 160;
  const PAD = 8;
  const n = series.length;
  const labels = series[0]?.points.map((p) => p.label) ?? [];
  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const max = Math.max(...allValues, 1);
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const grid = [0.33, 0.66, 1].map((f) => PAD + innerH - innerH * f);

  if (kind === "bar") {
    const groupW = innerW / labels.length;
    const barW = (groupW * 0.72) / n;
    const groupPad = groupW * 0.14;
    return (
      <svg viewBox={`-40 0 ${W + 40} ${H + 20}`} className="w-full h-auto cursor-crosshair" role="img" aria-label={ariaLabel}>
        <title>{ariaLabel}</title>
        <g aria-hidden>
          {grid.map((y, i) => (
            <line key={i} x1={PAD} x2={PAD + innerW} y1={y} y2={y} className="stroke-border" strokeWidth={1} strokeDasharray="2 4" />
          ))}
        </g>
        {grid.map((y, i) => (
          <text key={i} x={-4} y={y + 3} textAnchor="end" className="text-[9px] font-tabular fill-muted-foreground/60" fontSize="9">
            {formatAxisValue(max * [0.33, 0.66, 1][i]!)}
          </text>
        ))}
        {labels.map((label, gi) => (
          <g key={gi}>
            {series.map((s, si) => {
              const val = s.points[gi]?.value ?? 0;
              const h = (val / max) * innerH;
              const x = PAD + gi * groupW + groupPad + si * barW;
              return (
                <motion.rect
                  key={si}
                  x={x}
                  width={barW * 0.88}
                  rx={2}
                  fill={s.color}
                  opacity={0.9}
                  initial={{ height: 0, y: PAD + innerH }}
                  animate={{ height: h, y: PAD + innerH - h }}
                  transition={{ duration: 0.5, ease: EASE_OUT, delay: gi * 0.04 + si * 0.02 }}
                />
              );
            })}
            <text x={PAD + gi * groupW + groupW / 2} y={H + 14} textAnchor="middle" className="text-[10px] font-tabular fill-muted-foreground">
              {label}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  const step = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  return (
    <svg viewBox={`-40 0 ${W + 40} ${H + 20}`} className="w-full h-auto cursor-crosshair" role="img" aria-label={ariaLabel}>
      <title>{ariaLabel}</title>
      <defs>
        {series.map((s, si) => (
          <linearGradient key={si} id={`ms-area-${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      <g aria-hidden>
        {grid.map((y, i) => (
          <line key={i} x1={PAD} x2={PAD + innerW} y1={y} y2={y} className="stroke-border" strokeWidth={1} strokeDasharray="2 4" />
        ))}
      </g>
      {grid.map((y, i) => (
        <text key={i} x={-4} y={y + 3} textAnchor="end" className="text-[9px] font-tabular fill-muted-foreground/60" fontSize="9">
          {formatAxisValue(max * [0.33, 0.66, 1][i]!)}
        </text>
      ))}
      {series.map((s, si) => {
        const coords = s.points.map((p, i) => ({
          x: PAD + i * step,
          y: PAD + innerH - (p.value / max) * innerH,
        }));
        const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
        const area = `${line} L${PAD + innerW},${PAD + innerH} L${PAD},${PAD + innerH} Z`;
        return (
          <g key={si}>
            {kind === "area" && (
              <motion.path d={area} fill={`url(#ms-area-${si})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
            )}
            <motion.path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: EASE_OUT, delay: si * 0.1 }} />
          </g>
        );
      })}
      {labels.map((label, i) => (
        <text key={i} x={PAD + i * step} y={H + 14} textAnchor="middle" className="text-[10px] font-tabular fill-muted-foreground">
          {label}
        </text>
      ))}
    </svg>
  );
}

function ChartBody({
  kind,
  points,
  ariaLabel,
}: {
  kind: "bar" | "line" | "area";
  points: Point[];
  ariaLabel: string;
}): ReactNode {
  const W = 480;
  const H = 160;
  const PAD = 8;
  const max = Math.max(...points.map((p) => p.value), 1);
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Dotted reference grid — 3 horizontal lines for a sense of scale.
  const grid = [0.33, 0.66, 1].map((f) => PAD + innerH - innerH * f);
  const gridLines = (
    <g aria-hidden>
      {grid.map((y, i) => (
        <line
          key={i}
          x1={PAD}
          x2={PAD + innerW}
          y1={y}
          y2={y}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      ))}
    </g>
  );

  const onMove = (evt: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * W;
    const step = kind === "bar" ? innerW / points.length : innerW / Math.max(points.length - 1, 1);
    if (step <= 0) return;
    const i =
      kind === "bar"
        ? Math.floor((x - PAD) / step)
        : Math.round((x - PAD) / step);
    if (i >= 0 && i < points.length) setHovered(i);
  };

  const tooltip = (() => {
    if (hovered === null) return null;
    const p = points[hovered];
    if (!p) return null;
    const isBar = kind === "bar";
    const step = isBar ? innerW / points.length : innerW / Math.max(points.length - 1, 1);
    const cx = isBar ? PAD + step * hovered + step / 2 : PAD + step * hovered;
    const xPct = (cx / W) * 100;
    return (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[11px] shadow-rest"
        style={{ left: `${xPct}%`, top: `${(PAD / (H + 20)) * 100}%` }}
      >
        <span className="font-medium">{p.label}</span>
        <span className="ml-2 font-tabular text-muted-foreground">
          {p.value.toLocaleString()}
        </span>
      </div>
    );
  })();

  if (kind === "bar") {
    const bw = innerW / points.length;
    return (
      <div className="relative">
        {tooltip}
        <svg
          ref={svgRef}
          viewBox={`-40 0 ${W + 40} ${H + 20}`}
          className="w-full h-auto cursor-crosshair"
          role="img"
          aria-label={ariaLabel}
          onMouseMove={onMove}
          onMouseLeave={() => setHovered(null)}
        >
          <title>{ariaLabel}</title>
          <defs>
            <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          {gridLines}
          {grid.map((y, i) => (
            <text key={i} x={-4} y={y + 3} textAnchor="end" className="text-[9px] font-tabular fill-muted-foreground/60" fontSize="9">
              {formatAxisValue(max * [0.33, 0.66, 1][i]!)}
            </text>
          ))}
          {points.map((p, i) => {
            const h = (p.value / max) * innerH;
            const isHover = hovered === i;
            return (
              <g key={i}>
                <motion.rect
                  x={PAD + i * bw + bw * 0.18}
                  width={bw * 0.64}
                  rx={3}
                  fill="url(#bar-grad)"
                  opacity={hovered === null || isHover ? 1 : 0.55}
                  initial={{ height: 0, y: PAD + innerH }}
                  animate={{ height: h, y: PAD + innerH - h }}
                  transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.04 }}
                />
                <text
                  x={PAD + i * bw + bw / 2}
                  y={H + 14}
                  textAnchor="middle"
                  className={cn(
                    "text-[10px] font-tabular",
                    isHover ? "fill-foreground" : "fill-muted-foreground",
                  )}
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: PAD + i * step,
    y: PAD + innerH - (p.value / max) * innerH,
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${PAD + innerW},${PAD + innerH} L${PAD},${PAD + innerH} Z`;

  const hoveredCoord = hovered !== null ? coords[hovered] : null;
  return (
    <div className="relative">
      {tooltip}
      <svg
        ref={svgRef}
        viewBox={`-40 0 ${W + 40} ${H + 20}`}
        className="w-full h-auto cursor-crosshair"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHovered(null)}
      >
        <title>{ariaLabel}</title>
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines}
        {grid.map((y, i) => (
          <text key={i} x={-4} y={y + 3} textAnchor="end" className="text-[9px] font-tabular fill-muted-foreground/60" fontSize="9">
            {formatAxisValue(max * [0.33, 0.66, 1][i]!)}
          </text>
        ))}
        {hoveredCoord && (
          <line
            x1={hoveredCoord.x}
            x2={hoveredCoord.x}
            y1={PAD}
            y2={PAD + innerH}
            className="stroke-foreground/30"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        )}
        {kind === "area" && (
          <motion.path
            d={areaPath}
            fill="url(#area-grad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.1 }}
          />
        )}
        <motion.path
          d={linePath}
          fill="none"
          strokeWidth={2}
          className="stroke-chart-1"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        />
        {coords.map((c, i) => (
          <g key={i}>
            <motion.circle
              cx={c.x}
              cy={c.y}
              r={hovered === i ? 5 : 3}
              className="fill-chart-1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.5 + i * 0.04 }}
            />
            <text
              x={c.x}
              y={H + 14}
              textAnchor="middle"
              className={cn(
                "text-[10px] font-tabular",
                hovered === i ? "fill-foreground" : "fill-muted-foreground",
              )}
            >
              {points[i]?.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * EmptyState
 * ------------------------------------------------------------------ */

const EMPTY_ICONS: Record<string, ReactNode> = {
  inbox: (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  search: (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  chart: (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  file: (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  users: (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  default: (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

export const EmptyState: RegistryComponent = ({ title, description, icon, action }) => {
  const titleText = str(title, "Nothing here yet");
  const descText = str(description);
  const iconKey = str(icon, "default");
  const actionLabel = str(action);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-14 text-center">
      <motion.div
        className="text-muted-foreground/40"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        {EMPTY_ICONS[iconKey] ?? EMPTY_ICONS.default}
      </motion.div>
      <div className="space-y-1.5 max-w-xs">
        <p className="text-sm font-semibold text-foreground">{titleText}</p>
        {descText && <p className="text-sm text-muted-foreground leading-relaxed">{descText}</p>}
      </div>
      {actionLabel && (
        <button
          type="button"
          className="mt-1 inline-flex items-center rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
