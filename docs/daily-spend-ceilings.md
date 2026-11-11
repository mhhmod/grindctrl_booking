# Daily spend ceilings review

Changes are local and uncommitted. No live database was read or changed. The pre-existing docs/store-health-alerts.md is untouched.

| Item | Implementation |
| --- | --- |
| 1. Merchant Try-On ceilings | apps/web-next/lib/try-on/daily-budget.ts:11 and lib/spend/daily-counter.ts:10 reuse the atomic Store Chat counter contract: site + global in one Redis script, UTC keys, two-day TTL, no retry, fail closed. Defaults: 300 looks/store/day and 5000 merchant looks/day globally; zero stops work. Environment is read per call. |
| 2. Operator overrides | app/dashboard/settings/spend-actions.ts:11 requires the platform operator, validates the key/value and existing store, and uses the service-only set_store_spend_limit RPC. settings_json.spend_limits is stored on widget_sites or tryon_shops. Shopify Chat resolves its installed shop override; other Chat installs, including a pasted install after app uninstall, resolve the site. Values are optional integers 0..100000; clearing means inherit the environment. |
| 3. Operator controls | components/dashboard/store-flags-card.tsx:131 embeds components/dashboard/store-daily-limits.tsx:40. Mantine NumberInput + Save per row, usage, reset, inherited default and save states. lib/dashboard/store-flags-copy.ts:3 carries the requested English/Arabic strings; the card previously had inline English only. |
| 4. Platform emails | app/api/internal/spend/alerts/route.ts:16 and .github/workflows/spend-alerts.yml run every 15 minutes. Timing-safe bearer authentication, one workflow retry for connect timeouts, global 80/100 thresholds, one store alert per canonical store/day, SET NX with two-day TTL, top three stores from bulk-read counters. lib/email/spend.ts:6 produces English HTML and plain text in the existing cream/charcoal email system. |
| 5. Store check | lib/dashboard/your-store-data.ts:133 reads the day counter. your-store-model.ts:291 uses the existing attention/warning row and the exact EN/AR reset copy in your-store-copy.ts. This does not change the merchant's saved button switch. |

Paths above are relative to apps/web-next unless they already start with apps/ or .github/.

## Every generation path

All signed merchant paths call app/api/try-on/generate/route.ts:439, then the same service. The atomic claim is in lib/try-on/service.ts:271: after credit/test reservation and the replay return, before runImageGeneration at line 291. A refusal stores a failed job with known-zero provider cost, calls the existing finalizer/refund at line 281, then raises TryOnUnavailableError. The existing HTTP and widget handling use TRYON_UNAVAILABLE and localized unavailable controls; no shopper copy was added.

| Path | Canonical billing tenant | Reservation before the shared claim |
| --- | --- | --- |
| Shopify app proxy | Signed myshopify domain | beginTryOnJob for paid/free subscription looks; beginTestTryOnJob for signed test looks |
| WooCommerce | site:<uuid> from the verified connection | Same billed/test reservation |
| Pasted Shopify | site:<uuid> from the verified pasted install | Same billed/test reservation; existing shopper cap remains before reservation |
| Pasted website | site:<uuid> from the verified pasted install | Same billed/test reservation; existing shopper cap remains before reservation |
| Optional legacy bridge | Shopless; no merchant credit authority | One shared legacy daily bucket uses the site environment limit and the same global Try-On ceiling before provider work. No store row or override is invented. |
| Public demo | Existing public-demo allowance | Existing per-network/global demo limits are unchanged; its global counter is included in platform alerts. |

Shopify, Woo and paste availability checks read the counters even after cached configuration. Preview/test look exceptions cannot bypass a daily pause. Woo HTTP config uses no-store to avoid browser/CDN stale availability. UTC keys resume the feature on the next day.

## Migration and rollback

Manually review and apply supabase/20261111_daily_spend_limits.sql before the application change. It adds settings_json to the existing tryon_shops row; no extra store table is needed. The setter locks the store, patches one limit, and inserts messenger_audit with the server-derived operator id in one transaction. It is security invoker and service-role-only. Existing RLS remains in force. Triggers preserve spend_limits during ordinary settings writes, including old merchant publish/revert snapshots.

The migration has no delete/drop/truncate statements. PGlite applies it twice and checks privileges, bounds, unknown stores, preservation and rollback when audit recording fails. No migration has been applied to a live database.

Rollback: disable spend-alerts.yml and revert the application change; retain the additive column, trigger/functions, settings and audit history. With the new code present, clearing an override through the guarded action restores environment inheritance. No destructive rollback SQL is provided.

## Configuration names

New application/workflow configuration:

- TRYON_SITE_DAILY_LOOKS
- TRYON_GLOBAL_DAILY_LOOKS
- SPEND_ALERTS_SECRET
- SPEND_ALERTS_URL
- PLATFORM_ALERT_EMAIL

Existing dependencies and budgets to retain:

- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- MESSENGER_AI_SITE_DAILY_TURNS
- MESSENGER_AI_GLOBAL_DAILY_TURNS
- TRYON_DEMO_DAILY_BUDGET
- TRYON_PLATFORM_OPERATOR_CLERK_IDS
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- TRYON_EMAIL_SMTP_HOST
- TRYON_EMAIL_SMTP_PORT
- TRYON_EMAIL_SMTP_USER
- TRYON_EMAIL_SMTP_APP_PASSWORD
- STORE_CHAT_EMAIL_FROM_NAME

SPEND_ALERTS_SECRET belongs in the server and workflow secrets. SPEND_ALERTS_URL is the workflow endpoint. If PLATFORM_ALERT_EMAIL is unset, sending is skipped and logged once per process. Redis/settings failures refuse provider work. SMTP claims are retained even on uncertain failure to prevent duplicate email attempts in the same UTC day.

## Verification boundaries

Chrome checked the actual server-rendered components at 320/343/375/390/768/1440px, EN/AR, light/dark: 24 combinations, no horizontal overflow or clipped inputs, and Save targets at least 44px. Action interactions and localized save states are covered by component tests. This is an isolated component fixture, not an authenticated Clerk dashboard session.

Real Redis atomicity/connectivity, a real inbox, live PostgREST/RLS, authenticated merchant/storefront flows, a Next production build and the deployed schedule have not been verified. Counters are look/reply claims, not measured currency spend; provider failures remain counted.

Verification: 4163 passing tests across 330 files, using the requested Vitest configuration and two workers in fresh batches of 25; the final plain-Chat settings branch was rechecked separately. No loader retries or parallel-only assertion timeouts occurred in the successful batches. Earlier monolithic runs hit invalid shared dependency package manifests and worker exits; these are not reported as clean full-command passes. The per-batch logs and aggregate are in apps/web-next/test-results/spend-batched-result.json and spend-verification-summary.json. Final checks passed: npx tsc --noEmit -p ., ESLint on all 53 changed TS/TSX files, and git diff --check.
