#!/usr/bin/env node
// create-autogen-ui — scaffold a Next.js app preconfigured with @autogen-ui/core.
//
//   npx create-autogen-ui my-app
//
// Plain Node, zero runtime deps.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
void _filename;

const PKG_VERSION = "0.2.0";

function usage() {
  process.stdout.write(`create-autogen-ui — scaffold or audit an autogen-ui app

Usage:
  npx create-autogen-ui [name]            Scaffold a new project
  npx create-autogen-ui doctor            Audit the current directory

Options:
  --provider <claude|openai>   LLM provider stub (default: claude)
  --no-streaming               Skip the streaming route
  -h, --help                   Show help
`);
}

// ---------- doctor: audit an existing repo for autogen-ui compatibility
async function runDoctor() {
  const { readFileSync, existsSync, readdirSync, statSync } = await import("node:fs");
  const { resolve, join } = await import("node:path");
  const root = process.cwd();

  process.stdout.write(`\nauditing ${root}…\n\n`);

  const issues = [];
  const ok = [];
  const advice = [];

  // 1. package.json
  const pkgPath = resolve(root, "package.json");
  if (!existsSync(pkgPath)) {
    issues.push("No package.json — run this in the root of a Node project.");
    process.stderr.write(issues.join("\n") + "\n");
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (deps["@autogen-ui/core"]) ok.push(`@autogen-ui/core installed (${deps["@autogen-ui/core"]})`);
  else
    advice.push(
      "Install the framework:  pnpm add @autogen-ui/core framer-motion",
    );
  if (deps["framer-motion"]) ok.push("framer-motion peer satisfied");
  else if (!deps["@autogen-ui/core"]) {
    // already advised
  } else advice.push("Install peer:  pnpm add framer-motion");
  if (deps.next) ok.push(`Next.js ${deps.next}`);
  else if (deps.vite) ok.push(`Vite ${deps.vite}`);
  else if (deps.react) ok.push("React app detected (non-Next)");
  else advice.push("This audit assumes a React app.");

  // 2. tailwind config
  const tailwindCandidates = [
    "tailwind.config.ts",
    "tailwind.config.js",
    "tailwind.config.mjs",
    "tailwind.config.cjs",
  ];
  const twPath = tailwindCandidates.map((c) => resolve(root, c)).find(existsSync);
  if (!twPath) {
    advice.push(
      "No tailwind config found. Tailwind is the default style transport; alternatively use `createInlineStyleCompiler()` from @autogen-ui/core.",
    );
  } else {
    const tw = readFileSync(twPath, "utf-8");
    ok.push(`tailwind config: ${twPath.slice(root.length + 1)}`);
    if (tw.includes("@autogen-ui/core/tailwind.preset")) {
      ok.push("tailwind preset wired");
    } else {
      advice.push(
        "Add the preset to tailwind.config:\n  import preset from \"@autogen-ui/core/tailwind.preset\";\n  export default { presets: [preset], … };",
      );
    }
    if (tw.includes("STATIC_SAFELIST") || tw.includes("safelist")) {
      ok.push("tailwind safelist configured");
    } else {
      advice.push(
        "Add the safelist so token-driven utility classes don't get purged:\n  import { STATIC_SAFELIST } from \"@autogen-ui/core/style\";\n  safelist: STATIC_SAFELIST.split(/\\s+/).filter(Boolean),",
      );
    }
    if (
      tw.includes("@autogen-ui/core/dist") ||
      tw.includes("@autogen-ui/core/src") ||
      tw.includes("packages/core/dist") ||
      tw.includes("packages/core/src")
    ) {
      ok.push("tailwind content scans framework source");
    } else {
      advice.push(
        "Include the framework in your `content` array so Tailwind sees its classes:\n  \"./node_modules/@autogen-ui/core/dist/**/*.js\",",
      );
    }
  }

  // 3. CSS variables — scan first 2 levels of src/, app/, styles/ for .css files
  const REQUIRED_VARS = [
    "--background",
    "--foreground",
    "--primary",
    "--primary-foreground",
    "--card",
    "--card-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--border",
    "--input",
    "--ring",
  ];
  const NICE_VARS = ["--success", "--warning", "--danger", "--primary-soft", "--chart-1"];

  /** Treat `@import "@autogen-ui/core/styles.css"` as providing all defaults. */
  function importsFrameworkStyles(blob) {
    return /@import\s+["']@autogen-ui\/core\/styles\.css["']/.test(blob);
  }
  const cssDirs = ["app", "src", "styles", "src/styles", "src/app"]
    .map((d) => resolve(root, d))
    .filter((d) => existsSync(d) && statSync(d).isDirectory());
  const cssFiles = [];
  function walk(dir, depth = 0) {
    if (depth > 3) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") walk(full, depth + 1);
        else if (entry.endsWith(".css")) cssFiles.push(full);
      } catch {
        /* ignore */
      }
    }
  }
  cssDirs.forEach((d) => walk(d));
  const cssBlob = cssFiles.map((f) => readFileSync(f, "utf-8")).join("\n");

  const usesFrameworkStyles = importsFrameworkStyles(cssBlob);
  const missingRequired = REQUIRED_VARS.filter((v) => !cssBlob.includes(v));
  const missingNice = NICE_VARS.filter((v) => !cssBlob.includes(v));
  if (cssFiles.length > 0) {
    ok.push(`scanned ${cssFiles.length} css file(s) for design tokens`);
    if (usesFrameworkStyles) {
      ok.push(
        "@import \"@autogen-ui/core/styles.css\" found — framework tokens supplied. Override individual vars in :root to match your brand.",
      );
    } else if (missingRequired.length === 0) {
      ok.push("all required CSS variables present (shadcn-compatible)");
    } else {
      advice.push(
        `Missing required CSS variables in globals: ${missingRequired.join(", ")}\nEither @import \"@autogen-ui/core/styles.css\" for sensible defaults, OR add them to :root { … } in your globals.css.`,
      );
    }
    if (!usesFrameworkStyles && missingNice.length > 0) {
      advice.push(
        `Optional but recommended (semantic + chart palette):\n  :root {\n${missingNice.map((v) => `    ${v}: 0 0% 50%;`).join("\n")}\n  }`,
      );
    }
  } else {
    advice.push(
      "No .css files found in app/ src/ styles/. The framework expects HSL-triplet CSS variables; see https://github.com/mosnin/autogen-ui#brand for the full list.",
    );
  }

  // 4. Detect shadcn/ui
  if (existsSync(resolve(root, "components.json"))) {
    ok.push("shadcn/ui detected (components.json) — your Card/Button can be registered directly");
    advice.push(
      "Bridge shadcn components into the registry:\n  import { Card } from \"@/components/ui/card\";\n  const registry = createRegistry({ Card: createComponentAdapter({ Component: Card }) });",
    );
  }

  // 5. Detect Next.js app/api route directory
  if (existsSync(resolve(root, "app/api"))) {
    ok.push("Next.js app router detected — mount the agent route at app/api/autogen-ui/stream/route.ts");
  }

  // ---- report
  for (const o of ok) process.stdout.write(`  [32m✓[0m  ${o}\n`);
  if (advice.length > 0) {
    process.stdout.write(`\nrecommendations:\n`);
    for (const a of advice) {
      process.stdout.write(`\n  [33m→[0m  ${a}\n`);
    }
  } else {
    process.stdout.write(`\n  all looks good. ship it.\n`);
  }
  process.stdout.write(`\n`);
}

