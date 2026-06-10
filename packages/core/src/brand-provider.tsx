"use client";

import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import { brandToCssVars, type BrandKit } from "./brand";

/**
 * `<BrandProvider>` writes the kit's tokens as CSS variables on a wrapper
 * div and exposes the kit via context. Place it just inside the host's app
 * shell so every `DashboardRenderer` inside picks up the brand identity.
 *
 * Dark-mode overrides are NOT applied automatically — let the host's
 * theme switch (e.g. toggling `.dark` on `<html>`) do that. The kit's
 * `dark.*` colors are documented for hosts that want to extract them.
 */

const BrandContext = createContext<BrandKit | null>(null);

export interface BrandProviderProps {
  kit?: BrandKit;
  className?: string;
  children: ReactNode;
}

export function BrandProvider({ kit, className, children }: BrandProviderProps) {
  const style = useMemo<CSSProperties>(() => brandToCssVars(kit) as CSSProperties, [kit]);
  return (
    <BrandContext.Provider value={kit ?? null}>
      <div className={className} style={style} data-brand={kit?.name ?? undefined}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}

/** Access the active `BrandKit` from anywhere inside `<BrandProvider>`. */
export function useBrand(): BrandKit | null {
  return useContext(BrandContext);
}
