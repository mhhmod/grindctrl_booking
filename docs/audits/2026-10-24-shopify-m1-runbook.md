# Milestone 1 review and recovery runbook

This branch is NOT approved for production or a live merchant pilot. No production migration or Shopify configuration change was performed. Milestones 2+ require independent review and owner approval.

## Identity and ownership

The existing Clerk account/workspace, merchant ownership in `tryon_shops`/`widget_sites`, credit ledger, subscriptions and settings remain store-level business records. A Shopify app registration is not a merchant. `shopify_installations.id` identifies the credential/lifecycle boundary, uniquely constrained by canonical shop domain + app client ID. The registered app secret proves Shopify messages; it is not a core capability signing key. This milestone does not implement the later multi-platform store-ID migration.

The installation table is service-role-only with RLS and no browser policies. Credentials are AES-256-GCM encrypted. Audit rows contain operation/version/time, never plaintext credentials. Events contain personal data and have restricted access. There is no new billing or AI-spend execution path.

## Manual additive migration order

1. Independently audit the feature branch and the SQL. Confirm the actual production/staging database project, schema, backups and rollback image. Current environment cannot establish any of these.
2. Run the read-only preflight below on the correct environment, using approved database tooling. Review counts/schema without exporting customer records or secrets.
3. Document backup/recovery ownership. Do not presume development-store data is disposable.
4. After separate authorization and legacy-schema preflight, apply `supabase/20261024_shopify_installation_isolation.sql`, then `supabase/20261024_shopify_review_remediation.sql`, then `supabase/20261024_shopify_privacy_casework.sql` using repository-approved manual Supabase SQL tooling. The casework delta requires `20260909_shopify_privacy_requests.sql` to exist. Do not use automatic app-startup migration or Supabase CLI deployment. Do not reapply earlier function definitions over the follow-up deltas.
5. Verify grants, RLS, functions and indexes in the target database, including that service_role has its expected RLS bypass. The local PGlite fixture is not proof of live Supabase policies.
6. Configure an independent random `GRINDCTRL_CAPABILITY_SECRET` (at least 32 bytes of entropy; the code enforces minimum string length, not entropy). Do not reuse a Shopify secret. This change requires approved runtime configuration; this branch neither creates nor rotates live secrets.
7. For additional Shopify registrations, configure their own app URL `/shopify/app/<clientId>`, matching OAuth redirect URLs, proxy configuration and separately released extensions. The original `/shopify/app` works only for one configured registration, or with a valid ID token identifying the app. A path chooses App Bridge's initializer; it never authorizes API operations.
8. Deploy only after separate authorization. Drain/retire all old domain-only credential writers and the old privacy executor before enabling a second registration; do not mix old and new images in a two-app rollout. Reauthorize the Development Store using the actual app. New credentials populate installation storage. Domain-only legacy credentials remain untouched and are NOT used or automatically attributed.
9. Verify Development Store install, refresh, browser features, uninstall/reinstall and two-app overlap before requesting any real merchant pilot. No paid generations or real payments are authorized by this runbook.

### Read-only preflight (do not mistake this for an applied migration)

```sql
select current_database(), current_user;
select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public' and table_name in
 ('tryon_shops','shopify_shop_tokens','shopify_privacy_requests',
  'shopify_installations','shopify_installation_events','shopify_credential_audit')
order by table_name,ordinal_position;
select status,count(*) from public.tryon_shops group by status;
select count(*) as legacy_credentials_requiring_provenance_or_reauthorization
from public.shopify_shop_tokens;
select status,count(*) from public.shopify_privacy_requests group by status;
select tablename,rowsecurity from pg_tables
where schemaname='public' and tablename like 'shopify%';
select schemaname,tablename,policyname,roles,cmd from pg_policies
where schemaname='public' and tablename like 'shopify%';
```

If the new tables already exist, compare their full schema/functions/grants with this migration. `IF NOT EXISTS` is not a substitute for drift inspection. Do not backfill ambiguous credentials from the first configured app or from the mere existence of a single current registration. New authorization establishes ownership safely. Legacy records must remain in the inventory until their retention/disposal is authorized.

Single-app compatibility does not establish historical token ownership. The fallback app configuration, original embedded entry, merchant account, settings and ledger remain compatible; a token with no app provenance still requires fresh authorization. This repository contains no trustworthy historical token-to-registration mapping to backfill. If an operator later produces evidence, audit it separately rather than altering this migration to guess.

## Token acquisition, refresh and reauthorization

