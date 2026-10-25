# Controlled Shopify preview — preparation only

Owner authorizes branch-only preparation and the five-development-finding exception **only inside the isolated testing constraints**. No external resource, deploy, SQL, credential, install or Shopify setting action is authorized. PR #75 stays Draft; no M2. The current product/runtime feature code is unchanged.

## Selected setup

Use **one dedicated disposable Docker preview host** (2 GB RAM recommended), a separate Supabase testing project, a separate Upstash database and Clerk development instance, and legitimate Shopify Development Store X with independent A/B registrations. Reuse the existing credential-free Docker/GHCR build approach; never the production host/service, image `:latest`, database, storage, Redis or credentials. Default to an existing *verified nonproduction* host to avoid new hosting cost; none has been verified, so otherwise request a small dedicated VM with an owner-approved spending cap. Supabase/Upstash/Clerk free tiers are preferred **if eligible**; no paid plan or resource is selected/created here. Preview TLS is a dedicated approved hostname through the supplied Caddy example. Do not repoint production DNS.

Available: production app, credit/job implementation, M1 migrations, A/B code support, Docker/CI, reviewed local regression evidence. Missing: isolated resources/identifiers, actual A/B distribution and store eligibility, full base schema, reviewed synthetic seed, and human assignments. Checked-in client `fc095fe656d9029fdc249a4af2315f19` remains registration E, not an assumed Custom A/Public B. Prior read-only packet: `/workspace/work/grindctrl-m1-authorization/AUTHORIZATION-PACKET.md`; its resource facts remain bounded source/historical facts.

## What the harness does

`Dockerfile.preview` adds only a Node preload to an approved **credential-free** candidate image. The normal production Dockerfile never copies/imports `testing/shopify`. In the preview `TRYON_MODE=live`: original authentication, credit reservation, job persistence, private result upload, finalization and refund code executes against the test Supabase project. The preload replaces **only** exact OpenRouter image/chat HTTP responses, with a generated one-pixel PNG or clearly synthetic text; there is no real AI result or provider charge. `meta.runtime=live` means the existing orchestration path, not proof of an actual provider. Original requested model identifiers can remain in job records; all run evidence must label them synthetic. Failed synthetic responses preserve the application's unknown-cost behavior.

This is not `TRYON_MODE=mock`, a fake ledger, or a new merchant product. The provider harness supports `success`, `failure` (422, no implicit retry), and `pause` for up to 60 seconds. Operator-controlled, read-only-mounted `control.json` chooses image/chat scenarios. There is no public harness-control API. Every provider attempt, including failures/refunds/previews, consumes a filesystem-persisted invocation before response. Max 24 calls/run, max two concurrent provider calls, one app replica, provider cutoff within 24 hours. An explicitly approved `drain_until` no more than 15 minutes later preserves dependency access for reserved-job completion/refund; it never enables new provider calls. Stop new ingress at cutoff, drain and stop the preview. Restart during the drain is allowed with the same state; after it, recovery needs a separately reviewed manifest/window, preserving budget and job identity. State survives normal restart; corruption/missing state/stale lock fails closed. Never reset budget to recover credit or repeat generation.

Compose attaches the app **only** to an internal Docker network, publishes only `127.0.0.1:3102`, and routes allowed HTTPS through a separate CONNECT gateway. Gateway allows exact manifest hosts/443, pins DNS to public addresses and denies providers, production projects, private/metadata IPs and unknown hosts. Node 24 `--use-env-proxy` is explicitly enabled. Both fetch defence and network topology are required. Native clients bypassing proxy should fail, not receive direct network access. TLS verification stays on. This is a boundary for reviewed code, not a hostile-code sandbox; CONNECT is not TLS interception/SNI inspection. Do not permit untrusted registry/code generation or arbitrary tool servers.

No real provider key is accepted at startup. A noncredential sentinel is injected only after validation so original provider code enters the stubbed path. Groq fallback, SMTP and runtime telemetry credentials are refused. Candidate must also have no **build-time** production telemetry: runtime env checks cannot remove already-inlined browser keys. Public legacy widget defaults that reference an existing Supabase project must stay browser-blocked or explicitly overridden for this target. Browser production/provider egress denial is a separate acceptance requirement; Docker server isolation does not configure the tester's browser.

