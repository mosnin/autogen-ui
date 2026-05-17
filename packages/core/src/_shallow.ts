import { useRef } from "react";

/**
 * Shallow object equality on enumerable own keys + values. Treats two
 * `undefined` references as equal; otherwise both must be objects with
 * matching keys and `Object.is`-equal values.
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === undefined || b === undefined) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!Object.is(ao[k], bo[k])) return false;
  }
  return true;
}

/**
 * Returns the previously-stored reference when the incoming value is
 * shallow-equal to it. This isolates downstream `useMemo` consumers from
 * the inline-literal footgun where a parent passes `{}` or
 * `{data, dispatch}` as JSX literals on every render.
 */
export function useShallowMemo<T>(value: T): T {
  const ref = useRef<T>(value);
  if (!shallowEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}
