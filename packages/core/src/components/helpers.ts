/** Loose prop accessors — the model emits JSON, so props arrive untyped. */

export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}
