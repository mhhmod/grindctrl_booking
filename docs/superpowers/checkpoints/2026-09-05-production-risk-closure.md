# Production risk closure — active checkpoint

Date: 2026-09-05. Entry release: `92f4d0fca7525b11c5db56248c0fc262fd5ab93b`.
Existing goal/task: `01a0581e-3b83-71f2-8cbd-e981e2a28fac`; runtime status `usageLimited` at entry. This task is continuing manually. No goal was duplicated, resumed programmatically, or marked complete.
Scope/acceptance: [production risk closure design](../../../specs/production_risk_closure_design.md).

## Release verdict

**NO-GO: local hardening and integrated verification completed; mandatory production gates remain open. This is not a deployed or production-certified release.** Preserve unrelated dirty files. No paid generation, real billing change, customer message, production load test or destructive database operation was performed in these checks.

**User-confirmed launch model:** managed service first, operator-only credit grants. Self-service Shopify checkout is explicitly deferred. Operator identities, payment verification procedure and the permitted billing/distribution arrangement still require configuration/approval; no operator was enabled.

## Implemented locally; integrated checks passed

- Labelled, 44px mobile Sign in control, shrinkable auth grid, assistant removed from auth routes including client navigation, footer clearance and localized feedback work.
- Strict expensive-route and merchant limits: verified shop identity shared by dashboard and Shopify, separate read/write budgets, safe 429/503 and Retry-After; Redis outage does not authorize provider work.
- Assistant budgets moved from per-process memory to atomic Redis accounting. Conservative chat input/completion reservation; no invented refunds for missing usage. Existing allowance values are preserved, not newly validated paid tiers.
- Image requests: bounded time, actual response bytes, raster signatures, allowlisted garment origin, no redirects/automatic retries, sanitized shopper failures.
- Unknown provider cost remains null across persistence/replay. Refunds do not erase incurred provider cost; dashboard must distinguish known spend from incomplete totals.
- Groq: no automatic retries, explicit signal spanning response bodies, whole-operation deadline, bounded TTS output and sequence, terminal streaming usage/outcome logging without content bodies.
- Dependency upgrades and precise remaining advisory paths: [dependency evidence](../../audits/2026-09-05-dependencies.md).
- Independent review found ordinary shop owners could call manual entitlement grants. A separate fail-closed platform-operator guard and direct-invocation tests are implemented. No operator has been configured or granted access by this work.
- All14 remaining public route handlers use strict limits, preserving CORS/cache and poll budgets. Nine legacy dashboard mutation exports now independently verify Clerk identity/site ownership; domain/intent edits and deletes additionally prove child membership. Independent read-only review approved these boundaries.
- Typed EN/AR action errors preserve edits; identical unconfirmed in-session plan retries reuse their idempotency key. Escape/Close restore launcher focus; shared cookie notifications synchronize the assistant language. Hook lifecycle fixes avoid render-time ref mutation and handle repeated limits/audio replacement without lint suppression.
- Node20 EOL image replaced by verified, digest-pinned official Node24.20.0 Alpine image; non-root runtime, health check, secret/artifact Docker exclusions and app-scoped standalone tracing. New reusable CI checks build/start/scan a credential-free candidate; deployment separately scans the exact configured published digest. Transport failures and4xx no longer pass the live smoke check. This CI/container work is staged and YAML-validated, not executed on Docker here.

## Evidence obtained

