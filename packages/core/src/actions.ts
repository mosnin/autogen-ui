import type { RuntimeContext } from "./runtime";
import type { Action, EventMap, JsonValue } from "./schema";

/**
 * Declarative, allowlisted behaviour (Phase 4). The agent never emits code —
 * only `Action` lists drawn from a fixed vocabulary, executed here.
 *
 * Actions may reference an event payload via `{{event.<key>}}` inside string
 * values (e.g. `{ type: "setState", path: "filter", value: "{{event.value}}" }`
 * wired to an Input's `onChange` substitutes the input's current value).
 */

export interface CreateDispatcherArgs {
  getState: () => Record<string, unknown>;
  setState: (path: string, value: unknown) => void;
  refetch: (sourceId: string) => void;
  /** Optional scroll override; falls back to `scrollIntoView`. */
  scrollTo?: (nodeId: string) => void;
  /** Notified for `emitEvent` actions. */
  onEvent?: (name: string, payload: unknown) => void;
  /**
   * Optional handler for `callFunction` actions — fires an agent-defined
   * function (e.g. an HTTP POST) and dispatches onSuccess/onError lists.
   */
  callFunction?: (
    name: string,
    args: unknown,
    callbacks: {
      into?: string;
      onSuccess?: unknown[];
      onError?: unknown[];
    },
    eventPayload?: Record<string, unknown>,
  ) => void;
}

/** Read a dot-path out of a plain object. */
function readPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".").filter(Boolean);
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

const EVENT_TOKEN = /\{\{\s*event\.([\w.]+)\s*\}\}/g;

/**
 * Substitute `{{event.<key>}}` tokens inside any string value in the action
 * tree against `payload`. Numbers/booleans inside a whole-string token become
 * their typed value; embedded tokens always interpolate as strings.
 */
function resolveAction(action: Action, payload?: Record<string, unknown>): Action {
  if (!payload) return action;

  const substitute = (value: JsonValue): JsonValue => {
    if (typeof value === "string") {
      const wholeMatch = /^\{\{\s*event\.([\w.]+)\s*\}\}$/.exec(value);
      if (wholeMatch) {
        const v = readPath(payload, wholeMatch[1]!);
        return (v ?? null) as JsonValue;
      }
      if (EVENT_TOKEN.test(value)) {
        EVENT_TOKEN.lastIndex = 0;
        return value.replace(EVENT_TOKEN, (_, key) => {
          const v = readPath(payload, String(key));
          return v == null ? "" : String(v);
        });
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(substitute) as JsonValue;
    if (value && typeof value === "object") {
      const out: Record<string, JsonValue> = {};
      for (const [k, v] of Object.entries(value)) out[k] = substitute(v as JsonValue);
      return out;
    }
    return value;
  };

  switch (action.type) {
    case "setState":
      return { ...action, value: substitute(action.value) };
    case "emitEvent":
      return action.payload === undefined
        ? action
        : { ...action, payload: substitute(action.payload) };
    case "openUrl":
      return { ...action, url: String(substitute(action.url)) };
    case "scrollTo":
      return { ...action, nodeId: String(substitute(action.nodeId)) };
    case "callFunction":
      return action.args === undefined
        ? action
        : { ...action, args: substitute(action.args) };
    default:
      return action;
  }
}

/**
 * Build a dispatcher that executes an `Action[]`. Every action type maps to a
 * single, bounded side effect — no arbitrary code paths. An optional
 * `payload` carries event data referenceable via `{{event.<key>}}`.
 */
export function createDispatcher(args: CreateDispatcherArgs) {
  const { getState, setState, refetch, scrollTo, onEvent, callFunction } = args;

  return function dispatch(actions: Action[], payload?: Record<string, unknown>): void {
    for (const raw of actions) {
      const action = resolveAction(raw, payload);
      switch (action.type) {
        case "setState":
          setState(action.path, action.value);
          break;
        case "toggleState": {
          const current = readPath(getState(), action.path);
          setState(action.path, !current);
          break;
        }
        case "refetch":
          refetch(action.sourceId);
          break;
        case "openUrl": {
          if (typeof window === "undefined") break;
          if (action.newTab) window.open(action.url, "_blank", "noopener,noreferrer");
          else window.location.assign(action.url);
          break;
        }
        case "scrollTo": {
          if (scrollTo) {
            scrollTo(action.nodeId);
          } else if (typeof document !== "undefined") {
            document.getElementById(action.nodeId)?.scrollIntoView({ behavior: "smooth" });
          }
          break;
        }
        case "emitEvent":
          onEvent?.(action.name, action.payload ?? null);
          break;
        case "navigate":
          setState("currentScreen", action.to);
          break;
        case "callFunction":
          callFunction?.(
            action.name,
            action.args ?? {},
            {
              into: action.into,
              onSuccess: action.onSuccess,
              onError: action.onError,
            },
            payload,
          );
          break;
        default:
          break;
      }
    }
  };
}

export type Dispatch = ReturnType<typeof createDispatcher>;

/* ------------------------------------------------------------------ *
 * compileEvents
 * ------------------------------------------------------------------ */

/**
 * `RendererExtensions.compileEvents` implementation. Only `onClick` is wired
 * to the wrapper; `onChange`/`onSubmit` are semantically owned by the inner
 * form element and consumed by form components directly (via
 * `useRuntimeContext` + `node.events`).
 */
export function compileEvents(
  events: EventMap,
  ctx: RuntimeContext,
): Record<string, unknown> {
  const handlers: Record<string, unknown> = {};
  const onClick = events.onClick;
  if (onClick && onClick.length > 0) {
    handlers.onClick = () => ctx.dispatch(onClick);
  }
  return handlers;
}