Acquisition and refresh share a fenced database lease for the same app/store. Refresh now retries network/timeout/429/5xx failures at most three times under that lease, with bounded in-request waits and a distributed cooldown honoring longer Retry-After values. Transient exhaustion/persistence failure preserves encrypted refresh credentials and active status, while returning unavailable until recovery; it does not invent fresh access. Abandoned expired leases can be recovered with a new fence. Shopify permits retry of the presented refresh token until its replacement is used, within provider expiry/grace; no fixed retry window is assumed. Terminal 401 requires reauthorization; other permanent rejections do not loop. Successful responses atomically replace encrypted access/refresh tokens and response-defined expiry metadata. Authorization-code acquisition is not blindly retried.

Expiring is the default. Explicit `tokenMode: "non-expiring"` is accepted only on a registration declaring `distribution: "custom"`; actual eligibility must still be checked in Dev Dashboard. Never configure it for Public. A 401 from the Admin client retires only the matching credential version; a late rejection must not invalidate a replacement.

If two active installations exist and a store-level caller has no application context, credentials resolve to unavailable rather than guessing. App-authenticated consumers carry the verified client ID. Dashboard theme/admin links require authenticated ownership and a sole unambiguous installation. Choosing a preferred installation during prolonged overlap remains an explicit future UI decision; use the correct per-app embedded entry during review.

The optional, disabled-by-default unsigned/nonbillable storefront compatibility bridge also refuses multiple configured registrations before fetching a product. With one configured registration it resolves products and signs using that same registration. This exception never permits merchant billing.

## In-flight Try-On and registration cutover

New storefront sessions, attempts and generation requests must pass the active-installation check for the app that signed the capability. An active B does not authorize a disconnected A. Proxy configuration checks installation state before consulting the shared merchant availability cache. Database/read failures deny new work.

Already-reserved jobs keep their existing merchant, job ID, request key, reservation and provider-cost metadata. Completion/refund/finalization recovery does not acquire Shopify credentials or move credits to a new app. Poll/release routes continue to require the exact short-lived session/product/shop capability; they do not authorize a new generation. Service tests cover a registration replacement while the provider is paused, including success, provider failure and pending finalization without another provider call. Persistence and provider calls in those tests are mocked; actual ledger RPCs and deployed reconciliation still need validation.

Before any authorized cutover, record pending-job counts and existing job/ledger identifiers with restricted tooling. Retain the former registration's server-side signing configuration through the capability/job drain window; uninstalling A is distinct from removing its configured verification key. Removing that key immediately makes A's still-valid polling capabilities unverifiable. Do not rotate/reissue a capability or replay generation merely to retrieve an existing result. If a key is revoked for a security reason, keep it revoked and reconcile through approved server-side operations instead.

Check the actual deployed definitions and schedule for `reconcile_tryon_entitlements()` and private result cleanup. The checked-in reconciliation schedule is daily (`03:17 UTC`), so historical comments about a ten-minute sweep are not evidence of an actual ten-minute schedule. Inspect `pg_cron`/scheduler state before claiming prompt recovery. Interrupted finalization needs authoritative reconciliation, not a second reservation, duplicate refund or invented zero provider cost. Removing one app must not delete pending jobs, subscription records or ledger entries. This branch performs no such deletion.

## Lifecycle event handling and limits

HMAC resolution retains app identity. Receipt persistence uses the follow-up v2 RPC, so a missing remediation migration fails before any old timestamp-driven mutation. Neither delivery ID nor Triggered-At is authority for lifecycle changes; both are unsigned metadata. Receipts remain pending while the backend verifies the current app's credential against Shopify under the shared acquisition/refresh lease. A successful currentAppInstallation probe ignores the old uninstall; a definitive 401 for that exact still-unexpired credential permits an installation/version/lease-fenced disconnect. The evidence records installation ID, credential version, outcome and verification time. B is never mutated by A's event.

Expired credentials first pass through the serialized refresh path. A terminal refresh disables that credential but does not prove uninstall generation; that event remains pending for manual reconciliation. Network/429/5xx/403, missing credentials, parse/GraphQL errors or a lost fence cannot delete credentials. The handler returns 503 for retry after the receipt is durable. If Shopify exhausts retries, the pending queue still needs a named operator. Duplicate or altered-header bodies cannot by themselves retire a newer valid credential. A 401 proves current credential rejection, not its unique underlying cause; generation ambiguity when no usable credential exists remains a documented external reconciliation gate. Scope events never reactivate an installation.

## Privacy: casework implementation and unresolved operating approval

The old automatic domain-wide deletion executor is removed from the request path, regardless of `SHOPIFY_PRIVACY_PROCESSING_ENABLED`. That path could delete shared records for a different live integration. All three mandatory topics record verified app provenance, raw payload and manual_required state. The follow-up casework delta adds a restricted new/legacy deadline queue and append-only operator evidence. The reviewed implementation contract and operating procedure are in [privacy fulfillment procedure](2026-10-24-shopify-privacy-procedure.md); organizational/legal approval and hosted rehearsal remain unresolved. Alert success is tracked separately from fulfillment; an unavailable alert asks Shopify to retry.

