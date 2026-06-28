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
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 p-4"
        >
          <div className="flex items-center gap-2">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm0 3.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 5.5Zm0 6.25a.875.875 0 1 1 0 1.75.875.875 0 0 1 0-1.75Z" />
            </svg>
            <span className="text-xs font-medium text-muted-foreground">
              {this.props.nodeId ? `"${this.props.nodeId}"` : "Component"} unavailable
            </span>
          </div>
          <button
            onClick={this.reset}
            className="self-start text-xs text-muted-foreground/70 underline underline-offset-2 hover:text-muted-foreground"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