// ---------- arg parsing
const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  usage();
  process.exit(0);
}

if (args[0] === "doctor") {
  await runDoctor();
  process.exit(0);
}

let name = "autogen-ui-app";
let provider = "claude";
let streaming = true;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--provider") {
    const v = args[++i];
    if (v === "claude" || v === "openai") provider = v;
    else {
      process.stderr.write(`Unknown provider: ${v}\n`);
      process.exit(1);
    }
  } else if (a === "--no-streaming") {
    streaming = false;
  } else if (!a.startsWith("-")) {
    name = a;
  }
}

const target = resolve(process.cwd(), name);
if (existsSync(target)) {
  process.stderr.write(`Refusing to overwrite existing directory: ${target}\n`);
  process.exit(1);
}

// ---------- writeFile shortcut
function emit(rel, content) {
  const file = resolve(target, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  process.stdout.write(`  created  ${rel}\n`);
}

mkdirSync(target, { recursive: true });
process.stdout.write(`\nScaffolding ${name}…\n\n`);

// ---------- package.json
const clientPkg = provider === "claude" ? "createAnthropicClient" : "createOpenAIClient";
const envVar = provider === "claude" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";

emit(
  "package.json",
  JSON.stringify(
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        "@autogen-ui/core": "^0.2.0",
        "framer-motion": "^11.11.17",
        next: "^14.2.15",
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      },
      devDependencies: {
        "@types/node": "^22.9.0",
        "@types/react": "^18.3.12",
        "@types/react-dom": "^18.3.1",
        autoprefixer: "^10.4.20",
        postcss: "^8.4.49",
        tailwindcss: "^3.4.14",
        typescript: "^5.6.3",
      },
    },
    null,
    2,
  ) + "\n",
);

// ---------- next config
emit(
  "next.config.mjs",
  `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@autogen-ui/core"],
};

export default nextConfig;
`,
);

// ---------- tsconfig
emit(
  "tsconfig.json",
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2021",
        lib: ["ES2021", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "preserve",
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        isolatedModules: true,
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2,
  ) + "\n",
);

emit(
  "next-env.d.ts",
  `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`,
);

// ---------- tailwind + postcss
emit(
  "tailwind.config.ts",
  `import type { Config } from "tailwindcss";
import preset from "@autogen-ui/core/tailwind.preset";
import { STATIC_SAFELIST } from "@autogen-ui/core/style";

const config: Config = {
  darkMode: "class",
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./node_modules/@autogen-ui/core/dist/**/*.js",
  ],
  safelist: STATIC_SAFELIST.split(/\\s+/).filter(Boolean),
  theme: { extend: {} },
  plugins: [],
};

export default config;
`,
);