A duplicate request may retry a failed alert, but cannot trigger shared deletion. Concurrent SMTP delivery can still produce duplicate notifications; exactly-once email delivery is not claimed. No customer export or deletion is considered completed by merely recording or emailing an alert.

Before merchant launch, assign an accountable privacy operator and independently approve data ownership, shared-record scoping, applicable deletion deadlines, backup handling and any specific accounting-retention basis. Retaining an entire ledger indefinitely is NOT justified by this implementation. Requests may require deletion of applicable shared data even when another installation remains; that obligation is not suppressed. Until an approved execution procedure and evidence exist, this is a NO-GO gate, not optional work.

Shopify requires completion within 30 days of receipt, subject to an actual legal retention obligation; `shop/redact` is normally sent 48 hours after uninstall. Neither an alert nor the presence of another active installation suspends that obligation. See [Shopify's compliance requirements](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance). Review pending requests daily with a named owner and escalation well before the deadline. This code does not implement approved fulfillment or certify a legal retention basis.

### Privacy monitoring

Use approved restricted tooling to review pending counts and age, without putting payloads in application logs:

```sql
select app_client_id,topic,status,count(*),min(received_at) as oldest
from public.shopify_installation_events
where status in ('manual_required','failed','received')
group by app_client_id,topic,status;
```

Review new and legacy requests through `shopify_privacy_work_queue`, including legacy completion_unverified cases. Casework does not guess ownership or execute erasure. Its restricted operator RPC requires reviewed scope, independent reviewer and execution/verification references before atomically recording fulfillment and closing the source request. A notification or approval alone cannot complete a request. See the procedure for exact ownership joins, storage ordering, deadlines, retention, partial failure and evidence requirements; no live deletion was executed.

## Rollback

- Before any migration/configuration/code rollout, preserve the prior image and reviewed environment/configuration references.
- New schema is additive. Recovery should retain it and audit data; do not drop tables or restore the domain-only writer into a two-app deployment.
- If new credentials were issued/refreshed, old credentials may be retired at Shopify. Reverting the code does not make them valid. Prefer a forward fix or explicit, authorized reinstall/reauthorization on the correct registration.
- New core keys invalidate old claim/preview/origin/demo capabilities. Links expire and must be reissued. Never restore unsafe cross-purpose/platform fallback signing merely to keep stale links working.
- Removing/uninstalling a registration or applying privacy deletion cannot be undone by schema rollback. No privacy deletion was performed by this branch.

## Commercial and distribution boundaries

GRINDCTRL signup, merchant ownership claim, Shopify installation, OAuth authorization, and Theme widget placement are distinct steps. A theme block is not a fully authorized integration. Custom is only merchant-specific/qualifying Plus organization; no mass-registration onboarding or unapproved public self-installation is added. Public approval and protected-data permissions remain separate from code readiness. No paid pricing or payment mechanism is selected; existing operator-only entitlement guards remain unchanged.

Current [Shopify billing guidance](https://shopify.dev/docs/apps/launch/billing) makes Shopify App Pricing the default for new Public submissions, with documented exceptions for unsupported models. The owner must separately approve any paid pricing and applicable submission configuration. This milestone preserves limited entitlements and implements no alternative checkout. Custom distribution does not provide Shopify App Store billing eligibility.

## Development Store acceptance plan — NOT EXECUTED

Also execute the [per-registration proxy coexistence checklist](2026-10-24-shopify-proxy-coexistence.md). Current code supports distinct validated proxy paths; actual Shopify routing and extension releases are unverified.

Run only after independent M1 review and explicit authorization for the named nonproduction target, migration, runtime configuration and Development Store changes. Use existing legitimate registrations; this plan does not authorize creating apps, changing distribution, installing on a real merchant store, or spending money. Record target store IDs/domains, registration IDs, release SHA, migration checksum, scope grants, extension versions, tester and timestamps in restricted evidence. Never include secrets, bearer tokens, shopper photos or protected customer fields in the PR.

Use synthetic catalog/customers/orders and a noncharging AI stub. A stub establishes orchestration/UI behavior only; real provider quality/cost and full AI E2E remain unverified until separately authorized. Use a second legitimate Development Store for cross-merchant scenarios if available; otherwise mark that scenario blocked.

| Step | Action in authorized isolated environment | Acceptance evidence |
|---|---|---|
| 1. Preflight and recovery | Confirm target project, current schema/RLS, owner mappings, pending privacy/job counts, ledger totals, backup and rollback owner. Apply reviewed additive SQL; inspect grants/functions/indexes. | Snapshot counts and checksums retained; no merchant/ledger/history deletion; browser roles denied. |
| 2. Single app / legacy reconnect | Open the original single-app entry, reauthorize A where legacy provenance is unknown, reopen existing dashboard/settings. | Same GRINDCTRL owner/store/subscription/ledger IDs; correctly scoped encrypted installation credential; no duplicate free grant. |
| 3. Two stores | Connect the second test store with distinct ownership and attempt access to the first store's embedded and dashboard endpoints. | Cross-tenant requests denied before privileged reads/mutations; independent installation rows. |
| 4. Two apps / one store | Authorize B independently on store X; open each configured embedded URL and compare safe app IDs/installation IDs. | Distinct A/B credentials; App Bridge initializes the intended app; wrong audience/signature rejected. No credential transfer assumed. |
| 5. Rotation and contention | Exercise an actual expiring offline token lifecycle, including concurrent acquisition/refresh requests, provider failure and revoked/retired credentials. Do not edit production expiry metadata to force it. | One lease owner, response-defined expirations, encrypted rotating refresh token, fenced stale writes and explicit reauthorization. Eligible Custom non-expiring mode tested separately if used. |
| 6. Extensions and proxy | Verify separately released Theme Extensions and each real proxy configuration, then use theme/admin deep links. | Correct registration/block placement; no automatic transfer. Standalone links fail safely while multiple active installations remain ambiguous. |
| 7. Existing features | Exercise dashboard/settings, product/variant/images, chat widget, Try-On stub, cart behavior and available analytics in EN/AR. | Actual observed results per feature recorded; stubbed AI explicitly labelled; unsupported operation is a failure state, never fabricated success. |
| 8. Order permissions | Test synthetic orders with and without granted `read_orders`, verified-customer `read_customers`, and applicable protected-data/field access. | Matching customer/order/email checks; missing/redacted access denies safely. Older-than-60-day orders require separately approved all-orders access; do not promise availability without it. |
| 9. Overlapping uninstall | Start with A+B authorized, uninstall A only, receive actual delivery, replay duplicate/delayed A events in isolation. | B token/version/status remain unchanged; merchant remains installed; A's new session/attempt/generation denied; B remains usable; shared credits/settings retained. |
| 10. Reinstall / ordering | Reauthorize A; deliver old A uninstall and stale scopes updates, including missing/future ordering metadata. | Stale event ignored or manual_required; no unrelated mutation/reactivation. Review unsigned delivery-header limitations explicitly. |
| 11. In-flight recovery | With the AI stub pause a reserved job, disconnect A, then complete/fail it; test process restart and finalizer failure. | Same job/request/merchant/reservation, one provider call, one applicable settlement/refund, durable authorized result and reconciliation signal. Capture actual ledger deltas and scheduler evidence. |
| 12. Privacy | Use synthetic events for all three mandatory topics, duplicate delivery and unavailable alert transport; review overlap with B. | Durable app-scoped pending request and observable retry; no unscoped deletion; no false completion. Approved fulfillment remains a P0 gate and requires its own execution evidence. CLI-triggered events alone do not prove subscription delivery. |
| 13. Failure and logs | Exercise missing Redis/DB, malformed JWT/HMAC, foreign tenant/job/session, rejected remote image URLs and invalid browser origin/message proofs. | Fail closed without privileged work, credential/PII disclosure or unlimited AI allowance. |
| 14. Drain and recovery rehearsal | Reconcile pending jobs, confirm bounded result cleanup, drain old capabilities before retiring a registration's configured key; rehearse approved forward recovery. | No lost job/ledger history; no duplicate grant/refund/generation; no assumption that a retired Shopify token becomes valid on rollback. |

Mark each step `Passed`, `Failed`, or `Blocked`, with evidence and the exact SHA. Stop on cross-app/cross-tenant access, data loss, ambiguous migration, privacy deadline risk or unapproved cost. Passing these controlled tests is not production approval and does not authorize Milestone 2.

## Reproduce local checks

From `apps/web-next` after `npm ci --ignore-scripts`:

```sh
npm test -- --maxWorkers=2 --testTimeout=30000
npm run typecheck
npm run lint
npm run build
npx playwright test --config playwright.shopify-isolation.config.ts
```

The dedicated browser config starts only a local build with synthetic app registrations, blank service credentials and external browser requests blocked. It is skipped by other Playwright configs unless explicitly enabled. On a host with system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. A stubbed App Bridge establishes local HTML/initializer behavior only; real Shopify authentication remains unverified.
