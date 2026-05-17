"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRuntimeContext } from "../runtime-context";
import type { Action, EventMap } from "../schema";
import { cn } from "../utils";
import { bool, oneOf, str } from "./helpers";
import type { ComponentRegistry, RegistryComponent } from "./types";
import type { ComponentDoc } from "../registry";

function getActions(events: EventMap | undefined, name: string): Action[] {
  const list = events?.[name];
  return Array.isArray(list) ? list : [];
}

/* ------------------------------------------------------------------ *
 * Modal
 * ------------------------------------------------------------------ */

export const Modal: RegistryComponent = ({ node, open, title, children }) => {
  const { dispatch } = useRuntimeContext();
  const isOpen = bool(open, false);
  const onClose = getActions(node?.events, "onClose");

  const fireClose = () => {
    if (onClose.length > 0) dispatch(onClose, {});
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={fireClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              "relative z-10 w-full max-w-lg rounded-xl border border-border bg-card text-card-foreground shadow-xl",
              "p-5 flex flex-col gap-3",
            )}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
          >
            <div className="flex items-start justify-between gap-3">
              {str(title) ? (
                <h3 className="font-semibold leading-none tracking-tight">{str(title)}</h3>
              ) : (
                <span />
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={fireClose}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md",
                  "text-muted-foreground hover:bg-accent hover:text-foreground transition-colors -mr-1 -mt-1",
                )}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>
            <div>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ *
 * Tooltip
 * ------------------------------------------------------------------ */

const TOOLTIP_SIDES = ["top", "bottom", "left", "right"] as const;

const TOOLTIP_POS: Record<(typeof TOOLTIP_SIDES)[number], string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export const Tooltip: RegistryComponent = ({ text, side, children }) => {
  const s = oneOf(side, TOOLTIP_SIDES, "top");
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-40 whitespace-nowrap rounded-md bg-foreground px-2 py-1",
          "text-xs font-medium text-background shadow-md",
          "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
          TOOLTIP_POS[s],
        )}
      >
        {str(text)}
      </span>
    </span>
  );
};

/* ------------------------------------------------------------------ *
 * Registry, catalog, default spans
 * ------------------------------------------------------------------ */

export const overlaysComponents: ComponentRegistry = {
  Modal,
  Tooltip,
};

export const overlaysCatalog: ComponentDoc[] = [
  {
    type: "Modal",
    description:
      "Dialog overlay. Bind `open` to a boolean in state to show/hide. Wire `onClose` to a setState/toggleState action to dismiss when the backdrop or close button is clicked.",
    props: "open?: boolean, title?: string",
    acceptsChildren: true,
  },
  {
    type: "Tooltip",
    description: "Wraps a child and shows a small dark popover with `text` on hover.",
    props: "text: string, side?: 'top'|'bottom'|'left'|'right'",
    acceptsChildren: true,
  },
];

export const overlaysDefaultSpans: Record<string, number> = {
  Modal: 12,
  Tooltip: 3,
};