Positive image-service wiring and failed-job finalizer/refund-contract tests run real service/entitlement/persistence/image functions, with Supabase **API responses simulated**. They do not prove actual ledger SQL or real hosted storage. No full ledger E2E is claimed until the baseline and target are available.

## Exact preparation artifacts and environment names

1. `manifest.example.json`: deliberately invalid null target fields. Fill only verified project/store/app IDs, preview origin, approved Clerk/Upstash/CDN hosts, run/evidence reference, <=24h provider cutoff and <=15m drain. No wildcard/production/provider hosts. `shopify-m1-dev.grindctrl.cloud` is a permitted **proposal only** for the preview origin, not an established DNS/service or outbound exception. This is a reviewed manifest, not authentication or permission by itself.
2. `runtime.env.names`: environment variable **names only**. Supply isolated values through approved secret management, not Git/chat/PR. `SHOPIFY_APPS` must contain exactly verified A/B with distinct secrets. No legacy fallback registration or live Clerk keys. Test app/encryption/capability keys are independent; never rotate live keys.
3. Local-only preparation after manifest review:

   ```sh
   node testing/shopify/prepare.mjs /approved/manifest.json /new/private/run-directory
   ```

   It creates config/control/budget and a hashed, **BLOCKED** migration plan; no network/resource/SQL operation. It refuses an existing directory/budget. Files are mode 600/directories 700; before approved runtime start, the dedicated operator must arrange access for container UID 1000 without exposing them to other users. Do not run preparation inside production paths.
4. Compose input names: `GRINDCTRL_PREVIEW_IMAGE`, `GRINDCTRL_GATEWAY_IMAGE` (immutable approved digests), `GRINDCTRL_TEST_ENV_FILE`, `GRINDCTRL_TEST_CONFIG_DIR`, `GRINDCTRL_TEST_STATE_DIR`. TLS input: `GRINDCTRL_PREVIEW_HOSTNAME`. Template has no production defaults, registry publish, SQL or app installation automation. Images require independent scan and exact source/harness digest evidence before execution approval.
5. `Dockerfile.preview`, `Dockerfile.gateway`, `compose.yml`, `Caddyfile.example`: ready for review, **not built/deployed here as infrastructure**. Host must have no production services/credentials, and no Docker socket/host networking/extra outbound network may be mounted into the app. Run one replica only.

## Database baseline, sequence and seed — actual blocker

`baseline-contract.json` defines the expected existing app tables/RPCs/storage and leaves baseline/seed checksums/reviews null. A complete base `tryon_shops`/ledger schema is missing from repository migrations; no new substitute was written. Required next artifact is a secret-free, schema-only catalog/export from authorized read-only access, reviewed for ownership, RLS, grants, indexes, idempotency and actual RPC signatures/behavior. Never copy production rows, use PGlite fixtures as baseline, or apply every SQL file alphabetically. Existing Supabase projects are excluded.

After baseline review and separate hosted approval, manually apply baseline/prerequisites using repository-approved Supabase SQL tooling, then verify legacy privacy table, installation isolation, review remediation, privacy casework, in that order. Inspect applicable durable-result/private-bucket, credit-balance, ownership and reconciliation deltas against the baseline; do not blindly reapply. `prepare.mjs` records exact source SHA-256 for the four M1 prerequisite/delta files. The manual uninstall-reconciliation operations template is **not** a migration and remains excluded without separate case authorization.

Prepare a reviewed synthetic-only seed (not generated by this change): two isolated test identities/tenants; actual permitted store domains; one plan/account with 12 non-renewing credits per store, no renewal/topup/payment; two products/two variants, one synthetic customer/two test orders, non-person images, separate unpublished themes. Plan/catalog grant implementation must be inspected; do not activate an existing paid catalog entry to approximate the ceiling. All grants use existing operator allowlist + owner billing/RBAC + shared rate limit + unique action key/audit. Source-only preview limit is one look/day; financial acceptance must use ordinary signed storefront sessions, not preview/test-look claims that bypass spendable credits.

## Recovery

