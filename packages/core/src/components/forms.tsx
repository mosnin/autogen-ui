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

function inputCls(extra?: string, invalid = false): string {
  return cn(
    "w-full rounded-md border bg-background px-3 py-2 text-sm",
    "outline-none transition-colors placeholder:text-muted-foreground",
    invalid
      ? "border-danger/60 focus:ring-2 focus:ring-danger/40"
      : "border-border focus:ring-2 focus:ring-ring focus:ring-offset-0",
    extra,
  );
}

/* ------------------------------------------------------------------ *
 * Validation
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

export function validateInput(value: unknown, rulesRaw: unknown): string | null {
  if (!rulesRaw || typeof rulesRaw !== "object") return null;
  const rules = rulesRaw as ValidateRules;
  const isEmpty = value === undefined || value === null || value === "";

  if (rules.required && isEmpty) return rules.message ?? "Required";
  if (isEmpty) return null;

  const s = typeof value === "string" ? value : String(value);
  if (typeof rules.minLength === "number" && s.length < rules.minLength) {
    return rules.message ?? `Must be at least ${rules.minLength} characters`;
  }
  if (typeof rules.maxLength === "number" && s.length > rules.maxLength) {
    return rules.message ?? `Must be at most ${rules.maxLength} characters`;
  }
  if (rules.type === "email" && !EMAIL_RE.test(s)) {
    return rules.message ?? "Must be a valid email";
  }
  if (rules.type === "url" && !URL_RE.test(s)) {
    return rules.message ?? "Must be a valid URL";
  }
  if (typeof rules.pattern === "string") {
    try {
      if (!new RegExp(rules.pattern).test(s)) {
        return rules.message ?? "Invalid format";
      }
    } catch {
      // bad pattern — skip
    }
  }

  if (typeof value === "number") {
    if (typeof rules.min === "number" && value < rules.min) {
      return rules.message ?? `Must be at least ${rules.min}`;
    }
    if (typeof rules.max === "number" && value > rules.max) {
      return rules.message ?? `Must be at most ${rules.max}`;
    }
  }
  return null;
}

function ErrorText({ error, id }: { error: string | null; id: string }) {
  if (!error) return null;
  return (
    <span id={id} role="alert" className="text-[11px] font-medium text-danger">
      {error}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

const INPUT_TYPES = ["text", "number", "email", "password", "search", "url", "tel"] as const;

export const Input: RegistryComponent = ({ node, type, placeholder, value, id, name }) => {
  const { dispatch } = useRuntimeContext();
  const t = oneOf(type, INPUT_TYPES, "text");
  const onChange = getActions(node?.events, "onChange");
  const idStr = str(id);
  const nameStr = str(name);
  const error = validateInput(value, (node?.props as { validate?: unknown } | undefined)?.validate);
  const errorId = `${node?.id ?? "input"}__err`;

  return (
    <div className="flex flex-col gap-1">
      <input
        type={t}
        {...(idStr ? { id: idStr } : {})}
        {...(nameStr ? { name: nameStr } : {})}
        placeholder={str(placeholder)}
        value={value === null || value === undefined ? "" : String(value)}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? errorId : undefined}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const v = t === "number" ? Number(e.target.value) : e.target.value;
          if (onChange.length > 0) dispatch(onChange, { value: v, name: e.target.name });
        }}
        className={inputCls(undefined, Boolean(error))}
      />
      <ErrorText error={error} id={errorId} />
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Textarea
 * ------------------------------------------------------------------ */

export const Textarea: RegistryComponent = ({ node, placeholder, value, rows, id, name }) => {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  const idStr = str(id);
  const nameStr = str(name);
  const error = validateInput(value, (node?.props as { validate?: unknown } | undefined)?.validate);
  const errorId = `${node?.id ?? "textarea"}__err`;
  return (
    <div className="flex flex-col gap-1">
      <textarea
        rows={num(rows, 3)}
        {...(idStr ? { id: idStr } : {})}
        {...(nameStr ? { name: nameStr } : {})}
        placeholder={str(placeholder)}
        value={value === null || value === undefined ? "" : String(value)}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? errorId : undefined}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
          if (onChange.length > 0) dispatch(onChange, { value: e.target.value });
        }}
        className={inputCls("resize-y", Boolean(error))}
      />
      <ErrorText error={error} id={errorId} />
    </div>
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

export const Select: RegistryComponent = ({ node, options, value, placeholder, id, name }) => {
  const { dispatch } = useRuntimeContext();
  const onChange = getActions(node?.events, "onChange");
  const opts = toOptions(options);
  const idStr = str(id);
  const nameStr = str(name);
  return (
    <select
      {...(idStr ? { id: idStr } : {})}
      {...(nameStr ? { name: nameStr } : {})}
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
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              fire(!isOn);
            }
          }}
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
