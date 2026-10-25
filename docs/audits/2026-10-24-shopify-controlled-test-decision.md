# Milestone 1 — controlled Development Store test decision

Independent re-review at `1c5f31a3634db61abc9051556c5013f29d3b3e31`: **APPROVE WITH CHANGES; keep Draft PR 75**. This document supports the next review/authorization decision. It does not grant final M1 approval or permission for any external operation. No M2 work is included.

Prepared code/test/operations revision: **`77ae80ec865dd0d36464563cb95dc636bee5aae0`**. New full CI completed successfully, with the exact evidence below; older 3,244-test evidence is not substituted for these changes. Final report closeout after this revision is documentation only.

## Minimum changes after re-review

1. `app/api/shopify/webhooks/expired-uninstall.test.ts` integrates the actual webhook handler/HMAC, refresh implementation and real isolated PGlite lease/lifecycle SQL. Expired access + terminal refresh 401 or transient 503 leaves a durable pending receipt; duplicate/future-header deliveries cannot retire a newer installation. B and shared merchant state remain unchanged. Fresh A authorization plus current-app verification safely reconciles old receipts.
2. A narrowly scoped [operator casework template](../../supabase/operations/shopify_uninstall_reconciliation.sql) closes an already-disabled installation only after current, independently reviewed app/store absence evidence and separate operation approval. It is **not a schema migration, public RPC or automatic worker**. It checks installation/version/status, shared lease/lock, evidence freshness and exact pending receipt membership; stale/foreign/newly reauthorized/duplicate closure attempts fail without mutation. Actual template execution was rehearsed only in local PGlite with synthetic evidence. Human identity/allowlisting and the truth of external evidence require approved operator tooling and independent verification; strings/hashes are not authentication or proof.
3. Separate toolchain commit `925ad61` pins Vitest 4.1.12/mocker 4.1.12, removes Tinypool, and keeps patched Vite 7.3.7. Six existing test fixtures explicitly clear mock history/reset a mock or use constructible Audio mocks for Vitest 4 semantics; assertions/runtime behavior remain intact. No application/UI/credit/subscription/provider code changed. [Security disposition of all eight previously remaining findings](2026-10-24-development-dependency-triage.md#current-independent-re-review-disposition): now **five development findings, zero critical; production audit zero**. Three high chain findings involve nested Zod/shadcn/registry; two moderate involve typography/parser. Their upstream consumer upgrades remain assigned-review work, with narrow test controls required; no blanket risk acceptance.
4. The [validation runbook](2026-10-24-shopify-m1-runbook.md#development-store-acceptance-plan--not-executed) now specifies the exact authorization packet, target/credential isolation, paid-provider egress denial, synthetic fixtures, A/B installation/App Bridge/proxies/extensions, expired-token uninstall/manual resolution, reinstall/replay, actual credit/job settlement evidence, stop conditions and rollback rehearsal. Existing [proxy requirements](2026-10-24-shopify-proxy-coexistence.md) still apply, including one storefront publisher at a time. No actual Shopify compatibility has been verified.

## Evidence required before an execution decision

| Requirement | Current state / minimum evidence |
|---|---|
| Source and CI | Independent review of this delta plus complete new CI on the frozen source. Results recorded below; final M1 approval remains with reviewer/owner. |
| Remaining development security risk | Reviewer accepts the documented narrow test boundary or requires additional remediation. Name a dependency owner/target date for coordinated consumer upgrades; none is assigned here. No untrusted registry/CSS input or exposed watch/UI/API/HMR/MCP services. |
| Named authorization packet | Exact isolated host/image digest/Supabase project, Development Store canonical identity, legitimate A/B registrations, real proxy paths/theme/extension releases, operator/backup/reviewer/rollback owner, operation list/time window and evidence ticket. **Unassigned/unverified; separate explicit authorization required.** |
| Isolation preflight | Verify no production keys/projects/storage/queues/telemetry/mail or merchant records; no change to another development workflow. Candidate image excludes development tooling. Synthetic catalog/customers/orders only, audited bounded test credits, working noncharging stub plus demonstrated blocked AI/payment egress. |
| Recovery readiness | Approved backups/snapshots and known safe image/configuration (or stop/forward-fix plan), old capability key drain, exact ledger/job reconciliation and no unsafe down migration/domain-only writer rollback. |

## Minimum test evidence to approve the controlled result

Use the runbook's per-step `Passed / Failed / Blocked` record with exact source/image/store/app/theme/path identities and restricted evidence references. Required observations are: A single-app install, independent A+B authorization, correct real App Bridge audience/client ID, actual separate proxy routes and extension releases, A uninstall while B remains usable, expired access/failed refresh and assigned reconciliation, A reinstallation with old-event replay, one applicable settlement/refund per synthetic job across failure/restart, and successful rollback/forward recovery without duplicate credits or lost jobs. A locally simulated provider/Shopify response is labelled simulated; it cannot substitute for platform evidence. If actual expiry timing or protected permissions cannot be exercised, that scenario is **Blocked**, never inferred passed.

Do not log bearer tokens, webhook HMACs, customer fields or photos. Keep synthetic replay material only in approved restricted ephemeral storage. Stop on cross-tenant/app access, wrong project, ambiguous migration, privacy deadline risk, unapproved cost, noncharging-stub/egress failure or unreconciled credit/job divergence. Preserve evidence and involve the named reviewer; do not “fix” a failure by relaxing assertions or directly regranting credits.

## Privacy and release boundaries

**Privacy Fulfillment remains P0 for merchant launch.** Approved data ownership/retention, named accountable/backup operators, legally appropriate vendor/backup/accounting handling, new/legacy request monitoring, and actual export/deletion/verification rehearsals are still required under the [privacy procedure](2026-10-24-shopify-privacy-procedure.md). Case recording, notification, synthetically valid evidence references and lifecycle closure are not privacy fulfillment. Synthetic controlled testing does not waive those obligations or approve a merchant pilot.

| Decision | Recommendation |
|---|---|
| Source / final M1 approval | Ready for independent delta review after completed new CI; **APPROVE WITH CHANGES remains the owner's latest verdict**, not final approval. |
| Controlled Development Store execution | **Conditional GO recommendation only** once the evidence/authorization packet above is approved. No deployment, hosted migration, settings change or installation is authorized/executed by this document. |
| Merge | **NO-GO** without separate independent approval/authorization and security disposition. PR stays Draft. |
| Real merchant rollout / M2 | **NO-GO**. Privacy P0 and actual environment/platform/financial validation remain open; M2 requires its own approval. |

## Validation record

Verified 2026-10-25: [full CI run 102 / 40140601855](https://github.com/mhhmod/grindctrl_booking/actions/runs/40140601855), job `121011344065`, completed successfully on 2026-10-24 at 23:02 UTC. GitHub checked out synthetic PR merge `9d6507b88bd499a17e8d2f6b492c82850402060b`, with parents baseline main `4f5467f` and source `77ae80e`. Its tree `4c396bc0ec7b80d170005a97f12b673f7160d764` was verified identical to the branch source tree. This was not a merge into main.

| Actual executed gate | Result |
|---|---|
| Locked install; production-only dependency audit | Passed; audit zero |
| Full unit/route/SQL/component suite | **3,248 tests / 334 files passed** |
| Typecheck; lint | Passed |
| Credential-free production container build | Passed |
| Configured HIGH/CRITICAL OS/runtime-library image scan | Passed, zero findings at those severities |
| Isolated release/health/static/non-root startup checks | Passed; disposable candidate removed |
| Golden/mobile Chromium suite | **207 passed**, no flaky/retried cases reported |
| Full development audit | **5 findings, 0 critical**; exit 1, not an all-clear |

Local targeted runs passed: initial 45 tests across three credential/lifecycle/expiry files; 85 tests across five corrected fixture/expiry files; final 19 Audio tests across two files; final four expiry/manual-template tests. Counts overlap and must not be added. Local full lint, final typecheck and selected final-source lint passed. The first local full migration attempt exposed mock-reset/constructor fixture failures and was interrupted after identifying them; it is **not** a passing full-suite result. Intermediate CI run 100 also exposed the remaining second Audio-constructor fixture (one failure); `77ae80e` corrected the fixture without changing the assertion. Run 102 above is the authoritative final full-suite evidence. The existing `.audit-main` post-checkout cleanup warning remained non-fatal and was not disguised as a clean cleanup.

No hosted database state, Shopify settings or actual integration readiness has been inspected or changed in this re-review task. The only SQL executions used isolated PGlite. No merge, deployment, hosted migration, app installation, Shopify setting/credential change, paid AI, real merchant operation or M2 occurred.

## Exact re-review delta

17 files since `1c5f31a`; only report/checkpoint closeout changed after the frozen tested revision. No new schema migration is required by this delta. Existing reviewed migration ordering and rollback limitations remain in the runbook. The operations template is per-case manual work, never an automatic deployment step.

- `apps/web-next/app/api/shopify/proxy/try-on-context/route.test.ts`
- `apps/web-next/app/api/shopify/webhooks/expired-uninstall.test.ts`
- `apps/web-next/app/api/try-on/jobs/[jobId]/route.test.ts`
- `apps/web-next/app/api/try-on/session/route.test.ts`
- `apps/web-next/components/assistant/use-voice-message-player.test.ts`
- `apps/web-next/components/assistant/voice-message-player.test.tsx`
- `apps/web-next/lib/try-on/service.test.ts`
- `apps/web-next/package-lock.json`
- `apps/web-next/package.json`
- `docs/audits/2026-10-24-development-dependency-triage.md`
- `docs/audits/2026-10-24-readiness-matrix.md`
- `docs/audits/2026-10-24-shopify-controlled-test-decision.md`
- `docs/audits/2026-10-24-shopify-m1-runbook.md`
- `docs/audits/2026-10-24-shopify-m1.md`
- `docs/audits/2026-10-24-shopify-review-remediation.md`
- `docs/superpowers/checkpoints/2026-09-05-production-risk-closure.md`
- `supabase/operations/shopify_uninstall_reconciliation.sql`
