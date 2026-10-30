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


## Continuation — 2026-10-24, Shopify milestone 1

Owner authorized feature-branch implementation and Draft PR only, with an independent review gate before milestone 2. Baseline/fetched main: `4f5467fa80f73dde26f98f435ef1606488a68864`. Draft PR: https://github.com/mhhmod/grindctrl_booking/pull/75. No deployment, production SQL, real merchant setup, paid AI or payments occurred.

Installation-scoped credentials/refresh leases, lifecycle receipts/fencing, app-aware embedded routing, independent core capability signing, and manual-only privacy escalation are implemented locally. Legacy token provenance is never guessed; credentials require reauthorization. Existing AI/dashboard/credit/entitlement engines remain. Runtime dependency audit patches yield zero production Next dependency vulnerabilities.

Final local evidence: **3191 tests / 332 files passed** via `npm test -- --maxWorkers=2 --testTimeout=30000`; typecheck, full lint plus late-file lint and production standalone build passed. Dedicated local Chromium checks **4/4 passed**, with App Bridge stubbed and external browser requests blocked. SQL tested only in isolated PGlite PostgreSQL; no live Supabase migration was applied.

**NO-GO for merchant rollout.** Shared-data privacy ownership/retention/fulfillment approval, live database/project/schema/RLS/backups, real Development Store installation/refresh/permissions/theme/product E2E and CI/container/deployment evidence remain open. Do not construe a local build or stubbed browser as closure of the existing production gates. Milestone 2+ has not begun.

See [the full milestone report](../../audits/2026-10-24-shopify-m1.md), [migration and recovery runbook](../../audits/2026-10-24-shopify-m1-runbook.md) and [readiness matrix](../../audits/2026-10-24-readiness-matrix.md) for exact files, tests, limitations and rollback.

### Milestone 1 continuation — follow-up requirements

Reverified clean feature HEAD `aac5a9e1aeb30d6ba06218765a30eb5f4dc27057` and remote main still at the audited baseline; reused Draft PR #75. Runtime/test source now `05f38c75ecc9acbc5dcba1639c0392eef2fbace6`. The optional unsigned legacy signer refuses multiple registrations while preserving single-app compatibility. New storefront sessions, attempts, generations and proxy availability verify the signing installation remains active; an active B cannot authorize disconnected A. Existing reserved-job completion/recovery stays merchant-scoped. Added eleven regression cases, including paused-provider transition outcomes.

Follow-up evidence: 146/146 affected-path tests across 11 files; 6/6 Try-On UI tests without competing local work; local typecheck, full lint plus final-fixture lint and standalone build passed; local Chromium 4/4 with stubbed App Bridge. CI run https://github.com/mhhmod/grindctrl_booking/actions/runs/40130723607 passed the complete unit gate, typecheck and lint on the tested source; remaining candidate/build/browser CI status is tracked in the PR. Earlier CI fixture failures and local UI timing failures/interrupted runs are documented in the report and are not labelled full local passes. No assertions or committed test timeouts were relaxed.

The runbook now includes a 14-step unexecuted Development Store acceptance plan, old-image drain and verification-key handling for in-flight jobs, and actual scheduler verification (checked-in entitlement reconciliation is daily). The report maps all 18 required scenarios to bounded evidence and provides separate NO-GO recommendations for merge pending independent audit, staging execution pending authorization/target review, production migration and merchant onboarding. Privacy ownership/retention/fulfillment remains P0; hosted database/settings, real Dev Store E2E and financial reconciliation remain unverified. No deployment, hosted SQL, live configuration/credentials, real merchant activation, paid AI or payments occurred. M2 has not begun.

### Milestone 1 CI closeout — verified HEAD 85c9ae89b4c54e66255dbac47e87da4e86329492

CI https://github.com/mhhmod/grindctrl_booking/actions/runs/40131237866 completed successfully: 3202 tests / 332 files, typecheck, lint, production dependency audit, credential-free container build, configured HIGH/CRITICAL OS/runtime scan, startup/release checks and 207 golden/mobile browser checks. Run 40130723607 on the runtime/test commit also completed successfully. No runtime code or migration changed after the tested source; this closeout is documentation only.

Separate full-graph dependency audit found 13 findings (5 moderate, 6 high, 2 critical), including Vitest/Tinypool toolchain chains; production-only audit remains zero. Toolchain remediation/exploitability review is open and is not represented as fixed by the Shopify changes. See the report closeout for advisory links and exact evidence. All privacy, hosted environment, real Development Store and financial-reconciliation gates remain open; no independent audit approval or production readiness is claimed.

### Independent-review remediation — 2026-10-24, code HEAD 9014629

The owner did **not** approve M1 at `209340229572c36a631a352f4244adbd29c80ee4`. Follow-up commits make actual runtime/SQL changes: bounded transient refresh recovery with durable cooldown and preserved rotating credentials; shared lease/version fencing including null-fence rejection; lifecycle receipts without unsigned-header mutation authority; current-credential verification before uninstall; new/legacy privacy casework with append-only reviewed fulfillment evidence; configurable validated proxy roots and publisher-bound shopper-token caching. Compatible development patches reduce the full audit from 13 to 8 findings, with **2 critical still open**. No major upgrade or risk acceptance is implied.

