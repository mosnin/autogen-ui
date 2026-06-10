"use client";

import type { ReactNode } from "react";

/**
 * A fake host-app shell — sidebar nav, top header — wrapping a child
 * panel. Demonstrates the framework embedded *inside* an existing app,
 * not as a takeover.
 */
export function HostMockup({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-background shadow-2xl shadow-primary/5">
      <div className="flex h-[560px]">
        {/* Sidebar placeholder — quiet, just enough to read as "host nav" */}
        <aside className="hidden w-[200px] flex-col gap-4 border-r border-border/60 bg-card/30 p-5 md:flex">
          <div className="h-3 w-24 rounded-full bg-foreground/12" />
          <div className="mt-2 space-y-2">
            <div className="h-2.5 w-32 rounded-full bg-foreground/8" />
            <div className="h-2.5 w-28 rounded-full bg-foreground/8" />
            <div className="h-2.5 w-20 rounded-full bg-foreground/15" />
            <div className="h-2.5 w-30 rounded-full bg-foreground/8" />
            <div className="h-2.5 w-24 rounded-full bg-foreground/8" />
          </div>
          <div className="mt-auto space-y-2">
            <div className="h-2 w-16 rounded-full bg-foreground/6" />
            <div className="h-2 w-20 rounded-full bg-foreground/6" />
          </div>
        </aside>

        {/* Main content area — header + content well */}
        <main className="flex-1 overflow-hidden">
          <header className="flex items-center justify-between border-b border-border/60 bg-card/30 px-6 py-3.5">
            <div className="h-3 w-28 rounded-full bg-foreground/15" />
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-foreground/10" />
            </div>
          </header>
          <div className="h-[calc(100%-49px)] overflow-y-auto p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
