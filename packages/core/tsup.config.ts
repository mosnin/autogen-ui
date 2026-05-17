import { defineConfig } from "tsup";

/**
 * Dual ESM + CJS build for @autogen-ui/core.
 *
 * Key constraints:
 *  - The package contains many files that begin with a `"use client"`
 *    directive. Next.js RSC relies on the per-file directive to know which
 *    modules are client modules, so the build MUST preserve those directives
 *    in their compiled output, one-to-one with source files.
 *  - We therefore disable bundling (`bundle: false`) and splitting so that
 *    esbuild transforms each source file individually. Every file in `src/`
 *    becomes a sibling file in `dist/`, with the directive intact.
 *  - ESM output uses `.js` (matches the historical import path), CJS uses
 *    `.cjs`. Type declarations are emitted via tsup's `dts: true`.
 */
export default defineConfig({
  entry: ["src/**/*.ts", "src/**/*.tsx", "!src/**/*.d.ts"],
  format: ["esm", "cjs"],
  dts: true,
  target: "es2021",
  sourcemap: true,
  clean: true,
  outDir: "dist",
  splitting: false,
  bundle: false,
  treeshake: false,
  skipNodeModulesBundle: true,
  // With bundle: false, externals are largely a no-op, but keep them for
  // safety in case any individual file is ever bundled in the future.
  external: [
    "react",
    "react-dom",
    "framer-motion",
    "zod",
    "clsx",
    "tailwind-merge",
  ],
  outExtension({ format }) {
    if (format === "esm") return { js: ".js" };
    if (format === "cjs") return { js: ".cjs" };
    return { js: ".js" };
  },
});
