# Controlled Shopify preparation — delivery evidence

25 October 2026, Africa/Cairo. Owner authorizes branch-only preparation and accepts the five remaining development findings **only** within isolated testing constraints. No provisioning/deployment/Shopify/hosted-SQL execution authorization, production waiver, merge or M2 is inferred.

Implementation/instructions: [testing/shopify](../../testing/shopify/README.md). Code/config/test revision **`fb74a08972ba430eef1bcd3b2ff06e15dd07f22c`**; changes since accepted `94b2a57`: 20 files (test harness/guards/tests, preview/gateway/TLS/environment/Compose templates, baseline contract/preflight/local preparation utility and CI checks). No app feature, merchant-credit/subscription/job implementation or production image entrypoint changed. The normal production Dockerfile does not include the harness.

[Full CI 40188515879](https://github.com/mhhmod/grindctrl_booking/actions/runs/40188515879), job `121154320073`, completed successfully. It checked out synthetic PR merge `73fe4ea4afd19fd7b618acc7272a207effa2eab3`; tree `9db1f9e802cabe99b127b7c1b6922f05a1829841` was verified identical to the branch code tree. This is not a merge into main.

| Executed verification | Result |
|---|---|
| Node harness/security/preparation contracts | **15 passed**; real-provider/production-target denial, source/key/config guards, budget persistence, pause/concurrency/abort, bounded dependency drain, DNS/CONNECT controls and Node proxy behavior |
| Compose topology render/inspection | Passed; no profile container/network built/pulled/created/started by this check |
| Full unit/route/component/isolated SQL suite | **3,250 tests / 335 files passed**; includes two new real-service/provider-path wiring tests with simulated Supabase API responses |
| Typecheck/lint | Passed locally and in CI |
| Existing credential-free production candidate build, configured HIGH/CRITICAL scan, isolated health/release/static/non-root checks | Passed |
| Golden/mobile browser suite | **207 passed**, no flake reported |
| Production dependency audit | Passed, zero vulnerabilities; lockfile/dependency versions unchanged by this preparation |

The two wiring tests demonstrate original reservation, result persistence, finalizer/refund-contract and request-replay code paths. They do **not** verify actual hosted financial SQL or storage. Node/Compose checks are not proof of a deployed network boundary. Preview and gateway images have **not** been built/scanned/deployed against an approved isolated target; both need exact digest review and target validation. Actual A/B eligibility, install/App Bridge/proxy/theme/permissions, expired-token delivery, full real test ledger, backups and rollback remain unexecuted. Existing accepted evidence at `77ae80e` is historical, not substituted for this revision.

Genuine blockers: no verified isolated project/host/Clerk/Redis/store/A+B bindings; complete base `tryon_shops`/credit schema and reviewed synthetic seed unavailable; no authenticated read-only baseline access or named operator/reviewer/recovery owner. Base financial DDL was not invented. The local utility emits a **BLOCKED** migration plan until baseline review. Resources/keys/data/queues are not copied from production. All external operations still need explicit approval; manual uninstall reconciliation remains per-case approval only.

Default recommendation: separate free-tier Supabase/Upstash/Clerk where eligible plus a verified nonproduction Docker host, otherwise a dedicated small 2 GB preview VM under an owner-approved cap; dedicated TLS hostname; legitimate Dev Store and independently authorized A/B test registrations. One operator/recovery owner plus a different independent reviewer (identities OWNER ASSIGNMENT REQUIRED). Bounded defaults: 12 synthetic credits/store, two stores max, 24 total stub invocations, two concurrent calls, <=24h provider window and <=15m drain. Exact artifact/revision/target/operation authorization follows review, never automatically from a manifest reference.

After authorization: provision/bind targets → baseline/diff/backup approval → manual migrations and synthetic seed → build/scan exact preview artifacts → verify server/browser egress and identity/budget → execute the existing 14-step checklist → drain/reconcile/rollback and independent result signoff. Instructions, environment names and configuration artifacts are in the implementation README. Five development findings retain production-remediation ownership requirements. **Privacy Fulfillment remains P0 for merchant launch.** PR #75 remains Draft; production/real merchant rollout/merge/M2 remain unauthorized.
