# Milestone 1 review and recovery runbook

This branch is NOT approved for production or a live merchant pilot. No production migration or Shopify configuration change was performed. Milestones 2+ require independent review and owner approval.

## Identity and ownership

The existing Clerk account/workspace, merchant ownership in `tryon_shops`/`widget_sites`, credit ledger, subscriptions and settings remain store-level business records. A Shopify app registration is not a merchant. `shopify_installations.id` identifies the credential/lifecycle boundary, uniquely constrained by canonical shop domain + app client ID. The registered app secret proves Shopify messages; it is not a core capability signing key. This milestone does not implement the later multi-platform store-ID migration.

The installation table is service-role-only with RLS and no browser policies. Credentials are AES-256-GCM encrypted. Audit rows contain operation/version/time, never plaintext credentials. Events contain personal data and have restricted access. There is no new billing or AI-spend execution path.

## Manual additive migration order

1. Independently audit the feature branch and the SQL. Confirm the actual production/staging database project, schema, backups and rollback image. Current environment cannot establish any of these.
2. Run the read-only preflight below on the correct environment, using approved database tooling. Review counts/schema without exporting customer records or secrets.
3. Document backup/recovery ownership. Do not presume development-store data is disposable.
4. After separate authorization, apply `supabase/20261024_shopify_installation_isolation.sql` using repository-approved manual Supabase SQL tooling, NOT automatic app-startup migration or Supabase CLI deployment.
5. Verify grants, RLS, functions and indexes in the target database, including that service_role has its expected RLS bypass. The local PGlite fixture is not proof of live Supabase policies.
6. Configure an independent random `GRINDCTRL_CAPABILITY_SECRET` (at least 32 bytes of entropy; the code enforces minimum string length, not entropy). Do not reuse a Shopify secret. This change requires approved runtime configuration; this branch neither creates nor rotates live secrets.
7. For additional Shopify registrations, configure their own app URL `/shopify/app/<clientId>`, matching OAuth redirect URLs, proxy configuration and separately released extensions. The original `/shopify/app` works only for one configured registration, or with a valid ID token identifying the app. A path chooses App Bridge's initializer; it never authorizes API operations.
8. Deploy only after separate authorization. Reauthorize the Development Store using the actual app. New credentials populate installation storage. Domain-only legacy credentials remain untouched and are NOT used or automatically attributed.
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

## Token acquisition, refresh and reauthorization

All acquisition and refresh paths use a shared database lease for the same app/store, covering provider request plus persistence. Leases are fenced, bounded longer than the request timeout, and invalidated by lifecycle changes. Expired abandoned leases require reauthorization rather than blind background refresh. Refresh responses replace both encrypted tokens and their response-defined expiration metadata. No token operation retries a potentially consumed code/refresh token automatically.

Expiring is the default. Explicit `tokenMode: "non-expiring"` is accepted only on a registration declaring `distribution: "custom"`; actual eligibility must still be checked in Dev Dashboard. Never configure it for Public. A 401 from the Admin client retires only the matching credential version; a late rejection must not invalidate a replacement.

If two active installations exist and a store-level caller has no application context, credentials resolve to unavailable rather than guessing. App-authenticated consumers carry the verified client ID. Dashboard theme/admin links require authenticated ownership and a sole unambiguous installation. Choosing a preferred installation during prolonged overlap remains an explicit future UI decision; use the correct per-app embedded entry during review.

## Lifecycle event handling and limits

HMAC resolution retains the app registration. The signed uninstall body must match the supplied shop. Receipts and lifecycle state changes are transactional and deduplicated by app + delivery ID; identity conflicts fail instead of being acknowledged. Uninstall only clears that installation's credentials. Store status becomes uninstalled only if no other active installation remains.

Ordering uses Shopify Triggered-At as a conservative hint: missing/future timestamps are manual cases; events predating authorization are ignored. Shopify's body HMAC does not bind delivery headers. This is not proof against every captured-valid-message/header-replay scenario. Development Store event-order evidence and a review of this residual threat are release gates. Scopes events are recorded for authoritative re-verification and never globally reactivate stores.

## Privacy: explicit unresolved launch blocker

The old automatic domain-wide deletion executor is removed from the request path, regardless of `SHOPIFY_PRIVACY_PROCESSING_ENABLED`. That path could delete shared records for a different live integration. All three mandatory topics now record verified app provenance, raw payload and manual_required state. Alert success is tracked separately from fulfillment; an unavailable alert asks Shopify to retry.

A duplicate request may retry a failed alert, but cannot trigger shared deletion. Concurrent SMTP delivery can still produce duplicate notifications; exactly-once email delivery is not claimed. No customer export or deletion is considered completed by merely recording or emailing an alert.

Before merchant launch, assign an accountable privacy operator and independently approve data ownership, shared-record scoping, applicable deletion deadlines, backup handling and any specific accounting-retention basis. Retaining an entire ledger indefinitely is NOT justified by this implementation. Requests may require deletion of applicable shared data even when another installation remains; that obligation is not suppressed. Until an approved execution procedure and evidence exist, this is a NO-GO gate, not optional work.

### Privacy monitoring

Use approved restricted tooling to review pending counts and age, without putting payloads in application logs:

```sql
select app_client_id,topic,status,count(*),min(received_at) as oldest
from public.shopify_installation_events
where status in ('manual_required','failed','received')
group by app_client_id,topic,status;
```

Review the legacy `shopify_privacy_requests` backlog too. This branch does not migrate, erase, or mark old requests fulfilled. An operator must record separately reviewed fulfillment evidence before any completed status; no destructive execution command is provided here.

## Rollback

- Before any migration/configuration/code rollout, preserve the prior image and reviewed environment/configuration references.
- New schema is additive. Recovery should retain it and audit data; do not drop tables or restore the domain-only writer into a two-app deployment.
- If new credentials were issued/refreshed, old credentials may be retired at Shopify. Reverting the code does not make them valid. Prefer a forward fix or explicit, authorized reinstall/reauthorization on the correct registration.
- New core keys invalidate old claim/preview/origin/demo capabilities. Links expire and must be reissued. Never restore unsafe cross-purpose/platform fallback signing merely to keep stale links working.
- Removing/uninstalling a registration or applying privacy deletion cannot be undone by schema rollback. No privacy deletion was performed by this branch.

## Commercial and distribution boundaries

GRINDCTRL signup, merchant ownership claim, Shopify installation, OAuth authorization, and Theme widget placement are distinct steps. A theme block is not a fully authorized integration. Custom is only merchant-specific/qualifying Plus organization; no mass-registration onboarding or unapproved public self-installation is added. Public approval and protected-data permissions remain separate from code readiness. No paid pricing or payment mechanism is selected; existing operator-only entitlement guards remain unchanged.

## Reproduce local checks

From `apps/web-next` after `npm ci --ignore-scripts`:

```sh
npm test -- --maxWorkers=2
npm run typecheck
npm run lint
npm run build
npx playwright test --config playwright.shopify-isolation.config.ts
```

The dedicated browser config starts only a local build with synthetic app registrations, blank service credentials and external browser requests blocked. It is skipped by other Playwright configs unless explicitly enabled. On a host with system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. A stubbed App Bridge establishes local HTML/initializer behavior only; real Shopify authentication remains unverified.
