"use client";

import { Component, type ReactNode } from "react";

interface Props {
  /** The node id this boundary is wrapping (for the fallback message). */
  nodeId?: string;
  children: ReactNode;
  /** Custom fallback. Defaults to a small inline error card. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors from a single spec node so one malformed
 * subtree can't bring the whole dashboard down. The renderer wraps every
 * node in one of these.
 */
export class NodeErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (typeof console !== "undefined") {
      console.error(
        `[autogen-ui] render failed${this.props.nodeId ? ` in "${this.props.nodeId}"` : ""}:`,
        error,
      );
    }
  }

  reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="rounded-lg border border-dashed border-rose-500/50 bg-rose-500/5 p-3 text-xs text-rose-600 dark:text-rose-400">
          Render failed
          {this.props.nodeId ? (
            <>
              {" "}
              in <code className="font-mono">{this.props.nodeId}</code>
            </>
          ) : null}
          : {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