Frozen code/test/migration HEAD: `901462944251ef03d450459337f183765d670526`. Full CI [run 40138085737](https://github.com/mhhmod/grindctrl_booking/actions/runs/40138085737) completed successfully: **3,244 tests / 333 files**, typecheck, lint, production-only dependency audit (zero), credential-free release-image build, configured HIGH/CRITICAL image scan, isolated release/startup checks and **206 browser passes plus 1 flaky test passing retry #1**. CI tested synthetic PR merge `94966434fade05479faac93f277520cf61c41451`; its tree was verified identical to the branch HEAD. The flaky check was the English landing screenshot at 1440px; no assertion, timeout or baseline was relaxed. Final focused SQL/refresh/cache regressions also passed locally. Closeout after the frozen revision is documentation only.

Two additional manual deltas follow installation isolation: `supabase/20261024_shopify_review_remediation.sql`, then `supabase/20261024_shopify_privacy_casework.sql`; existing legacy privacy schema must first be verified. Neither was applied to hosted data. Keep additive audit/schema on rollback; never restore unsafe domain-only writers/timestamp-driven lifecycle mutation into a two-app deployment. Privacy deletion and retired credentials are not reversible by a code rollback.

Source is ready for independent re-review, **not approved**. Controlled Development Store operations are conditional on source review and separately authorized isolated setup/configuration/migrations. **Merge and real merchant rollout remain NO-GO** pending independent approval/toolchain disposition and actual privacy operating/legal approval, named operators, hosted preflight/RLS/backups, real Shopify A/B proxy/theme/auth/permissions tests and financial/job reconciliation. The privacy procedure is an actionable review candidate, not actual fulfillment. No hosted SQL, deployment, Shopify settings/credentials, real merchant activation, paid AI/payment or M2 occurred.

Exact files, bounded local/full-CI evidence, remaining blockers and rollback are in the [review-remediation report](../../audits/2026-10-24-shopify-review-remediation.md); linked privacy, proxy and dependency reports contain the detailed procedures and decisions.

### Independent re-review — controlled-test decision, verified 2026-10-25

Owner re-reviewed `1c5f31a`: **APPROVE WITH CHANGES; keep Draft PR 75**, not final M1 approval. Minimum follow-up: route/HMAC/real-PGlite regression for expired access plus failed refresh following revocation, duplicate/altered-header retries and fresh OAuth recovery; a separately authorized operator SQL **casework template, not a migration** for current verified app absence, protected by exact installation/version/status/lease and receipt scope; a targeted Vitest 4.1.12/mocker upgrade removing Tinypool while preserving patched Vite 7.3.7; and the isolated Development Store authorization/acceptance/settlement/rollback plan. Runtime feature/AI/credit/subscription code was not changed. Six fixture files were adapted to explicit mock clearing or constructible Audio mocks; assertions were retained.

Final frozen code/test/operations SHA `77ae80ec865dd0d36464563cb95dc636bee5aae0` passed [full CI 40140601855](https://github.com/mhhmod/grindctrl_booking/actions/runs/40140601855): **3,248 tests / 334 files and 207 browser tests**, typecheck, lint, production dependency audit (zero), credential-free image build, configured HIGH/CRITICAL OS/runtime scan and isolated candidate startup/release checks. CI tested synthetic merge `9d6507b88bd499a17e8d2f6b492c82850402060b`; its tree was verified identical to the branch source. No browser flake was reported in this run. Earlier migration attempts exposed fixture failures; they are not labelled passing. Full development audit now has **5 findings (3 high, 2 moderate), zero critical**; consumer upgrades and explicit reviewer acceptance of the narrow test boundary remain open.

The manual reconciliation template was executed only in isolated PGlite, with synthetic evidence. It is not to be applied as part of schema migration and requires separate operation approval, authenticated allowlisted tooling and genuine independently reviewed Shopify evidence. It cannot establish real Shopify absence from an operator string/hash. Privacy Fulfillment remains **P0 merchant-launch gate** until ownership/retention/named operators and execution rehearsals are approved. No hosted SQL, deployment, Shopify settings/credentials/installations, paid AI/payment, merge or M2 occurred.

Source is ready for independent delta review. Controlled testing is a **conditional GO recommendation**, pending approval of exact isolated host/project/store/apps/image, named operators, bounded synthetic credits, denied paid-provider egress and recovery plan. **Merge and merchant rollout remain NO-GO** without separate approval; the current product is not declared merchant-ready. [Decision report and exact evidence](../../audits/2026-10-24-shopify-controlled-test-decision.md).

### Controlled test preparation — 2026-10-25

Owner authorizes safe branch-only code/config/test preparation and accepts the five development findings only inside the isolated testing constraints; their production remediation remains required. Implemented `testing/shopify`: dedicated preview preload substitutes exact provider wire responses while `TRYON_MODE=live` preserves original credit/job orchestration; persistent 24-invocation/two-concurrent budget, source/revision/key/target guards, bounded pause and <=15m dependency drain; internal-only app network plus public-address/host-limited CONNECT gateway; Docker/Compose/TLS/env-name templates; local-only preparation and hashed **BLOCKED** migration plan; baseline contract/read-only catalog SQL. Production app feature/credit/job code and normal image entrypoint are unchanged.

Frozen code/config/test SHA `fb74a08972ba430eef1bcd3b2ff06e15dd07f22c` passed [full CI 40188515879](https://github.com/mhhmod/grindctrl_booking/actions/runs/40188515879): **3,250 tests / 335 files**, 15 Node harness tests, render-only Compose contract, typecheck/lint, credential-free app candidate build/scan/startup and **207 browser tests**. Synthetic merge `73fe4ea4afd19fd7b618acc7272a207effa2eab3` had an identical tree. The new service wiring tests simulate Supabase API responses; they do not establish hosted ledger correctness. Profile images/deployed egress/Shopify validation remain unexecuted. Closeout is documentation only.

Real blockers remain target bindings/access, missing complete base financial schema, reviewed synthetic seed and named humans. No simplified ledger was substituted and no existing production/playground resource is selected for testing. No external resource creation, hosted SQL/migration, deployment, app install/settings/credential change, paid AI/payment, manual reconciliation, merge or M2 occurred. Privacy Fulfillment remains P0 merchant-launch gate. [Preparation instructions](../../../testing/shopify/README.md) and [exact verification evidence](../../audits/2026-10-25-controlled-prep-evidence.md).

### Isolated provisioning Phase 1 — 2026-10-25, access result

Owner accepts tested preparation `fb74a08` and authorizes reuse of verified isolated resources and creation of empty **Free-tier only** Supabase/Upstash/Clerk resources. Paid plans/trials/payment methods, hosted migrations/seeding, preview deployment/start, Shopify mutations/installations, production changes, merge and M2 remain unauthorized. No additional blanket provisioning approval is needed within this scope.

Read-only checks at PR HEAD `fa443f094c37d600f427ae708f0f400deed22c39`: PR 75 open/Draft/unmerged; main unchanged. Managed environment observations are current, network policy enforced; no secret bindings, runtime variables, outbound identities or VPN/private TCP grants. Provider destinations are absent from the allowed network policy. No provider CLI/profile or provider-named environment variables were found in the task user's context. `.mcp.json` declares Supabase but is not evidence of authenticated access. Plugin discovery finds Supabase available but not installed/connected; a connection was suggested. No callable Upstash/Clerk/Shopify/hosting administration connection is present. GitHub environments/variables/secret-name inventory endpoints are unsupported by the available connector; no secret values were requested or retrieved. Source deployment workflow targets production only and its forced-command SSH key must not be repurposed for discovery or testing.

Local workspace Docker 28.4.0 is reachable and its image inventory is empty. This disposable task workspace has no verified stable public preview ingress, persistent hosting/recovery commitment or provider bindings, so it is not selected as the Shopify preview host. No remote nonproduction host or isolated service resource ID was verified; **zero resources created or reused**. Existing source project references remain excluded from testing. Secret storage/account ownership and empty-resource/Free-plan status cannot be attested without account access; do not create anonymous expiring databases whose credentials cannot be placed in approved storage.

Corrected baseline inventory in the existing preparation README: root-level tracked `supabase-migration-shops.sql` and `supabase-migration-plans.sql` do contain registry/ledger DDL and entitlement functions. The latter's last source change is `afc452c411f50da0d5505d14f96887f39d72c306`. Non-test `tryon_jobs`/`tryon_settings` creation DDL remains missing; hosted schema, RLS/ownership/grants, applied delta state, baseline checksum and synthetic seed are still unverified. No hosted query/export/SQL, schema invention or production-record copy occurred. Free Supabase recovery must include an independently stored logical test-data/schema backup plus separate storage-object backup; do not assume managed paid backups or database backups include storage objects.

Next access actions: connect Supabase for organization/plan/project inventory and authorized read-only schema access; bind Upstash account access and Clerk workspace administration (Clerk application creation needs Dashboard or available Platform API access, not an ordinary instance key); expose read-only hosting and Shopify Dev Dashboard metadata through approved access; configure approved secret storage/network destinations without pasting credentials into chat. Operator/recovery owner and a different independent reviewer remain **OWNER ASSIGNMENT REQUIRED**. Account Free quotas and a reusable host are unknown, so paid hosting is not established as necessary and no purchase is requested.

No runtime/config/test/migration code changed: accepted source `fb74a08` remains the tested implementation. This checkpoint and the README inventory correction are documentation only; prior CI is not presented as hosted verification. Limits stay two stores / 12 synthetic credits each / 24 stub calls / two concurrent / <=24h plus <=15m drain. After access and baseline review, obtain separate target-specific approval for migrations/seed, preview deployment/start, Shopify settings/install/uninstall/reconciliation and the 14-step controlled run. Privacy fulfillment and production dependency remediation gates remain intact.
