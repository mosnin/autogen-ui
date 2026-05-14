import type { RuntimeContext } from "./runtime";
import type { Action, EventMap } from "./schema";

/**
 * Declarative, allowlisted behaviour (Phase 4). The agent never emits code —
 * only `Action` lists drawn from a fixed vocabulary, executed here.
 */

export interface CreateDispatcherArgs {
  getState: () => Record<string, unknown>;
  setState: (path: string, value: unknown) => void;
  refetch: (sourceId: string) => void;
  /** Optional scroll override; falls back to `scrollIntoView`. */
  scrollTo?: (nodeId: string) => void;
  /** Notified for `emitEvent` actions. */
  onEvent?: (name: string, payload: unknown) => void;
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

/**
 * Build a dispatcher that executes an `Action[]`. Every action type maps to a
 * single, bounded side effect — no arbitrary code paths.
 */
export function createDispatcher(args: CreateDispatcherArgs): (actions: Action[]) => void {
  const { getState, setState, refetch, scrollTo, onEvent } = args;

  return function dispatch(actions: Action[]): void {
    for (const action of actions) {
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
        default:
          break;
      }
    }
  };
}

/* ------------------------------------------------------------------ *
 * compileEvents
 * ------------------------------------------------------------------ */

/**
 * `RendererExtensions.compileEvents` implementation. Maps spec event names to
 * DOM handler props that dispatch the bound action list. `onLoad` is fired by
 * an effect elsewhere, so it is ignored here.
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

  const onChange = events.onChange;
  if (onChange && onChange.length > 0) {
    handlers.onChange = (event: { target?: { value?: unknown } }) => {
      ctx.dispatch(onChange);
      void event;
    };
  }

  const onSubmit = events.onSubmit;
  if (onSubmit && onSubmit.length > 0) {
    handlers.onSubmit = (event: { preventDefault?: () => void }) => {
      event.preventDefault?.();
      ctx.dispatch(onSubmit);
    };
  }

  return handlers;
}
