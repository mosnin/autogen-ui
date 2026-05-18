"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { EASE_OUT } from "../_easing";
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
  <div className={cn("grid grid-cols-1 sm:grid-cols-6 lg:grid-cols-12", GAP[num(gap, 4)] ?? "gap-4")}>
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
  <section className="space-y-3">
    {(str(title) || str(description)) && (
      <header className="space-y-1">
        {str(title) && (
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{str(title)}</h2>
        )}
        {str(description) && (
          <p className="text-sm text-muted-foreground">{str(description)}</p>
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

/** Tiny inline sparkline from `number[]`. Uses chart-1. */
function StatSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 80;
  const H = 22;
  const step = W / (data.length - 1);
  const path = data
    .map((v, i) => {
      const x = i * step;
      const y = H - ((v - min) / range) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-5 w-20 text-chart-1" aria-hidden>
      <motion.path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
      />
    </svg>
  );
}

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
        className="font-tabular font-display text-3xl font-semibold tracking-tight leading-tight"
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
            "text-xs font-medium font-tabular inline-flex items-center gap-1",
            t === "up" && "text-success",
            t === "down" && "text-danger",
            t === "flat" && "text-muted-foreground",
          )}
        >
          {t === "up" ? "↑ " : t === "down" ? "↓ " : ""}
          {str(delta)}
        </span>
      )}
    </div>
  );
};

export const Heading: RegistryComponent = ({ text, level }) => {
  const lvl = oneOf(String(num(level, 2)), ["1", "2", "3"] as const, "2");
  const cls = {
    "1": "text-2xl font-bold tracking-tight",
    "2": "text-xl font-semibold tracking-tight",
    "3": "text-base font-semibold",
  }[lvl];
  const content = str(text);
  const slug = content ? slugify(content) : "";
  const id = slug || undefined;
  if (lvl === "1") return <h1 id={id} className={cls}>{content}</h1>;
  if (lvl === "3") return <h3 id={id} className={cls}>{content}</h3>;
  return <h2 id={id} className={cls}>{content}</h2>;
};

export const Text: RegistryComponent = ({ text, muted }) => (
  <p className={cn("text-sm leading-relaxed", muted ? "text-muted-foreground" : "text-foreground")}>
    {str(text)}
  </p>
);

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
export const Table: RegistryComponent = ({ columns, rows, caption }) => {
  const cols = arr<string>(columns).map((c) => String(c));
  const data = arr<unknown[]>(rows);
  const captionText = str(caption);
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
          {data.map((row, ri) => (
            <tr key={ri} className="border-t border-border">
              {arr(row).map((cell, ci) => (
                <td key={ci} className="px-3 py-2">
                  {typeof cell === "number" ? cell.toLocaleString() : String(cell ?? "")}
                </td>
              ))}
            </tr>
          ))}
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

function toPoints(data: unknown): Point[] {
  return arr<Record<string, unknown>>(data).map((d, i) => ({
    label: str(d?.label, String(i + 1)),
    value: num(d?.value, 0),
  }));
}

/**
 * Chart: `kind` of "bar" | "line" | "area", `data: {label,value}[]`.
 * Rendered as inline SVG so the library ships no charting dependency.
 */
export const Chart: RegistryComponent = ({ kind, data, title }) => {
  const k = oneOf(kind, ["bar", "line", "area"] as const, "bar");
  const points = toPoints(data);
  const titleText = str(title);
  const baseLabel = titleText || `${k} chart`;
  const ariaLabel = `${baseLabel}, ${points.length} data ${points.length === 1 ? "point" : "points"}`;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 h-full">
      {titleText && <h3 className="font-semibold leading-none tracking-tight">{titleText}</h3>}
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data</p>
      ) : (
        <ChartBody kind={k} points={points} ariaLabel={ariaLabel} />
      )}
    </div>
  );
};

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

  if (kind === "bar") {
    const bw = innerW / points.length;
    return (
      <svg
        viewBox={`0 0 ${W} ${H + 20}`}
        className="w-full h-auto"
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        <defs>
          <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {gridLines}
        {points.map((p, i) => {
          const h = (p.value / max) * innerH;
          return (
            <g key={i}>
              <motion.rect
                x={PAD + i * bw + bw * 0.18}
                width={bw * 0.64}
                rx={3}
                fill="url(#bar-grad)"
                initial={{ height: 0, y: PAD + innerH }}
                animate={{ height: h, y: PAD + innerH - h }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.04 }}
              />
              <text
                x={PAD + i * bw + bw / 2}
                y={H + 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] font-tabular"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: PAD + i * step,
    y: PAD + innerH - (p.value / max) * innerH,
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${PAD + innerW},${PAD + innerH} L${PAD},${PAD + innerH} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 20}`}
      className="w-full h-auto"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines}
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
            r={3}
            className="fill-chart-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.5 + i * 0.04 }}
          />
          <text
            x={c.x}
            y={H + 14}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {points[i]?.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
