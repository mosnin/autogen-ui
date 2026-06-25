"use client";

import { Children, type ReactNode } from "react";
import {
  cn,
  createRegistry,
  useRuntimeContext,
  type Action,
  type ComponentRegistry,
  type EventMap,
  type RegistryComponent,
} from "@autogen-ui/core";

// shadcn/ui — added with `npx shadcn@latest add <name>`. See ../README.md.
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge as ShBadge } from "@/components/ui/badge";
import { Button as ShButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox as ShCheckbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input as ShInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress as ShProgress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton as ShSkeleton } from "@/components/ui/skeleton";
import { Switch as ShSwitch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea as ShTextarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { LucideIcon } from "./icon";

/* ------------------------------------------------------------------ *
 * Loose prop accessors — the model emits JSON, so props arrive untyped.
 * (Mirrors the framework's internal helpers so this stays self-contained.)
 * ------------------------------------------------------------------ */

const str = (v: unknown, f = ""): string => (typeof v === "string" ? v : f);
const num = (v: unknown, f = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : f;
const bool = (v: unknown, f = false): boolean => (typeof v === "boolean" ? v : f);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], f: T): T =>
  typeof v === "string" && (opts as readonly string[]).includes(v) ? (v as T) : f;
const getActions = (events: EventMap | undefined, name: string): Action[] => {
  const list = events?.[name];
  return Array.isArray(list) ? list : [];
};

/* ------------------------------------------------------------------ *
 * Validation — ported from the framework's form layer so shadcn inputs
 * keep the same schema-driven error behaviour the agent expects.
 * ------------------------------------------------------------------ */

interface ValidateRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  type?: "email" | "url";
  message?: string;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/;