Before execution approval, bind the exact test project/host/apps/image/harness, baseline/seed checksums and restricted schema/data/storage snapshots; rehearse restore/forward recovery against an isolated target. No snapshot or hosted restore was performed. Stop new work first, retain old verification configuration while reserved capabilities/jobs drain, reconcile original request/job IDs exactly once, preserve the budget directory and additive audit/schema. A stale budget lock requires assigned operator inspection with the app stopped; never reset/decrease its `used` counter. Restore a reviewed two-app-safe test image/config or stop and forward-fix. The observed production baseline image is not a safe two-app rollback. No destructive schema rollback, old domain-only writer, revived-token assumption, duplicate refund/grant, synthetic-to-real cost rewrite or paid AI regeneration. Actual restart/restore commands must be recorded from the selected preview host; no production command is guessed.

## Next executable sequence — only after explicit target/operation approval

1. Provision/bind separate project, preview host/TLS, Clerk test instance, Upstash and legitimate Development Store/A+B; capture actual distribution/install eligibility, app URLs/callbacks/scopes/proxy roots/extension versions. No public review bypass; do not disrupt an existing registration's development workflow.
2. Approve complete baseline/seed and backups; manually apply the verified migration plan and seed; prove RLS/browser denial and bounded credits. Unknown base schema stops here.
3. Build/scan the exact credential-free candidate and preview/gateway images; prepare local manifest/state; verify browser and server egress using controlled denied probes, never real paid generation. Inspect app has only internal network and images contain no production credentials/development servers.
4. Start the approved preview only; prove health source/digest, isolated Supabase/Redis/Clerk binding, budget/expiry, no real provider keys, no telemetry/mail/production egress. Claim no Shopify readiness from this boot alone.
5. Run the existing **14-step** checklist in `docs/audits/2026-10-24-shopify-m1-runbook.md`: baseline/recovery; A only/legacy; two merchants; A+B/App Bridge; rotation; proxy/extensions; existing features with synthetic responses; order permissions; uninstall including expired refresh; reinstall/stale events; real test ledger/jobs with pause/failure/restart; privacy recording; failure/security; drain/rollback. Scope grants, `read_customers`/protected data and actual expiry may yield BLOCKED, never inferred PASS. Only one A/B storefront publisher at a time.
6. For step 11, operator sets `control.json` to pause, starts an ordinary storefront request, observes the real isolated DB reservation, performs separately approved uninstall/cutover, then changes to success/failure. Capture one finalization/appropriate refund, unchanged merchant/subscription/job IDs, no second provider call, durable-result recovery and ledger totals after restart. Storage/finalizer fault injection must be target-scoped/approved; no public fault endpoint is introduced.
7. Record PASS/FAIL/BLOCKED for every step with exact source/image/harness/project/store/app/theme IDs and redacted evidence. Stop on wrong target, data leak, bypass, unapproved cost or financial divergence. Reconcile/drain/recover and obtain independent result signoff. Privacy record/notification is not fulfillment; its ownership/retention/named operators/deletion rehearsals remain P0 for merchant launch. No merge, production, merchant rollout or M2 follows automatically.

## Minimal responsibilities / decisions

Owner selects/binds the isolated resources and exact operation window/spending ceiling. Minimum humans: **one named test operator** with a backup/recovery responsibility, and **one different independent reviewer**; the owner authorizes execution and case-specific changes. DBA/hosting/Shopify/privacy/dependency duties may be explicitly assigned to those people where qualified; reviewer must not self-review their own manual action. All identities are **OWNER ASSIGNMENT REQUIRED**. No placeholder grants authority.

Recommended defaults requiring later approval: separate free-tier projects where eligible; existing verified nonproduction Docker host or a dedicated 2 GB VM under an approved cap; 12 synthetic credits/store, two stores max, 24 total stub calls, two concurrent provider calls, <=24h run. The owner already accepts the five development-only findings **only** inside the documented isolated scope; do not ask again for that decision. Their coordinated Zod-consumer/typography-parser remediation is still required before production release, with a named maintainer/date. Any new input/exposure/dependency change reopens the exception. No exposed watch/UI/HMR/MCP or untrusted code/registry/CSS generation.

## Local checks

```sh
node --test testing/shopify/*.test.mjs
cd apps/web-next
npx vitest run lib/try-on/controlled-provider.test.ts --maxWorkers=1
npm run typecheck
npm run lint
```

Full release CI includes the harness checks plus existing unit/route, type, lint, build, scan and browser gates. New results must be recorded against the new exact SHA; old accepted CI is not evidence for this harness. Actual container egress, Shopify installs and full real credit SQL remain unexecuted until authorized target validation.
