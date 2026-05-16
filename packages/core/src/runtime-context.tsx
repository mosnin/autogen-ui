"use client";

import { createContext, useContext } from "react";
import type { RuntimeContext } from "./runtime";

/**
 * React context carrying the live `RuntimeContext` (data, state, dispatch).
 * Kept in its own tiny file so form components can consume it without
 * creating an import cycle through the renderer.
 */
export const RuntimeReactContext = createContext<RuntimeContext | null>(null);

/**
 * Access the live `RuntimeContext` from inside a registry component. Form
 * components use this to wire their inner `<input>`/`<select>`/`<form>`
 * events through the dispatcher.
 */
export function useRuntimeContext(): RuntimeContext {
  const ctx = useContext(RuntimeReactContext);
  if (!ctx) {
    throw new Error("[autogen-ui] useRuntimeContext must be used inside DashboardRenderer");
  }
  return ctx;
}