- Provider-focused regression run on patched dependencies: **80 tests / 10 files passed**. Covers bounded reads, invalid results, cost persistence/refunds, safe errors, full-body deadline and terminal streaming logs.
- Initial backend/assistant batch: **229 tests / 35 files passed**; subsequent additions are covered by the final integrated run below.
- Final integrated `npm test -- --maxWorkers=2`: **1,291 tests / 205 files passed** in 413.37s after all lifecycle and health-middleware changes. Earlier 1,281/204 run and focused runs overlap; do not add them as unique totals.
- Final full `npm run lint`: passed with zero errors/warnings after fixing six pre-existing React-hook findings. `npm run build` passed on Next 15.5.25, including type validity, 66 static-page generation steps and standalone tracing; compilation took 12.5 minutes. Latest standalone artifact exists at `.next/standalone/server.js`. This is a local build on Node 24.14.1, not verification of the Node 24.20.0 Linux container.
- Root static `npm run build` passed on Vite6.4.3/Node24.14.1 (1m48s); existing large Clerk chunk warning remains. Next app audit has zero advisories; root has13 moderate affected nodes from two documented advisory paths, no critical/high.
- Real Redis probe: two allowed draws, one denied draw, zero-cost read and TTL assertion; six commands on one random synthetic key, cleanup completed. No real tenant keys touched.
- At `2026-09-05T16:35:03Z`, read-only `scripts/production-readiness-preflight.mjs` verified: live health HTTP200 with entry SHA; OpenRouter key authenticated, explicit key budget present and positive remaining; configured `google/gemini-3.1-flash-image` listed with image input/output; all four configured Groq model IDs listed; configured Supabase `prsusuwxbzaekynonifl` accepted a zero-row HEAD on `tryon_jobs(id,cost_usd)`.
- Local Shopify API key/secret were absent. Never print credentials. Catalogue presence does not establish quality, account throughput, provider retention, or customer acceptance. Local Supabase access does not establish deployed project identity, nullable schema, RLS or backup correctness.
- Real browser: EN/AR header measured at 320/343/390/768/1024/1440px: no horizontal overflow and 44px Sign in height (144px wide at 343). RTL auth shell passed the same widths and has no assistant. Local production Clerk configuration rejects localhost, so the actual credential form cannot be called verified. English Escape restored focus to the launcher; toggling locale immediately updated its Arabic label. Visually inspected development screenshots: `output/playwright/release-header-en-343-dark.png`, `release-header-ar-343-light.png`; auth shell captures: `release-auth-shell-{en,ar}-343.png`. No paid chat/image/audio was invoked.
- **Final compiled-browser verification, 17:38–17:47 UTC:** ran the standalone production build locally with release label `local-uncommitted-risk-closure`. Repeated the six-width EN/AR header checks successfully; Sign in remained 44px tall. Both locale wrappers switched together; Escape closed the assistant and restored launcher focus after its exit animation. Client navigation to `/sign-in` removed the assistant; its English auth shell had no overflow at all six widths. Visually inspected `output/playwright/release-compiled-header-en-343-light.png` and `release-compiled-header-ar-343-light.png`. Console recorded only the three known Clerk localhost-origin errors, zero warnings and no hydration mismatch during these checks. The earlier Radix ID warning was observed on development reloads, not reproduced in this compiled run; this is not a claim that every route is warning-free. The real Clerk credential form remains unverified.

## Unclosed production gates

