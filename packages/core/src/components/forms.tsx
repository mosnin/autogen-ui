"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useRuntimeContext } from "../runtime-context";
import type { Action, EventMap, UINode } from "../schema";
import { cn } from "../utils";
import { arr, bool, num, oneOf, str } from "./helpers";
import type { RegistryComponent } from "./types";

/**
 * Interactive form components. Unlike presentational primitives, these
 * actually fire `onChange`/`onSubmit` through the runtime dispatcher and
 * pass the event value as a payload — referenceable from action values
 * via `{{event.value}}`.
 */

function getActions(events: EventMap | undefined, name: string): Action[] {
  const list = events?.[name];
  return Array.isArray(list) ? list : [];
}

function inputCls(extra?: string): string {
  return cn(
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
    "outline-none transition-colors placeholder:text-muted-foreground",
    "focus:ring-2 focus:ring-ring focus:ring-offset-0",
    extra,
  );
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

const INPUT_TYPES = ["text", "number", "email", "password", "search", "url", "tel"] as const;

export const Input: RegistryComponent = ({ node, type, placeholder, value }) => {
  const { dispatch } = useRuntimeContext();
  const t = oneOf(type, INPUT_TYPES, "text");
  const onChange = getActions(node?.events, "onChange");

  return (
    <input
      type={t}
      placeholder={str(placeholder)}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const v = t === "number" ? Number(e.target.value) : e.target.value;
        if (onChange.length > 0) dispatch(onChange, { value: v, name: e.target.name });
      }}
      className={inputCls()}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Textarea
 * ------------------------------------------------------------------ */

export const Textarea: RegistryComponent = ({ node, placeholder, value, rows }) => {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  return (
    <textarea
      rows={num(rows, 3)}
      placeholder={str(placeholder)}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
        if (onChange.length > 0) dispatch(onChange, { value: e.target.value });
      }}
      className={inputCls("resize-y")}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Select
 * ------------------------------------------------------------------ */

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
    .filter((o): o is SelectOption => o !== null);
}

export const Select: RegistryComponent = ({ node, options, value, placeholder }) => {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  const opts = toOptions(options);
  return (
    <select
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        if (onChange.length > 0) dispatch(onChange, { value: e.target.value });
      }}
      className={inputCls()}
    >
      {str(placeholder) && (
        <option value="" disabled>
          {str(placeholder)}
        </option>
      )}
      {opts.map((o, i) => (
        <option key={i} value={String(o.value)}>
          {o.label ?? String(o.value)}
        </option>
      ))}
    </select>
  );
};

/* ------------------------------------------------------------------ *
 * Checkbox + Switch
 * ------------------------------------------------------------------ */

function CheckLike({
  node,
  label,
  checked,
  variant,
}: {
  node?: UINode;
  label?: unknown;
  checked?: unknown;
  variant: "checkbox" | "switch";
}) {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  const isOn = bool(checked, false);

  const fire = (next: boolean) => {
    if (onChange.length > 0) dispatch(onChange, { value: next });
  };

  if (variant === "switch") {
    return (
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <span
          role="switch"
          aria-checked={isOn}
          tabIndex={0}
          onClick={() => fire(!isOn)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            isOn ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
              isOn ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </span>
        {str(label) && <span>{str(label)}</span>}
      </label>
    );
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={isOn}
        onChange={(e) => fire(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      {str(label) && <span>{str(label)}</span>}
    </label>
  );
}

export const Checkbox: RegistryComponent = (props) => (
  <CheckLike node={props.node} label={props.label} checked={props.checked} variant="checkbox" />
);

export const Switch: RegistryComponent = (props) => (
  <CheckLike node={props.node} label={props.label} checked={props.checked} variant="switch" />
);

/* ------------------------------------------------------------------ *
 * Form
 * ------------------------------------------------------------------ */

export const Form: RegistryComponent = ({ node, children }) => {
  const { dispatch } = useRuntimeContext();
  const onSubmit = getActions(node?.events, "onSubmit");
  return (
    <form
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (onSubmit.length === 0) return;
        const formData = new FormData(e.currentTarget);
        const values: Record<string, unknown> = {};
        formData.forEach((v, k) => {
          values[k] = typeof v === "string" ? v : v.name;
        });
        dispatch(onSubmit, { values });
      }}
      className="flex flex-col gap-3"
    >
      {children}
    </form>
  );
};
