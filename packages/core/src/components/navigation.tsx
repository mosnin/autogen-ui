"use client";

import { Children, isValidElement, type ReactNode } from "react";
import { useRuntimeContext } from "../runtime-context";
import type { Action, EventMap } from "../schema";
import { cn } from "../utils";
import { arr, bool, str } from "./helpers";
import type { ComponentRegistry, RegistryComponent } from "./types";
import type { ComponentDoc } from "../registry";

function getActions(events: EventMap | undefined, name: string): Action[] {
  const list = events?.[name];
  return Array.isArray(list) ? list : [];
}

interface TabItem {
  value: string;
  label: string;
}

interface AccordionItem {
  value: string;
  label: string;
}

function toItems(raw: unknown): TabItem[] {
  return arr<unknown>(raw)
    .map((o): TabItem | null => {
      if (o && typeof o === "object") {
        const v = (o as Record<string, unknown>).value;
        const l = (o as Record<string, unknown>).label;
        if (typeof v === "string") {
          return { value: v, label: typeof l === "string" ? l : v };
        }
      }
      return null;
    })
    .filter((x): x is TabItem => x !== null);
}

/* ------------------------------------------------------------------ *
 * Tabs
 * ------------------------------------------------------------------ */

export const Tabs: RegistryComponent = ({ node, tabs, value, children }) => {
  const { dispatch } = useRuntimeContext();
  const items = toItems(tabs);
  const onChange = getActions(node?.events, "onChange");
  const current = str(value, items[0]?.value ?? "");
  const childArr = Children.toArray(children);
  const activeIdx = items.findIndex((t) => t.value === current);
  const showIdx = activeIdx >= 0 ? activeIdx : 0;

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="flex flex-row gap-2 border-b border-border">
        {items.map((t, i) => {
          const active = i === showIdx;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (onChange.length > 0) dispatch(onChange, { value: t.value });
              }}
              className={cn(
                "px-3 py-2 text-sm font-medium transition-colors -mb-px",
                active
                  ? "border-b-2 border-primary text-foreground"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div>
        {childArr.map((child, i) => {
          const visible = i === showIdx;
          if (!isValidElement(child) && typeof child !== "string" && typeof child !== "number") {
            return null;
          }
          return (
            <div key={i} hidden={!visible} role="tabpanel">
              {visible ? child : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Accordion
 * ------------------------------------------------------------------ */

export const Accordion: RegistryComponent = ({ node, items, openValues, children }) => {
  const { dispatch } = useRuntimeContext();
  const list = toItems(items) as AccordionItem[];
  const onChange = getActions(node?.events, "onChange");
  const open = new Set(arr<string>(openValues).filter((v) => typeof v === "string"));
  const childArr = Children.toArray(children);

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden">
      {list.map((item, i) => {
        const isOpen = open.has(item.value);
        const child = childArr[i];
        return (
          <div key={item.value} className="border-b border-border last:border-b-0">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => {
                if (onChange.length > 0) dispatch(onChange, { value: item.value });
              }}
              className={cn(
                "flex w-full items-center justify-between px-4 py-3 text-sm font-medium",
                "text-foreground hover:bg-accent transition-colors",
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "ml-2 inline-block transition-transform text-muted-foreground",
                  isOpen ? "rotate-90" : "rotate-0",
                )}
                aria-hidden="true"
              >
                ›
              </span>
            </button>
            {isOpen && child !== undefined && (
              <div className="px-4 py-3 border-t border-border bg-background">{child as ReactNode}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Link
 * ------------------------------------------------------------------ */

export const Link: RegistryComponent = ({ href, text, newTab }) => {
  const isExternal = bool(newTab, false);
  return (
    <a
      href={str(href, "#")}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors text-sm"
    >
      {str(text, str(href))}
    </a>
  );
};

/* ------------------------------------------------------------------ *
 * Breadcrumb
 * ------------------------------------------------------------------ */

interface CrumbItem {
  label: string;
  href?: string;
}

function toCrumbs(raw: unknown): CrumbItem[] {
  return arr<unknown>(raw)
    .map((o): CrumbItem | null => {
      if (o && typeof o === "object") {
        const l = (o as Record<string, unknown>).label;
        const h = (o as Record<string, unknown>).href;
        if (typeof l === "string") {
          return { label: l, href: typeof h === "string" ? h : undefined };
        }
      }
      return null;
    })
    .filter((x): x is CrumbItem => x !== null);
}

export const Breadcrumb: RegistryComponent = ({ items }) => {
  const crumbs = toCrumbs(items);
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-row flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={i} className="flex flex-row items-center gap-1">
              {isLast || !c.href ? (
                <span className={cn(isLast && "text-foreground font-medium")}>{c.label}</span>
              ) : (
                <a
                  href={c.href}
                  className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
                >
                  {c.label}
                </a>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-muted-foreground/60">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

/* ------------------------------------------------------------------ *
 * Registry, catalog, default spans
 * ------------------------------------------------------------------ */

export const navigationComponents: ComponentRegistry = {
  Tabs,
  Accordion,
  Link,
  Breadcrumb,
};

export const navigationCatalog: ComponentDoc[] = [
  {
    type: "Tabs",
    description:
      "Tabbed container. Child at index N corresponds to tabs[N]. Bind `value` to state and wire `onChange` with `{{event.value}}` to switch the active tab.",
    props: "tabs: {value:string,label:string}[], value?: string",
    acceptsChildren: true,
  },
  {
    type: "Accordion",
    description:
      "Collapsible sections. Child at index N maps to items[N]. Bind `openValues` to a string[] in state and wire `onChange` with a toggleState action driven by `{{event.value}}`.",
    props: "items: {value:string,label:string}[], openValues?: string[]",
    acceptsChildren: true,
  },
  {
    type: "Link",
    description: "Anchor link. Opens in a new tab when `newTab` is true.",
    props: "href: string, text: string, newTab?: boolean",
    acceptsChildren: false,
  },
  {
    type: "Breadcrumb",
    description: "Breadcrumb trail. Last item is plain text, earlier items are links if `href` is set.",
    props: "items: {label:string, href?:string}[]",
    acceptsChildren: false,
  },
];

export const navigationDefaultSpans: Record<string, number> = {
  Tabs: 12,
  Accordion: 12,
  Link: 4,
  Breadcrumb: 12,
};
