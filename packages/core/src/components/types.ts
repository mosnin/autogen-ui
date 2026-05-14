import type { ComponentType, ReactNode } from "react";
import type { UINode } from "../schema";

/**
 * Props handed to every registry component: the spec node's `props`
 * spread for ergonomic access, plus already-rendered `children` and
 * the raw `node` for components that need their own id or metadata.
 */
export interface RegistryComponentProps {
  [key: string]: unknown;
  children?: ReactNode;
  node?: UINode;
}

export type RegistryComponent = ComponentType<RegistryComponentProps>;

export type ComponentRegistry = Record<string, RegistryComponent>;
