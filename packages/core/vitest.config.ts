import { defineConfig } from "vitest/config";

/**
 * Unit + component test config for @autogen-ui/core.
 *
 * Pure-logic tests (patch engine, binding engine, schema, proxy, server-render)
 * run in the default `node` environment. Component/render tests opt into jsdom
 * with a `// @vitest-environment jsdom` docblock at the top of the file.
 *
 * The long-standing end-to-end suite (`scripts/run-eval.ts`) remains the
 * integration layer and runs separately via `pnpm test:integration`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.d.ts",
        "src/index.ts",
        "src/server.ts",
        "src/node.ts",
      ],
      // Ratchet: per-file floors on the critical engines that now have unit
      // tests. These only fail if someone REGRESSES coverage on a covered file;
      // later phases raise the floors and add files. (The integration suite in
      // scripts/run-eval.ts covers far more but is not measured by v8 here.)
      thresholds: {
        "src/patch.ts": { lines: 75, functions: 90 },
        "src/proxy.ts": { lines: 78, functions: 90 },
        "src/schema.ts": { lines: 95 },
        "src/server-render.ts": { lines: 90, functions: 90 },
        "src/renderer.tsx": { lines: 78 },
        "src/data.ts": { lines: 44 },
        "src/clients/http.ts": { lines: 85, functions: 85 },
      },
    },
  },
});
