import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

// The agent + fake client live in `src/server/agent.ts` and are loaded
// through Vite's own SSR module graph (`server.ssrLoadModule`). That route
// lets Vite resolve `@autogen-ui/core/server` correctly in dev — the alt
// "import at the top of vite.config.ts" path goes through Node's native ESM
// resolver, which doesn't follow the package's extensionless dist imports.
function autogenUiApi(): PluginOption {
  return {
    name: "autogen-ui-api",
    configureServer(server) {
      server.middlewares.use("/api/autogen-ui", async (req, res, next) => {
        if (req.method !== "POST") return next();
        try {
          const mod = (await server.ssrLoadModule("/src/server/agent.ts")) as {
            apiHandler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
          };
          await mod.apiHandler(req, res);
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), autogenUiApi()],
  server: {
    port: 5173,
  },
});
