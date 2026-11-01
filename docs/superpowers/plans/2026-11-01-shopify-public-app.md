# Public GRINDCTRL app: shortest safe execution plan (2026-11-01)

Status: plan only. Nothing here has been created, published, deployed or paid for.

## Target end state

| App | Distribution | Host | Role |
|---|---|---|---|
| GRINDCTRL (`fc095…`, `grindctrl-31`) | Custom (verified by owner) | `grindctrl.cloud` | Unchanged. Keeps serving its existing stores. Never listed. |
| GRINDCTRL TEST A (`46ea…`) | Development | `shopify-m1-dev.grindctrl.cloud` | Permanent Preview app. Dev stores only. |
| New public GRINDCTRL app (not created) | Public | `grindctrl.cloud` | The App Store app for independent merchants. |
| GRINDCTRL TEST B (`e91e…`) | Development | none (placeholder URLs) | Only for the second-store isolation test, then retire. |

Shopify does not allow a distribution change after it is chosen, so the public
app must be a new registration ([docs](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method)).

## What the code already supports (PR #75)

- Several apps on one host: `SHOPIFY_APPS` entries carry `distribution`
  and `tokenMode`; OAuth, session tokens, webhooks and the proxy verify
  against the right app's secret.
- One installation row per app and store, encrypted credentials, expiring
  offline tokens with refresh (required for new public apps since
  2026-04-01, [changelog](https://shopify.dev/changelog/expiring-offline-access-tokens-required-for-public-apps-april-1-2026)).
  The custom app is exempt and may stay non-expiring.
- Per-app storefront origin via the `app_origin` app-data metafield, and
  a per-block proxy path for stores that run two apps at once.
- All three mandatory privacy webhooks are registered and recorded.
- `read_products` is used (product resolver, try-on insights);
  `app/scopes_update` is recorded per installation.

Production still runs `main`, which has none of the above.

## Phases and gates

Each **Gate** is an action only the owner can authorize. Work between gates
is code or documents and runs without further approval.

### Phase 1. Finish and prove PR #75 on Preview (no owner action except tests)
1. Remaining acceptance runs on TEST A: real uninstall and reinstall on
   store A, App Proxy shopper identity, store B isolation with TEST B.
2. Fixes from those runs land on PR #75 and staging.
3. **Gate 1:** owner approves PR #75 for production.

### Phase 2. Ship PR #75 to production with the custom app only
1. Confirm the M1 tables and functions already present in the shared
   database match the reviewed SQL (read-only check).
2. **Gate 2:** owner authorizes the production deploy of PR #75.
3. Merge to `main`; CI deploys. The custom app keeps working through the
   `SHOPIFY_API_KEY` fallback, with no Shopify configuration change.
4. Verify the 2 existing custom-app stores still load the admin, Try-On
   and Store Chat (read-only checks; their owners are not contacted).

### Phase 3. Legal, privacy and data access (owner-heavy, can run in parallel with 1-2)
1. **Gate 3:** owner approves the privacy policy and terms
   (`docs/legal/*-draft.md`). Then publish them at `/privacy` and `/terms`.
2. **Gate 4 (privacy operating model, P0):** owner names the privacy
   operator, the alert mailbox, retention periods per data type, and
   approves the fulfilment procedure. Then build the operator path that
   completes `customers/data_request`, `customers/redact` and `shop/redact`
   within Shopify's 30-day limit, with evidence.
3. Protected customer data: Store Chat order lookup reads order email and
   shipping location (Level 2). **Gate 5:** owner submits the data
   protection request in the Partner Dashboard (account action).

### Phase 4. Create the public app (owner creates it, code follows)
1. **Gate 6:** owner creates the public app in the Dev/Partner Dashboard,
   chooses Public distribution, and accepts any terms or fees shown there.
   Owner adds the client secret to production env through the server, not
   chat.
2. Add `shopify.app.grindctrl-public.toml` (client id only, no secret):
   `grindctrl.cloud` URLs, entry `/shopify/app/<client id>`, scopes
   `read_products,read_orders,write_app_proxy`, proxy `/apps/grindctrl`
   (the custom app's stores are the only overlap risk; they set a distinct
   block path if they ever install both), webhooks on API `2026-07`.
3. Add the production `SHOPIFY_APPS` entry with
   `distribution: "public"`, `tokenMode: "expiring"`.
4. **Gate 7:** owner authorizes `shopify app deploy` for the new app only
   (theme extension release plus config). The custom app's config file is
   never selected.
5. Install on a development store, rerun the Phase 1 checks against
   production, including uninstall/reinstall and a privacy webhook replay.

### Phase 5. Billing and listing
1. **Gate 8 (pricing):** owner picks the launch pricing. Shortest safe
   path: a Free plan with the current limited entitlements, configured as
   Shopify App Pricing at submission (no billing code). Paid plans need
   Shopify App Pricing or the Billing API plus entitlement sync, as a
   separate follow-up ([billing](https://shopify.dev/docs/apps/launch/billing)).
2. Listing package (drafted by the team, approved by owner): name,
   subtitle, 1200x1200 icon, screenshots EN/AR, setup screencast, support
   and emergency contacts, reviewer test store and credentials.
3. **Gate 9:** owner submits for review. Reviewer feedback becomes PR work.
4. **Gate 10:** owner publishes after approval.

### Phase 6. Final Preview/Production isolation
- Preview: TEST A on `shopify-m1-dev.grindctrl.cloud`, dev stores only,
  mock Try-On, no AI keys outside time-boxed smoke windows.
- Production: custom app and public app on `grindctrl.cloud`, isolated per
  installation in the database.
- Known shared surface: staging still uses the production database (owner
  choice 2026-10-31, bounded test rows). **Optional Gate 11:** a separate
  Supabase project for Preview, which may cost money.

## Not in scope
- Migrating the 2 custom-app stores to the public app (later, opt-in).
- Paid plans, Built for Shopify, Salla/Zid.
