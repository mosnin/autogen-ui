"use client";

import { createElement, type ComponentType, type ReactNode } from "react";
import type { RegistryComponent } from "./components/types";

/**
 * Component adapters — bridge the agent's spec props to a host component's
 * prop shape. The host doesn't have to rewrite their `Card` to accept
 * `title`/`description`: they wrap it once and the renderer drives it.
 *
 *   const registry = createRegistry({
 *     Card: createComponentAdapter({
 *       Component: AcmeCard,
 *       mapProps: { title: "heading", description: "subhead" },
 *       defaults: { variant: "elevated" },
 *     }),
 *   });
 */

export interface ComponentAdapterOptions<HostProps extends object> {
  /** The host's React component. */
  Component: ComponentType<HostProps>;
  /**
   * Rename agent spec props to host props. e.g. `{ title: "heading" }` —
   * the agent emits `props.title`, the host receives `props.heading`.
   */
  mapProps?: Record<string, string>;
  /**
   * Compute host props from the agent's full prop dict. Runs after
   * `mapProps`; returned fields override mapped ones.
   */
  computeProps?: (agentProps: Record<string, unknown>) => Partial<HostProps>;
  /**
   * Route children into named slots. Agent emits `children: UINode[]`; the
   * renderer renders them and hands the resulting ReactNode array to this
   * function, which can pull them out by index or route them into the
   * host's slot props (`{ header, body, footer }`).
   */
  mapChildren?: (
    children: ReactNode,
    agentProps: Record<string, unknown>,
  ) => Partial<HostProps>;
  /** Host props always merged in first; can be overridden by mapping. */
  defaults?: Partial<HostProps>;
}

/**
 * Build a `RegistryComponent` that wraps a host component. Drop the result
 * into `createRegistry({ Card: ... })`.
 */
export function createComponentAdapter<HostProps extends object>(
  opts: ComponentAdapterOptions<HostProps>,
): RegistryComponent {
  return function Adapted(props) {
    const { node: _node, children, ...agentProps } = props;
    void _node;

    const out: Record<string, unknown> = { ...(opts.defaults ?? {}) };

    if (opts.mapProps) {
      for (const [from, to] of Object.entries(opts.mapProps)) {
        if (from in agentProps) out[to] = (agentProps as Record<string, unknown>)[from];
      }
    }

    // Pass through agent props that weren't explicitly mapped — the host can
    // ignore unknown props, and renames take precedence.
    const mappedSources = new Set(Object.keys(opts.mapProps ?? {}));
    for (const [k, v] of Object.entries(agentProps)) {
      if (!mappedSources.has(k) && !(k in out)) out[k] = v;
    }

    if (opts.computeProps) Object.assign(out, opts.computeProps(agentProps as Record<string, unknown>));

    if (opts.mapChildren) {
      Object.assign(out, opts.mapChildren(children, agentProps as Record<string, unknown>));
    } else if (children !== undefined) {
      out.children = children;
    }

    return createElement(opts.Component as ComponentType<unknown>, out);
  };
}

/**
 * Shortcut for a plain prop rename — the most common adapter case.
 *
 *   mapComponent(AcmeCard, { title: "heading", description: "subhead" })
 */
export function mapComponent<HostProps extends object>(
  Component: ComponentType<HostProps>,
  mapProps: Record<string, string>,
): RegistryComponent {
  return createComponentAdapter({ Component, mapProps });
}
