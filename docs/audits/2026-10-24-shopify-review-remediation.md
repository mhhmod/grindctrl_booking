# PR 75 — independent-review remediation

**Latest status, verified 2026-10-25:** independent re-review of `1c5f31a` was **APPROVE WITH CHANGES; keep Draft**, not final M1 approval. The [controlled-test decision report](2026-10-24-shopify-controlled-test-decision.md) records the subsequent expired-token uninstall regression, guarded manual reconciliation template, targeted Vitest upgrade (five development findings, zero critical), final source `77ae80e` and completed new CI (3,248 tests/334 files, 207 browser tests). It supersedes the older eight-finding/critical-toolchain status and 3,244-test source evidence below. Privacy Fulfillment remains P0 for merchant launch. Controlled testing is a conditional recommendation requiring separate explicit target/operation authorization; no external operation has been performed.

Milestone 1 remains **not approved**. Reviewed starting HEAD: `209340229572c36a631a352f4244adbd29c80ee4`; main remains the original audited baseline `4f5467fa80f73dde26f98f435ef1606488a68864`. Work stays on `feat/shopify-installation-isolation` and [Draft PR 75](https://github.com/mhhmod/grindctrl_booking/pull/75). AGENTS.md was reread and the clean starting worktree verified. No hosted credentials/database state/Shopify settings were available to inspect; none is assumed empty or correctly configured.

This follow-up changes runtime code and manual SQL. The previously passing 3,202 tests/207 browser checks are historical evidence for the reviewed starting code, not proof of these fixes. New full-CI evidence is recorded below against code HEAD `901462944251ef03d450459337f183765d670526`. No merge/deployment/hosted SQL/app setting change/real merchant installation/paid AI/M2 occurred.

## Code findings and remediation

### 1. Refresh resilience — runtime and SQL changes

Root cause: all fetch/status/parse failures collapsed to exchange_failed and permanently required reauthorization. A temporary outage could strand a valid rotating refresh token. An expired abandoned lease also forced retirement without token rejection evidence.

`lib/shopify/tokens.ts` now classifies transport/timeouts, 429 and 5xx as transient, terminal 401 separately, and other rejected requests as permanent/configuration failures. Refresh has at most three attempts under the same distributed lease, honoring short Retry-After waits; longer waits/exhaustion are persisted as installation-scoped cooldown. Transient failures, lost/truncated responses, persistence failure and generic storage errors preserve encrypted refresh material and do not become terminal retirement. Cooldown failure leaves the fence to expire safely rather than forcing reauthorization. Near-expiry access is not presented as fresh access during failure. Explicit invalid credentials/permanent rejection require reauthorization; no credentials/provider bodies are logged.

Successful rotation atomically saves both encrypted tokens and provider-defined expiry metadata. The follow-up SQL recovers an expired abandoned lease with a new fence without guessing token ownership; the former writer cannot commit. Acquisition and refresh still share that lease. Authorization-code acquisition is not blindly retried. An authorized fresh token acquisition can clear refresh cooldown without racing another lease owner.

[Shopify's refresh documentation](https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange#refresh-an-expiring-offline-token) explicitly permits retry after ambiguous/transient failures while the presented refresh token remains usable, until its replacement is used within provider expiry/grace. We do not assume a fixed retry window or use the documented grace cap as an application token lifetime. Terminal 401 is final. No real Shopify token refresh was performed.

### 2. Replay/ordering — runtime and SQL changes

Root cause: a valid body plus caller-controlled delivery timestamp/ID could be presented as a newer uninstall and remove a reauthorized credential. Body HMAC does not authenticate those delivery headers or installation generation.

The new `record_shopify_installation_event_v2` only records lifecycle receipts. No timestamp/body receipt can mutate credentials. New code calls v2, so missing follow-up schema fails before invoking the old mutating function; the follow-up also makes the old RPC delegate to the safe implementation for compatibility.

The webhook handler verifies current app-specific credentials against Shopify. Expiry first uses serialized refresh. Then a current, still-unexpired credential is probed through `currentAppInstallation` under the shared lease. Active response -> ignore the old uninstall. Definitive 401 -> atomically disconnect only the matching installation/version/lease; store aggregate stays installed while B remains active. The event retains verification installation/version/outcome/time. Receipt and scope events cannot reactivate stores or fence an in-flight authorization merely because headers changed.

Network/429/5xx/403, malformed/GraphQL responses, missing/expired credentials and lost fences cannot authorize deletion. Pending receipts survive retries; the HTTP response is 503 when verification is unavailable. Terminal refresh disables that exact credential but does not fabricate uninstall-generation evidence. Residual ambiguity: a 401 proves rejection of the current credential, not its unique underlying cause; absent usable credentials and actual delivery/installation ambiguity need authoritative manual reconciliation. Real delivery/captured-header tests on Shopify remain unexecuted. Legitimate current-credential revocation is handled automatically when its definitive response is available.

### 3. Privacy — casework SQL and actionable procedure

The former implementation recorded/notified requests but lacked an execution/retention/evidence workflow. New `shopify_privacy_case_actions`, restricted work queue and RPC cover both installation and legacy sources. The queue calculates original-receipt 30-day deadlines and flags legacy completed rows without fulfillment evidence. Evidence is append-only for service tooling. Completion requires previously reviewed scope hash, separate reviewer, approval and actual execution/verification references; legacy cases additionally need independent provenance. Data delivery/redaction require their respective evidence; legal holds cannot be cleared by assignment/escalation. Case completion and evidence append are transactional.

The RPC validates evidence structure and trusted operator declarations; it does not prove external deletion or authenticate a human from a string. There is no browser completion API and no automatic domain-wide/shared-data deletion. [The fulfillment procedure](2026-10-24-shopify-privacy-procedure.md) specifies accountable/backup roles, daily monitoring, escalation targets inside the 30-day deadline, exact manifest/ownership checks, new/legacy provenance, shared-data decisions, object-before-row deletion, export delivery, partial failures, in-flight/financial reconciliation, legally specific retention, vendor/backups and independent deletion evidence.

**Still P0 for rollout:** the owner must name operators, approve legal ownership/retention, verify actual schema/subprocessors/access enforcement and rehearse fulfillment on synthetic hosted data. No legal signoff, actual export/deletion, hosted audit or organizational approval is claimed. The procedure and casework are concrete candidates for independent review, not proof that real requests have been fulfilled.

### 4. App Proxy coexistence — loader changes and configuration requirements

All three storefront loaders hardcoded `/apps/grindctrl`, so two registrations could not be assumed to use independently configured roots. Product Try-On, catalog and Store Chat blocks now pass a configurable, validated same-origin connection root to their loaders. Existing defaults remain compatible. Config, product proof and shopper identity use the selected root; URLs/traversal/query paths are refused. Signatures, not browser path selection, establish backend app identity.

Final cutover inspection also found a domain-only shopper-token cache: B could reuse A's still-fresh cached identity without asking B's proxy. Cache entries now retain the selected proxy root, and a changed/unknown root forces signed identity reacquisition; a verified same-root cache stays compatible. This does not change merchant, conversation, credit or job identity.

[The exact configuration/acceptance document](2026-10-24-shopify-proxy-coexistence.md) requires distinct actual roots (A `/apps/grindctrl`, B `/apps/grindctrl-public` examples), per-app URLs/scopes/releases and matching fields in all three blocks. Existing Shopify merchant-customized paths must be inspected; TOML changes do not prove installed paths changed. One storefront publisher at a time is required; overlapping installations do not mean duplicate global chat/catalog loaders were redesigned. Real A/B proxy routing, theme releases and coexistence are **unverified until Development Store evidence**.

### 5. Dependency triage — compatible patches, explicit remaining risk

[All original 13 findings are triaged](2026-10-24-development-dependency-triage.md) with exact packages/versions, dependency paths, preconditions, advisory references and decisions. Compatible lockfile updates: body-parser 2.4.0, Hono 4.13.13, ip-address 10.7.4, Undici 7.30.1, Vite 7.3.7 and root Zod 4.6.7; incidental required iconv-lite/qs patches retained. Unrelated SWC platform metadata preserved. No package.json major range or test-framework major changed.

Full-graph audit fell from **13 to 8 findings** (3 moderate, 3 high, 2 critical); production-only remains zero. Vitest/Tinypool critical chains, mocker, nested Zod/shadcn/registry and typography/parser remain explicit toolchain review gates. Node/JSDOM run mode, trusted checkouts, isolated CI and absent production credentials bound exposure; they do not neutralize a compromised dependency. A supported patched Vitest/pool/mocker migration and coordinated upstream consumer upgrades need a separate justified change or explicit reviewer disposition before merge. No blanket risk acceptance is assumed.

## Exact changed files since reviewed HEAD

37 files since `2093402`, including the subsequent re-review delta. Changes cover scoped Shopify remediation/tests, storefront routing, targeted tooling dependencies, two additive schema deltas, one separately authorized operator casework template and reports.

- `apps/grindctrl-tryon/extensions/tryon-block/assets/tryon-catalog.js`
- `apps/grindctrl-tryon/extensions/tryon-block/assets/tryon.js`
- `apps/grindctrl-tryon/extensions/tryon-block/blocks/messenger.liquid`
- `apps/grindctrl-tryon/extensions/tryon-block/blocks/tryon-catalog.liquid`
- `apps/grindctrl-tryon/extensions/tryon-block/blocks/tryon.liquid`
- `apps/web-next/app/api/shopify/proxy/try-on-context/route.test.ts`
- `apps/web-next/app/api/shopify/webhooks/expired-uninstall.test.ts`
- `apps/web-next/app/api/shopify/webhooks/route.test.ts`
- `apps/web-next/app/api/shopify/webhooks/route.ts`
- `apps/web-next/app/api/try-on/jobs/[jobId]/route.test.ts`
- `apps/web-next/app/api/try-on/session/route.test.ts`
- `apps/web-next/components/assistant/use-voice-message-player.test.ts`
- `apps/web-next/components/assistant/voice-message-player.test.tsx`
- `apps/web-next/lib/messenger/widget-loader-identity.test.ts`
- `apps/web-next/lib/shopify/installation-database.test.ts`
- `apps/web-next/lib/shopify/installation-events.ts`
- `apps/web-next/lib/shopify/privacy-casework.test.ts`
- `apps/web-next/lib/shopify/tokens.test.ts`
- `apps/web-next/lib/shopify/tokens.ts`
- `apps/web-next/lib/try-on/service.test.ts`
- `apps/web-next/lib/try-on/theme-extension-catalog-launch.test.ts`
- `apps/web-next/lib/try-on/theme-extension-launch.test.ts`
- `apps/web-next/package-lock.json`
- `apps/web-next/package.json`
- `apps/web-next/public/widget/v1/messenger.js`
- `docs/audits/2026-10-24-development-dependency-triage.md`
- `docs/audits/2026-10-24-readiness-matrix.md`
- `docs/audits/2026-10-24-shopify-controlled-test-decision.md`
- `docs/audits/2026-10-24-shopify-m1-runbook.md`
- `docs/audits/2026-10-24-shopify-m1.md`
- `docs/audits/2026-10-24-shopify-privacy-procedure.md`
- `docs/audits/2026-10-24-shopify-proxy-coexistence.md`
- `docs/audits/2026-10-24-shopify-review-remediation.md`
- `docs/superpowers/checkpoints/2026-09-05-production-risk-closure.md`
- `supabase/20261024_shopify_privacy_casework.sql`
- `supabase/20261024_shopify_review_remediation.sql`
- `supabase/operations/shopify_uninstall_reconciliation.sql`

## Database and rollback

Manual additive order: existing `20260909_shopify_privacy_requests.sql` schema verified -> `20261024_shopify_installation_isolation.sql` -> **`20261024_shopify_review_remediation.sql`** -> **`20261024_shopify_privacy_casework.sql`**. Hosted preflight must inspect table/function/grant drift, exact projects, data counts, RLS/bypass behavior, backups, old privacy backlog and pending jobs. No hosted SQL was run.

The two new deltas add refresh cooldown/verification evidence and privacy audit/queue/RPC; replace lifecycle/lease functions; preserve merchants/subscriptions/jobs/ledger and legacy tokens. No ownership backfill is guessed. Source installation event RPC requires v2, so deploy follow-up SQL before new code and drain old images before two-app use. Never reapply older function definitions over these deltas.

Rollback should retain additive audit/schema and prefer a forward fix. Do not restore old timestamp-driven lifecycle mutations/domain-only token writers or delete the evidence tables. Code rollback cannot revive retired Shopify credentials or undo privacy erasure. Old and new app generations require explicit authorized reconnect/drain steps; no credit regrant or AI regeneration is a recovery mechanism.

## Evidence and readiness

Executed before the final late fence regression: **470 tests / 46 affected files passed** (76.39 seconds), including credential/lifecycle/privacy/loader, existing credit accounting and durable/in-flight job tests. Earlier failures in SQL fixtures exposed and corrected an unintended merchant-column update and parameter typing; assertions were retained. Additional final focused/static and full CI results must be recorded against their actual SHA, not inferred from this count.

| Decision | Current recommendation |
|---|---|
| Source approval | Ready for independent re-review with completed new full CI; **not approved**. Reviewer must examine real code/SQL changes, privacy procedure and remaining critical-tooling disposition. |
| Controlled Development Store testing | Conditional after source review and separate authorization of named isolated project, manual migrations, real app/proxy/theme operations, synthetic data and noncharging AI stub. No such operations authorized/executed here. |
| Merge | **NO-GO pending independent approval**, final checks and explicit toolchain/security disposition; main triggers deployment workflows. |
| Real merchant rollout | **NO-GO**: privacy operating/legal approval, hosted data/schema/backup/RBAC validation, actual proxy/extension/distribution/permissions evidence and financial/job reconciliation remain open. |

## Final validation — 2026-10-24

Frozen runtime/test/migration HEAD: **`901462944251ef03d450459337f183765d670526`**. [Full release CI run 98](https://github.com/mhhmod/grindctrl_booking/actions/runs/40138085737), job `121003793492`, completed **successfully** at 22:30 UTC. GitHub checked out synthetic PR merge `94966434fade05479faac93f277520cf61c41451` (parents: baseline main and that branch HEAD). Its tree `ddba3c1788b5665194d9524e5d3f8977de9ca80d` was verified identical to the frozen branch tree. This synthetic test commit is not a merge into main. The following closeout edits change documentation only; no untested runtime or SQL change is hidden behind the tested SHA.

| Executed gate | Actual result |
|---|---|
| Locked CI install, `npm ci` | Passed |
| Production dependency audit, `npm audit --omit=dev --audit-level=moderate` | Passed, zero vulnerabilities |
| Full unit/route suite, `npm test -- --maxWorkers=2` | **3,244 tests / 333 files passed** |
| `npm run typecheck` and `npm run lint` | Both passed |
| Credential-free Docker production candidate build | Passed; candidate release matched the synthetic PR SHA |
| Trivy OS/runtime-library scan, configured HIGH/CRITICAL, including unfixed findings | Passed; zero findings at those configured severities |
| Isolated candidate health/release/static/non-root startup checks | Passed; disposable container removed |
| Golden/mobile Chromium suite, 207 tests | **206 passed, 1 flaky**. English landing 1440px screenshot timed out at 5 seconds on its first attempt and passed retry #1. CI passed; this is not represented as 207 first-attempt passes. Assertions/baselines/timeouts were not changed. |
| Local affected-path suite before the last fence/cache regressions | 470 tests / 46 files passed; overlaps full CI |
| Final focused reruns | 43 refresh/fence tests across 2 files; 12 shopper-identity tests; 6 privacy SQL tests passed. These overlap the full suite and are not additional totals. |
| Local static checks | Full lint/typecheck passed; final selected-source lint and Liquid schema parsing passed. Current full CI reran typecheck/lint on the frozen source. |
| Full-graph development audit | Exit 1, **8 findings: 3 moderate, 3 high, 2 critical**. Explicit unresolved security review, not a passing gate. |

The browser retry is a P2 test-stability observation. CI also reported a non-fatal post-checkout cleanup warning for the existing `.audit-main` gitlink and cache contention; these did not change test conclusions. No unrelated workflow or screenshot changes were made to obtain a green result.

**Not executed:** hosted Supabase migration/preflight/RLS/backup recovery; real Shopify token rotation/uninstall delivery; actual A/B proxy and Theme Extension coexistence; protected customer/order permission verification; an actual privacy export/deletion/retention rehearsal; real financial/vendor reconciliation or paid AI. SQL execution evidence is isolated PGlite only. The new privacy procedure still requires independent operating/legal approval and named operators; recording, alerting or a structurally valid evidence reference is not fulfillment.

Remaining blockers: **P0 rollout** — privacy ownership/retention/operator approval and actual fulfillment evidence; **P1 source/merge** — independent review and explicit remaining critical-toolchain disposition; **P1 environment/rollout** — authorized hosted preflight, migration, Shopify installation/refresh/proxy/theme/permissions acceptance and financial/job reconciliation. Production SQL, deployment, real merchant rollout and Milestone 2 remain unauthorized. No M2 work is authorized by these recommendations.