emit(
  "postcss.config.mjs",
  `export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
`,
);

// ---------- app shell
emit(
  "app/globals.css",
  `@tailwind base;
@tailwind components;
@tailwind utilities;

@import "@autogen-ui/core/styles.css";

html, body { height: 100%; }
body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
`,
);

emit(
  "app/layout.tsx",
  `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${name}",
  description: "An autogen-ui app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
`,
);

const hookImport = streaming ? "useStreamingDashboard" : "useDashboard";
const endpoint = streaming ? "/api/autogen-ui/stream" : "/api/autogen-ui";
emit(
  "app/page.tsx",
  `"use client";

import {
  BrandProvider,
  DashboardRenderer,
  useRuntime,
  ${hookImport},
  violetKit,
} from "@autogen-ui/core";
import { useState } from "react";

const SUGGESTIONS = [
  "Build a SaaS revenue dashboard with MRR, churn, and active users",
  "Add a search Input bound to state.q and a Text that echoes it",
  "Define a reusable MetricCard component and use it for 4 KPIs",
];

export default function Page() {
  const { dashboard, sendMessage, isLoading, reset } = ${hookImport}({
    endpoint: "${endpoint}",
  });
  const { data, state, dispatch } = useRuntime(dashboard);
  const [input, setInput] = useState("");
  const isEmpty = (dashboard.root.children?.length ?? 0) === 0;

  return (
    <BrandProvider kit={violetKit} className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-primary" />
          <span className="font-semibold">${name}</span>
        </div>
        <button
          onClick={reset}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs"
        >
          Reset
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[360px] flex-col border-r border-border p-5 gap-3">
          {isEmpty &&
            SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="rounded-lg border border-border bg-card p-3 text-left text-sm hover:border-primary/40"
              >
                {s}
              </button>
            ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) {
                sendMessage(input);
                setInput("");
              }
            }}
            className="mt-auto flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe or edit…"
              className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              disabled={isLoading || !input.trim()}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </aside>
        <section className="flex-1 overflow-y-auto p-8">
          <DashboardRenderer
            dashboard={dashboard}
            context={{ data, state, dispatch }}
          />
        </section>
      </div>
    </BrandProvider>
  );
}
`,
);

// ---------- API route
const agentImport = streaming
  ? "createStreamingUIAgent, createStreamingRouteHandler, streamingCapabilities"
  : "createUIAgent, createRouteHandler, defaultCapabilities";
const handlerCall = streaming
  ? "createStreamingUIAgent({\n    client: " + clientPkg + "({ apiKey: process.env." + envVar + "! }),\n    capabilities: streamingCapabilities,\n  })"
  : "createUIAgent({\n    client: " + clientPkg + "({ apiKey: process.env." + envVar + "! }),\n    capabilities: defaultCapabilities,\n  })";
const routeFactory = streaming ? "createStreamingRouteHandler" : "createRouteHandler";

emit(
  streaming ? "app/api/autogen-ui/stream/route.ts" : "app/api/autogen-ui/route.ts",
  `import {
  ${agentImport},
} from "@autogen-ui/core/server";
import { ${clientPkg} } from "@autogen-ui/core/clients";

export const runtime = "nodejs";

const agent = ${handlerCall};

export const POST = ${routeFactory}({ agent });
`,
);

// ---------- env
emit(
  ".env.local.example",
  `# Copy to .env.local and fill in
${envVar}=
`,
);

// ---------- gitignore
emit(
  ".gitignore",
  `node_modules
.next
out
.env
.env.local
.DS_Store
*.tsbuildinfo
`,
);

// ---------- README
emit(
  "README.md",
  `# ${name}

Generated with \`create-autogen-ui v${PKG_VERSION}\`.

## Run

\`\`\`bash
cp .env.local.example .env.local
# add your ${envVar}

pnpm install            # or npm install / yarn / bun install
pnpm dev                # open http://localhost:3000
\`\`\`

## Where to go next

- **\`app/page.tsx\`** — the chat sidebar + dashboard canvas.
- **\`${streaming ? "app/api/autogen-ui/stream/route.ts" : "app/api/autogen-ui/route.ts"}\`** — the agent route. Swap in
  \`createAnthropicClient\` ↔ \`createOpenAIClient\` here.
- **\`tailwind.config.ts\`** — preset + safelist for the framework.
- **BrandKit** — change the look by passing a different kit to
  \`<BrandProvider>\`. Try \`linearKit\`, \`warmKit\`, or your own.
- **Custom components** — \`createRegistry({ Card: YourCard })\` swaps
  in your component library.

See https://github.com/mosnin/autogen-ui for the full docs.
`,
);

process.stdout.write(`\n${name} is ready.\n`);
process.stdout.write(`\n  cd ${name}`);
process.stdout.write(`\n  cp .env.local.example .env.local   # add ${envVar}`);
process.stdout.write(`\n  pnpm install`);
process.stdout.write(`\n  pnpm dev`);
process.stdout.write(`\n\n`);