function validateInput(value: unknown, rulesRaw: unknown): string | null {
  if (!rulesRaw || typeof rulesRaw !== "object") return null;
  const rules = rulesRaw as ValidateRules;
  const isEmpty = value === undefined || value === null || value === "";
  if (rules.required && isEmpty) return rules.message ?? "Required";
  if (isEmpty) return null;
  const s = typeof value === "string" ? value : String(value);
  if (typeof rules.minLength === "number" && s.length < rules.minLength)
    return rules.message ?? `Must be at least ${rules.minLength} characters`;
  if (typeof rules.maxLength === "number" && s.length > rules.maxLength)
    return rules.message ?? `Must be at most ${rules.maxLength} characters`;
  if (rules.type === "email" && !EMAIL_RE.test(s))
    return rules.message ?? "Must be a valid email";
  if (rules.type === "url" && !URL_RE.test(s))
    return rules.message ?? "Must be a valid URL";
  if (typeof rules.pattern === "string") {
    try {
      if (!new RegExp(rules.pattern).test(s)) return rules.message ?? "Invalid format";
    } catch {
      /* bad pattern — skip */
    }
  }
  if (typeof value === "number") {
    if (typeof rules.min === "number" && value < rules.min)
      return rules.message ?? `Must be at least ${rules.min}`;
    if (typeof rules.max === "number" && value > rules.max)
      return rules.message ?? `Must be at most ${rules.max}`;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Display + layout
 * ------------------------------------------------------------------ */

const ShadcnCard: RegistryComponent = ({ title, description, children }) => {
  const hasHeader = Boolean(str(title) || str(description));
  return (
    <Card className="h-full">
      {hasHeader && (
        <CardHeader>
          {str(title) && <CardTitle>{str(title)}</CardTitle>}
          {str(description) && <CardDescription>{str(description)}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={hasHeader ? undefined : "pt-6"}>{children}</CardContent>
    </Card>
  );
};

/** KPI tile rendered inside a shadcn Card so it sits native in the theme. */
const ShadcnStat: RegistryComponent = ({ label, value, delta, trend }) => {
  const t = oneOf(trend, ["up", "down", "flat"] as const, "flat");
  const display = typeof value === "number" ? value.toLocaleString() : str(value, "—");
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wider">
          {str(label, "Metric")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight tabular-nums">{display}</div>
        {str(delta) && (
          <div
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-xs font-medium tabular-nums",
              t === "up" && "text-emerald-600 dark:text-emerald-400",
              t === "down" && "text-rose-600 dark:text-rose-400",
              t === "flat" && "text-muted-foreground",
            )}
          >
            {t === "up" ? "↑" : t === "down" ? "↓" : ""} {str(delta)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  default: "default",
  secondary: "secondary",
  outline: "outline",
  danger: "destructive",
};

const ShadcnBadge: RegistryComponent = ({ label, variant }) => {
  const raw = str(variant, "default");
  const v = BADGE_VARIANT[raw] ?? "default";
  const tint =
    raw === "success"
      ? "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : raw === "warning"
        ? "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : undefined;
  return (
    <ShBadge variant={v} className={tint}>
      {str(label)}
    </ShBadge>
  );
};

/**
 * Presentational button — the renderer auto-wires `onClick` events on the
 * wrapping element, so wiring it here too would double-fire. We only surface
 * label / variant / disabled, matching the framework's own Button.
 */
const BUTTON_VARIANT = ["default", "secondary", "outline", "ghost"] as const;
const ShadcnButton: RegistryComponent = ({ label, variant, disabled }) => (
  <ShButton
    variant={oneOf(variant, BUTTON_VARIANT, "default")}
    disabled={bool(disabled, false) || undefined}
  >
    {str(label, "Button")}
  </ShButton>
);

const ShadcnProgress: RegistryComponent = ({ label, value }) => {
  const pct = Math.max(0, Math.min(100, num(value, 0)));
  return (
    <div className="space-y-1">
      {str(label) && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{str(label)}</span>
          <span className="font-medium tabular-nums">{pct}%</span>
        </div>
      )}
      <ShProgress value={pct} />
    </div>
  );
};

const ShadcnDivider: RegistryComponent = () => <Separator />;

const AVATAR_SIZE: Record<string, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};
function initialsOf(name: unknown): string {
  const parts = str(name).split(/\s+/).filter(Boolean).slice(0, 2);
  const ini = parts.map((w) => w[0]!.toUpperCase()).join("");
  return ini || "?";
}
const ShadcnAvatar: RegistryComponent = ({ src, name, size, online }) => {
  const sz = oneOf(size, ["sm", "md", "lg", "xl"] as const, "md");
  return (
    <span className="relative inline-flex">
      <Avatar className={AVATAR_SIZE[sz]}>
        {str(src) && <AvatarImage src={str(src)} alt={str(name)} />}
        <AvatarFallback>{initialsOf(name)}</AvatarFallback>
      </Avatar>
      {bool(online) && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
      )}
    </span>
  );
};

const SKELETON_H: Record<string, string> = { sm: "h-3", md: "h-4", lg: "h-6" };
const ShadcnSkeleton: RegistryComponent = ({ lines, height }) => {
  const n = Math.max(1, num(lines, 1));
  const h = SKELETON_H[oneOf(height, ["sm", "md", "lg"] as const, "md")];
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: n }).map((_, i) => (
        <ShSkeleton key={i} className={cn(h, i === n - 1 && n > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
};

const ShadcnTooltip: RegistryComponent = ({ text, side, children }) => {
  const s = oneOf(side, ["top", "bottom", "left", "right"] as const, "top");
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent side={s}>{str(text)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/* ------------------------------------------------------------------ *
 * Data table — ports the framework's onRowClick contract.
 * ------------------------------------------------------------------ */

const ShadcnTable: RegistryComponent = ({ node, columns, rows, caption }) => {
  const { dispatch } = useRuntimeContext();
  const cols = arr<unknown>(columns).map(String);
  const data = arr<unknown>(rows);
  const onRowClick = (node?.events as Record<string, unknown> | undefined)?.onRowClick;
  const rowActions = Array.isArray(onRowClick) ? (onRowClick as Action[]) : null;

  return (
    <div className="rounded-lg border">
      <Table>
        {str(caption) && <TableCaption>{str(caption)}</TableCaption>}
        <TableHeader>
          <TableRow>
            {cols.map((c, i) => (
              <TableHead key={i}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, ri) => {
            const cells = arr<unknown>(row);
            const payload: Record<string, unknown> = { index: ri, row };
            if (row && typeof row === "object" && !Array.isArray(row)) {
              Object.assign(payload, row as Record<string, unknown>);
            } else {
              cols.forEach((col, ci) => {
                if (col) payload[col] = cells[ci];
              });
            }
            return (
              <TableRow
                key={ri}
                onClick={rowActions ? () => dispatch(rowActions, payload) : undefined}
                className={rowActions ? "cursor-pointer" : undefined}
              >
                {cells.map((cell, ci) => (
                  <TableCell key={ci}>
                    {typeof cell === "number" ? cell.toLocaleString() : String(cell ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Form controls — onChange/onSubmit are component-owned (the renderer only
 * auto-wires onClick), so each control dispatches its own event payload.
 * ------------------------------------------------------------------ */

const INPUT_TYPES = ["text", "number", "email", "password", "search", "url", "tel"] as const;

const ShadcnInput: RegistryComponent = ({ node, type, placeholder, value, id, name }) => {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  const t = oneOf(type, INPUT_TYPES, "text");
  const error = validateInput(value, (node?.props as { validate?: unknown } | undefined)?.validate);
  const errorId = `${node?.id ?? "input"}__err`;
  return (
    <div className="flex w-full flex-col gap-1">
      <ShInput
        type={t}
        id={str(id) || undefined}
        name={str(name) || undefined}
        placeholder={str(placeholder)}
        value={value === null || value === undefined ? "" : String(value)}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? errorId : undefined}
        onChange={(e) => {
          const v = t === "number" ? Number(e.target.value) : e.target.value;
          if (onChange.length > 0) dispatch(onChange, { value: v, name: e.target.name });
        }}
      />
      {error && (
        <span id={errorId} role="alert" className="text-[11px] font-medium text-destructive">
          {error}
        </span>
      )}
    </div>
  );
};

const ShadcnTextarea: RegistryComponent = ({ node, placeholder, value, rows, id, name }) => {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  return (
    <ShTextarea
      rows={num(rows, 3)}
      id={str(id) || undefined}
      name={str(name) || undefined}
      placeholder={str(placeholder)}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => {
        if (onChange.length > 0) dispatch(onChange, { value: e.target.value });
      }}
    />
  );
};

interface SelectOption {
  value: string | number;
  label?: string;
}
function toOptions(raw: unknown): SelectOption[] {
  return arr<unknown>(raw)
    .map((o): SelectOption | null => {
      if (typeof o === "string" || typeof o === "number") return { value: o };
      if (o && typeof o === "object") {
        const v = (o as Record<string, unknown>).value;
        if (typeof v === "string" || typeof v === "number") {
          const label = (o as Record<string, unknown>).label;
          return { value: v, label: typeof label === "string" ? label : undefined };
        }
      }
      return null;
    })
    .filter((o): o is SelectOption => o !== null && String(o.value) !== "");
}

const ShadcnSelect: RegistryComponent = ({ node, options, value, placeholder }) => {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  const opts = toOptions(options);
  return (
    <Select
      value={value === null || value === undefined ? undefined : String(value)}
      onValueChange={(val) => {
        if (onChange.length > 0) dispatch(onChange, { value: val });
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={str(placeholder)} />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o, i) => (
          <SelectItem key={i} value={String(o.value)}>
            {o.label ?? String(o.value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const ShadcnCheckbox: RegistryComponent = ({ node, label, checked, id }) => {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  const cid = str(id) || `${node?.id ?? "checkbox"}__cb`;
  return (
    <div className="flex items-center gap-2">
      <ShCheckbox
        id={cid}
        checked={bool(checked)}
        onCheckedChange={(c) => {
          if (onChange.length > 0) dispatch(onChange, { value: c === true });
        }}
      />
      {str(label) && (
        <Label htmlFor={cid} className="text-sm font-normal">
          {str(label)}
        </Label>
      )}
    </div>
  );
};

const ShadcnSwitch: RegistryComponent = ({ node, label, checked, id }) => {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  const sid = str(id) || `${node?.id ?? "switch"}__sw`;
  return (
    <div className="flex items-center gap-2">
      <ShSwitch
        id={sid}
        checked={bool(checked)}
        onCheckedChange={(c) => {
          if (onChange.length > 0) dispatch(onChange, { value: c === true });
        }}
      />
      {str(label) && (
        <Label htmlFor={sid} className="text-sm font-normal">
          {str(label)}
        </Label>
      )}
    </div>
  );
};

const ShadcnForm: RegistryComponent = ({ node, children }) => {
  const { dispatch } = useRuntimeContext();
  const onSubmit = getActions(node?.events, "onSubmit");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (onSubmit.length === 0) return;
        const formData = new FormData(e.currentTarget);
        const values: Record<string, unknown> = {};
        formData.forEach((v, k) => {
          values[k] = typeof v === "string" ? v : v.name;
        });
        dispatch(onSubmit, { values });
      }}
    >
      {children}
    </form>
  );
};

/* ------------------------------------------------------------------ *
 * Tabs + Accordion — children map to items by index, like the built-ins.
 * ------------------------------------------------------------------ */

interface Item {
  value: string;
  label: string;
}
function toItems(raw: unknown): Item[] {
  return arr<unknown>(raw)
    .map((o): Item | null => {
      if (o && typeof o === "object") {
        const v = (o as Record<string, unknown>).value;
        const l = (o as Record<string, unknown>).label;
        if (typeof v === "string") return { value: v, label: typeof l === "string" ? l : v };
      }
      return null;
    })
    .filter((x): x is Item => x !== null);
}

const ShadcnTabs: RegistryComponent = ({ node, tabs, value, children }) => {
  const { dispatch } = useRuntimeContext();
  const items = toItems(tabs);
  const onChange = getActions(node?.events, "onChange");
  const current = str(value, items[0]?.value ?? "");
  const childArr = Children.toArray(children);
  return (
    <Tabs
      value={current}
      onValueChange={(val) => {
        if (onChange.length > 0) dispatch(onChange, { value: val });
      }}
      className="w-full"
    >
      <TabsList>
        {items.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((t, i) => (
        <TabsContent key={t.value} value={t.value}>
          {(childArr[i] as ReactNode) ?? null}
        </TabsContent>
      ))}
    </Tabs>
  );
};

const ShadcnAccordion: RegistryComponent = ({ node, items, openValues, children }) => {
  const { dispatch } = useRuntimeContext();
  const list = toItems(items);
  const onChange = getActions(node?.events, "onChange");
  const open = arr<unknown>(openValues).filter((v): v is string => typeof v === "string");
  const childArr = Children.toArray(children);

  return (
    <Accordion
      type="multiple"
      value={open}
      onValueChange={(next) => {
        if (onChange.length === 0) return;
        // The agent's contract is "onChange fires with {{event.value}} = the
        // toggled item value" (then a toggleState action flips it). Radix hands
        // us the full next set, so recover the single item that changed.
        const before = new Set(open);
        const after = new Set(next);
        const toggled =
          open.find((v) => !after.has(v)) ?? next.find((v) => !before.has(v));
        if (toggled !== undefined) dispatch(onChange, { value: toggled });
      }}
    >
      {list.map((item, i) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.label}</AccordionTrigger>
          <AccordionContent>{(childArr[i] as ReactNode) ?? null}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

/* ------------------------------------------------------------------ *
 * Overlays + links
 * ------------------------------------------------------------------ */

const ShadcnModal: RegistryComponent = ({ node, open, title, children }) => {
  const { dispatch } = useRuntimeContext();
  const onClose = getActions(node?.events, "onClose");
  return (
    <Dialog
      open={bool(open)}
      onOpenChange={(o) => {
        if (!o && onClose.length > 0) dispatch(onClose, {});
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className={str(title) ? undefined : "sr-only"}>
            {str(title) || "Dialog"}
          </DialogTitle>
        </DialogHeader>
        <div>{children}</div>
      </DialogContent>
    </Dialog>
  );
};

const ShadcnLink: RegistryComponent = ({ href, text, newTab, to }) => {
  const { dispatch } = useRuntimeContext();
  const screen = str(to);
  if (screen) {
    return (
      <button
        type="button"
        onClick={() => dispatch([{ type: "navigate", to: screen }])}
        className="text-sm font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
      >
        {str(text, screen)}
      </button>
    );
  }
  const external = bool(newTab);
  return (
    <a
      href={str(href, "#")}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="text-sm text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
    >
      {str(text, str(href))}
    </a>
  );
};

/* ------------------------------------------------------------------ *
 * Registry assembly
 * ------------------------------------------------------------------ */

/**
 * Components mapped onto shadcn/ui. Everything not listed here
 * (Grid, Stack, Section, Box, Spacer, Image, Outlet, ForEach, Heading, Text,
 * List, Quote, Kbd, CodeBlock, Chart) has no shadcn primitive and falls
 * through to the framework's built-ins — which already use the same design
 * tokens shadcn defines, so they look native.
 */
const shadcnOverrides: ComponentRegistry = {
  Icon: LucideIcon,
  Card: ShadcnCard,
  Stat: ShadcnStat,
  Badge: ShadcnBadge,
  Button: ShadcnButton,
  Progress: ShadcnProgress,
  Divider: ShadcnDivider,
  Avatar: ShadcnAvatar,
  Skeleton: ShadcnSkeleton,
  Tooltip: ShadcnTooltip,
  Table: ShadcnTable,
  Input: ShadcnInput,
  Textarea: ShadcnTextarea,
  Select: ShadcnSelect,
  Checkbox: ShadcnCheckbox,
  Switch: ShadcnSwitch,
  Form: ShadcnForm,
  Tabs: ShadcnTabs,
  Accordion: ShadcnAccordion,
  Modal: ShadcnModal,
  Link: ShadcnLink,
};

/**
 * Build a renderer registry that draws the agent's spec with shadcn/ui.
 * Pass your own `overrides` to replace or extend any mapping.
 *
 *   <DashboardRenderer registry={createShadcnRegistry()} ... />
 */
export function createShadcnRegistry(overrides: ComponentRegistry = {}): ComponentRegistry {
  return createRegistry({ ...shadcnOverrides, ...overrides });
}
