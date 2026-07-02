# autogen-ui — Enterprise Hardening Plan

Goal: take the baseline **43/100** to enterprise-grade by executing the phases
below in order. Each phase ends with: tests green, build clean, commit + push,
and a short self-audit note. Phase 8 delivers an independent re-score.

Baseline scorecard and evidence: see `ENTERPRISE_AUDIT.md`.

## Phase 0 — Stop the bleeding (security + CI gate)  ⬅ highest leverage
- Fix XSS in `renderDashboardPlaceholder` (escape all interpolated values).
- Fix SSRF-by-default in `proxy.ts`: default-deny, block private/link-local IPs,
  cap + re-validate redirects, constrain client headers.
- Add node-`id` character validation in `schema.ts` (defense in depth).
- Add GitHub Actions CI: typecheck + test + build, gating every PR.
- **Target:** Security 44→70, Release 12→45.

## Phase 1 — Testing foundation
- Add vitest + coverage; keep `run-eval` as the integration layer.
- React Testing Library render tests for `renderer.tsx` + key components.
- Property/contract tests for the patch and binding engines.
- Wire a coverage threshold into CI.
- **Target:** Testing 34→75.

## Phase 2 — Reliability & LLM clients
- Retry/backoff + `429`/`Retry-After` handling + timeouts in `clients/`.
- Structured error taxonomy; correct abort propagation; graceful stream failure.
- **Target:** Reliability 40→75.

## Phase 3 — Performance & scalability
- `React.memo` the node renderer; stable keys; avoid whole-tree re-render.
- Optimize batch patch application; measure/trim bundle; keep Framer optional.
- **Target:** Performance 51→75.

## Phase 4 — Enterprise administration
- RBAC/capability gating (component + action + data-source allowlists) enforced
  at agent build AND patch-apply time, not just prompt hints.
- Observability: structured logging, metrics hooks, correlation ids, redaction.
- Audit-log hooks for persistence + function calls; config validation; health check.
- **Target:** Enterprise 29→70, Observability 33→70.

## Phase 5 — Accessibility & i18n
- Systematic ARIA + keyboard for Tabs/Accordion/Select/Switch/Breadcrumb.
- Honor `prefers-reduced-motion`, focus-visible.
- i18n seam: injectable label/number/date formatting + RTL.
- **Target:** A11y 55→85.

## Phase 6 — Release engineering & versioning
- Changesets; reconcile version drift; automated publish w/ provenance.
- Deprecation policy + spec-migration tests; CHANGELOG discipline.
- **Target:** Release 45→85.

## Phase 7 — DX & documentation
- API reference (typedoc) + JSDoc completeness on public exports.
- Conceptual + security + migration guides; harden `create-autogen-ui`.
- Add ESLint + Prettier.
- **Target:** DX 67→85.

## Phase 8 — End-to-end audit + independent re-score
- Full E2E audit, fix bugs, verify the product actually builds/tests/runs.
- Independent, non-biased re-audit with new per-dimension + overall scores.
