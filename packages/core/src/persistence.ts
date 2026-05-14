import { parseDashboard, SPEC_VERSION, type Dashboard } from "./schema";

/**
 * Persistence helpers: serialize dashboards to JSON, restore them through the
 * schema (so older specs are validated and migrated), and store/load from
 * `localStorage`. All browser APIs are guarded so this is import-safe on the
 * server.
 */

/** Default key used by `saveDashboard`/`loadDashboard` when none is given. */
export const STORAGE_KEY = "autogen-ui:dashboard";

/** Serialize a dashboard to a JSON string. */
export function serializeDashboard(d: Dashboard): string {
  return JSON.stringify(d);
}

/**
 * Parse a JSON string back into a current-version `Dashboard`. If the encoded
 * value is missing `version` or carries an older one, it is coerced to the
 * current `SPEC_VERSION` before validation so `parseDashboard` can migrate it.
 */
export function deserializeDashboard(json: string): Dashboard {
  const raw = JSON.parse(json) as unknown;
  let value = raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const version = obj.version;
    if (typeof version !== "number" || version < SPEC_VERSION) {
      value = { ...obj, version: SPEC_VERSION };
    }
  }
  return parseDashboard(value);
}

/** Persist a dashboard to `localStorage`. No-op outside the browser. */
export function saveDashboard(key: string, d: Dashboard): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, serializeDashboard(d));
  } catch {
    // storage full, disabled, or unavailable — drop silently.
  }
}

/**
 * Load a dashboard from `localStorage`. Returns null when missing, outside the
 * browser, or when the stored value is corrupt/invalid.
 */
export function loadDashboard(key: string): Dashboard | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const json = window.localStorage.getItem(key);
    if (json === null) return null;
    return deserializeDashboard(json);
  } catch {
    return null;
  }
}

/** Build a downloadable JSON `Blob` of the dashboard (for export-to-file). */
export function exportDashboardFile(d: Dashboard): Blob {
  return new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
}