1. **Shopify privacy:** local app config lacks all three mandatory compliance topics. Receiver currently acknowledges unknown topics without durable privacy processing. Uninstall is not shop redaction. Implement durable service-role inbox, dedupe, retries, scoped fulfillment and alerts; approve actual tenant/customer mapping and retention/backup policy before destructive worker execution. Verify real registration and deliveries afterward. [Shopify requirements](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance).
2. **Managed-service billing authority:** user selected operator-only managed service, so self-service checkout is deferred. Configure exact authorized Clerk operator IDs, approved package/service terms and documented payment verification before manual activation/renewal/top-up. Shopify requires its billing solution for App Store app charges; custom distribution has different limitations and is not a workaround for broad App Store distribution. Verify the actual distribution arrangement before collecting app-related fees; manual grants are neither payment proof nor a billing exception. [Billing rules](https://shopify.dev/docs/apps/launch/billing), [distribution](https://shopify.dev/docs/apps/launch/distribution). If self-service is later added, Shopify App Pricing uses Partner API verification/reconciliation; do not substitute a legacy subscription webhook. [Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing).
3. **API version:** app, extension and Admin client pin `2026-10`, still a release candidate on this checkpoint date. Review used fields against stable `2026-07` and align deliberately; no blind version switch. [Versioning](https://shopify.dev/docs/api/usage/versioning).
4. **Authenticated browser evidence:** approved test account and development store, cross-surface same-account settings, unauthorized other-account rejection, storefront context, install/reinstall and billing callbacks/reconciliation. Access was requested without requesting passwords in chat.
5. **Live data/operations:** actual deployed DB/Redis/provider identities and schema; RLS/ownership; restorable backup; cleanup partial failures; alert delivery and operational ownership; production environment containing new operator configuration if this feature is enabled.
6. **Capacity/provider economics:** provider timeout is not cancellation/billing proof. Real quality/latency/failure/cost benchmarks and peak capacity require a bounded authorized test budget. Audio byte/MIME bounds do not verify true recording duration. Existing voice seconds estimates must not be sold as measured consumption.
7. **Dependencies/build:** local full-suite, lint and build/type validation passed. Clean CI install, Linux container build/security scan/startup and deployed running-SHA verification remain. Residual legacy wallet advisory reachability is documented separately. Audit cleanliness is not proof of absence of all vulnerabilities.
8. **Commercial claims:** proposals remain evidence-gated. Do not publish projected prices, quotas, savings, response times or performance numbers as proven customer outcomes without traceable internal evidence and owner-approved service boundaries.
9. **Entitlement read side effect:** `getShopPlanState` retains its existing global reconciliation after ownership and a120/min read budget. Removing it blindly could break expiry enforcement. A shop-scoped RPC and verified scheduled reconciliation need database review. `listPlansCatalog` remains an explicitly authenticated, unthrottled catalog read; signed webhooks/OAuth/OPTIONS/health are intentionally outside merchant abuse throttles.
10. **Deployment authority:** no Docker executable was available locally. New CI scans, Node24.20.0 container startup, non-root filesystem behavior and deployed reverse-proxy trust must pass on the actual candidate. VPS image pinning/rollback is unverified; obtain exact digest/rollback approval before rollout. The existing goal remains `usageLimited` (rechecked), not complete or programmatically resumed.

## Continuation — 2026-09-07T04:23:45Z

This Codex run stopped mid-edit on usage exhaustion, leaving three real
breaks behind it — not design problems, incomplete propagation of two
genuine changes it had already made correctly elsewhere:

- `signShopperToken`/`verifyShopperToken` gained a required `shop` claim
  (real, correct hardening — a token now only verifies against the shop it
  was minted for). `app/api/messenger/send/route.ts:218` still called the
  3-argument form and did not compile. `lib/messenger/identity.test.ts`
  still tested the old API shape (old proxy-signature escaping, trusted
  `customer_id`/`customer_email` fields the new code correctly stopped
  trusting) end to end. Fixed the call site and rewrote the test file
  against the current API, including a new test for the shop-mismatch
  rejection this change actually adds.
- `lookupOrder` gained a real new gate: a verified-customer lookup
  (`customer(id: ...)`) requires `read_customers` in addition to
  `read_orders`, correctly implemented. The test file's default mocked
  token only had `read_orders`, so three tests failed against the new,
  correct behavior. Added `read_customers` to the default mock and added a
  dedicated test asserting the new gate rejects a token that lacks it.
- `app/dashboard/try-on/page.test.tsx`'s own new fixture passed `null` for
  `installedAt`/`lastSeenAt`, which `ManagedTryOnShop` has always typed as
  non-nullable `string`. Fixed the fixture; it did not affect what those
  tests assert.

Re-ran every local gate this checkpoint's Execution and release gates
section calls for, in order, on the corrected tree:

- `npx tsc --noEmit`: clean.
- `npx vitest run --maxWorkers=2`: **1,344 tests / 209 files passed** (up
  from the prior 1,291/205 — the identity and orders rewrites above added
  coverage rather than just restoring it).
- `npm run lint`: clean, zero errors/warnings.
- `npm run build`: clean production build on the same dependency graph
  this checkpoint's dependency audit already verified.

No design decision in this checkpoint was revisited or reversed — the
`shop`-bound token and the `read_customers` gate are both correct security
improvements this run made; they were simply left mid-propagation. Nothing
in the "Unclosed production gates" list below changes as a result of this
continuation; none of those ten items are local-verification gates, and
none were touched by these fixes.

A separate, independent pricing audit (adversarial, multi-agent, evidence-led
— `docs/superpowers/specs/2026-09-07-unified-pricing-audit.md`) ran in
parallel and does not touch any file this checkpoint modified. It is
relevant to exactly one item in the Unclosed production gates list —
**gate 2, managed-service billing authority** — and confirms two of that
gate's citations independently: Shopify App Pricing has no one-time-charge
primitive, and a folded-into-a-recurring-plan setup fee is the
category-normal, compliant shape (not a workaround). It also surfaced one
fact not in this checkpoint: Shopify's App Events API returns HTTP 202 even
when an event fails billing validation, with no failure webhook — any
future usage-metered overage on this billing surface needs a reconciliation
job against that gap before it ships, independent of which catalogue price
is ultimately approved. No final catalogue is selected by either document;
gate 8's "commercial claims remain evidence-gated" stance is unchanged.

## Handoff rule

Update this file with actual final command results and remaining gates. Keep staged, tested and deployed states separate. Do not mark the existing goal complete or call the product production-ready until the mandatory gates have evidence.
