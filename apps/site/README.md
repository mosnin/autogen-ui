# autogen-ui site

The marketing + docs site for `@autogen-ui/core`. Built with Next.js 14 and
the framework itself.

```bash
pnpm install                  # at repo root
pnpm --filter @autogen-ui/core build
pnpm --filter autogen-ui-site dev
# → http://localhost:3001
```

## Pages

- `/` — landing. Hero, scripted live agent demo, brand switcher, integration code, closing CTA.
- `/components` — live catalog. Every showcase rendered through the actual runtime, not screenshots.
- `/docs` — eight-step quickstart with copy-paste code blocks.

## How the live demo works

`components/ScriptedAgent.tsx` plays a pre-recorded sequence of patches
(from `lib/scripts.ts`) against a `DashboardRenderer`. Same animations,
same renderer, same `BrandKit` story — but no API key required. When the
section scrolls into view (`useInView`), the script starts and loops.

## Deploying to Vercel

1. Connect this repo to Vercel.
2. Set the project's **Root Directory** to `apps/site`.
3. Vercel auto-detects Next.js. No env vars required for the site itself —
   the demos run on pre-recorded scripts.

The build runs `next build` which transpiles `@autogen-ui/core` via the
`transpilePackages` setting in `next.config.mjs`.

If you want to wire a real agent route on the deployed site (e.g. for a
"Try it" playground), add `ANTHROPIC_API_KEY` as an env var and create
`app/api/autogen-ui/stream/route.ts` following the pattern in `/docs`.
