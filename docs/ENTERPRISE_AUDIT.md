# autogen-ui — Enterprise Audit (Baseline)

> Auditor's lens: **Larry Ellison building an enterprise product, not an MVP.**
> The bar is "would a Fortune 500 deploy this in production and would it survive
> a security + procurement review," not "does the demo look great." Scores are
> brutal and evidence-backed. Fair credit is given where the code earns it.
>
> Baseline date: 2026-07-02 · commit `48a941d` · branch `claude/laughing-hypatia-6t8qb3`

## Verdict

**Overall: 43 / 100 — a beautifully engineered prototype, not an enterprise product.**

The craft is real: a clean contract-driven architecture, genuinely disciplined
type safety (0 `any`, 0 `@ts-ignore`, 1 TODO across ~13k LOC), an immutable
patch model, a properly built Modal focus-trap, and mature restraint in the
codegen sandbox (the dangerous path is a deliberate no-op stub). That is the top
20% of side-project engineering.

But Ellison doesn't buy craft — he buys software that survives contact with a
hostile internet, a compliance team, and a pager rotation. On that bar this
product has **two shipped vulnerabilities, zero CI, zero real test framework,
no access control, no observability, and no release engineering.** Those aren't
polish items; they're the difference between a library people star on GitHub and
software an enterprise pays for.

## Scorecard

| # | Dimension | Score | One-line verdict |
|---|-----------|:---:|------------------|
| 1 | Architecture & Code Quality | **72** | Strong contract-driven design; a few god-files and a re-render story that won't scale. |
| 2 | Security | **44** | Two shipped highs (XSS + SSRF-by-default); good instincts, no hardening. |
| 3 | Testing & QA | **34** | 251 assertions in one 2,082-line script, no framework, **no CI gate**. |
| 4 | Enterprise Readiness | **29** | No RBAC, no audit log, no i18n, version drift — procurement rejects this. |
| 5 | DX / API / Docs | **67** | Clean API, real docs site + scaffolder; missing API reference & JSDoc. |
| 6 | Performance & Scalability | **51** | Fine for demos; 0 `React.memo`, O(n) tree rebuild per patch, unprofiled. |
| 7 | Reliability & Fault Tolerance | **40** | Error boundary + abort exist; **no client retry/backoff/429 handling**. |
| 8 | Release Engineering / CI-CD | **12** | No CI, no changesets, manual publish, root/core version drift. |
| 9 | Accessibility | **55** | Modal is textbook; the rest is inconsistent ARIA + 3 keyboard handlers. |
| 10 | Observability | **33** | `onTurn` telemetry only; no structured logs, metrics, tracing, or redaction. |

*Weighted overall (Security 20%, Testing 15%, Enterprise 15%, Architecture 15%,
Reliability 10%, Release 8%, Perf 7%, DX 5%, A11y 3%, Observability 2%) = **43**.*

---

## The two findings that would fail a pentest

### 🔴 HIGH — Stored/reflected XSS in `renderDashboardPlaceholder`
`packages/core/src/server-render.ts:72` interpolates `node.id` directly into an
HTML attribute string with **no escaping**, and the JSDoc (line 63) instructs
consumers to feed the output to `dangerouslySetInnerHTML`:

```ts
return `<div data-id="${node.id}" style="...">`; // node.id is model-controlled
```

The dashboard spec is LLM-generated from user input, and `id` is typed
`z.string().min(1)` with no character allowlist (`schema.ts`). A crafted id such
as `"><img src=x onerror=alert(document.cookie)>` escapes the attribute and
executes. **A public API ships an XSS with a copy-paste example that leads
straight into it.**

### 🔴 HIGH — SSRF-by-default in the data proxy
`packages/core/src/proxy.ts:41`: `isAllowed` returns `true` when no allowlist is
configured. The documented default is an **open proxy** — any URL, including
cloud metadata (`http://169.254.169.254/…`), `localhost`, and internal
services. Even *with* an allowlist: redirects are followed and only the initial
URL is checked, so an allowed host that 302s to a metadata endpoint bypasses it,
and there is no private-IP/RFC-1918 guard. Client-supplied headers are also
merged into the upstream request (`proxy.ts:71`) — header injection (Medium).

*Fair-credit corrections a lazy auditor would miss:* the `new Function` "eval"
is a **comment** describing a deliberately-disabled stub (`sandbox/codegen.ts`) —
not a live vuln. The "22 npm vulnerabilities" are **entirely example-app
devDependencies** (vite/babel chain); the shipped `@autogen-ui/core` depends only
on `clsx`, `tailwind-merge`, `zod` — clean.

---

## Top structural gaps (ranked by enterprise leverage)

1. **No CI/CD gate** — `.github/workflows` does not exist. Nothing runs on push
   or PR. Every one of the 76 commits shipped ungated. *(Release: 12)*
2. **No test framework** — all testing is one 2,082-line hand-rolled
   `scripts/run-eval.ts`; no vitest/jest, no coverage, no e2e, no render tests
   for `renderer.tsx`. *(Testing: 34)*
3. **Two shipped security highs** — XSS + SSRF above. *(Security: 44)*
4. **No access control** — a host cannot gate which components/actions/data
   sources a role may use; `strict`/`prefer` are prompt hints, not enforcement.
5. **No client resilience** — `grep` for retry/backoff/429 in `clients/` is
   empty; a provider hiccup fails the user turn. *(Reliability: 40)*
6. **No render memoization** — 0 `React.memo`, 5 `useMemo/useCallback` total in
   renderer+runtime; one patch re-renders the whole tree, and Framer `layout`
   will thrash on large dashboards. *(Perf: 51)*
7. **No observability** — `onTurn` is the only hook; no structured logs,
   metrics, tracing, correlation ids, or secret redaction. *(Observability: 33)*
8. **No i18n/a11y systemization** — Modal is done right, but Tabs/Accordion/
   Select/Switch/Breadcrumb lack consistent keyboard + ARIA, and there is no
   localization seam at all. *(A11y: 55, Enterprise: 29)*
9. **Version drift & no changesets** — root `0.1.0` vs core `0.3.0`; no SemVer
   automation, manual publish. *(Release: 12)*
10. **No ESLint/Prettier** — style/quality is enforced by discipline alone; one
    contributor away from entropy.

## Genuine strengths (credit where due)
- **Type discipline:** 0 `any`, 0 `@ts-ignore`, 1 TODO in ~13k LOC.
- **Contract-driven architecture:** Zod schema as the single source of truth;
  clean client/server export split (`server.ts` excludes `"use client"`).
- **Immutable patch engine** with target validation (`validatePatchTargets`).
- **Security instincts:** codegen sandbox disabled-by-default; proxy *supports*
  allowlist + server-wins header injection; Modal focus-trap is textbook.
- **Clean shipped dependency surface:** three well-known runtime deps.
