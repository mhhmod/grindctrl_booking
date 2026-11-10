# EasyOrders server connector

The only UI is the install return page. Import the dashboard actions from
`app/dashboard/store-chat/easyorders-actions.ts`. All return `EasyOrdersResult<T>`
and require the Clerk user's owner-only `store` capability on the selected site:

- `createEasyOrdersInstallLink(siteId)` returns `{ url }`. Navigate the owner to it.
- `getEasyOrdersStatus(siteId)` returns a safe `EasyOrdersSummary | null`.
- `disconnectEasyOrders(siteId)` returns `null` after remote webhook cleanup.
- `syncEasyOrdersProductsAction(siteId)` returns `{ imported }` (0 when recently synced).

Install is two-step, so a forwarded link cannot bind someone else's store:

1. `POST /api/easyorders/callback` only stages the delivered key (encrypted,
   `pending_confirmation`, 15 minutes). No activation, lookup or import.
2. EasyOrders redirects to `/dashboard/store-chat/easyorders/return?state=…`.
   `inspectEasyOrdersInstall`, `confirmEasyOrdersInstall` and
   `cancelEasyOrdersInstall` return `EasyOrdersInstallResult`
   (`pending_confirmation`, `active { storeId, storeName? }`, `expired`,
   `failed(reason)`). Confirm activates only for the Clerk user who created the
   link, who must still hold the site's `store` capability, while the staging is
   unexpired, and only after one budgeted `products?limit=1` read with the staged
   key succeeds. Unreachable provider: stays pending for a retry. Any other
   signed-in user opening the link discards the staged key.

The confirming call schedules one best-effort initial product import using Next's
`after`; a replayed confirmation does not. It is not a durable job; use the sync action to retry or refresh. Imports
are capped at two pages of 25 products and replace only this connector's imported
knowledge. They enter `messenger_knowledge` with source `product`, so the existing
AI retrieval, reference-data framing and prompt budget apply. This is a bounded
catalog sample, not a promise that the entire store was indexed.

`POST /api/messenger/order-lookup` accepts its existing `orderNumber` and `contact`
fields; `contact` can be an Egyptian phone for EasyOrders, or an email. Both the
form endpoint and model action share the existing conversation/IP/order-number
gates. No EasyOrders account/customer token is treated as verified identity.
The model action accepts `phone` alongside the existing `email` alternative.

Apply `supabase/20261109_easyorders_connector.sql` manually after review. It is
additive and can be run twice. Connection, nonce and key-budget tables are
service-role only with RLS enabled; the invoker RPCs have no browser grants.
Woo derives its own per-site HMAC credential rather than storing external keys;
state follows that purpose-separated HMAC pattern. The external API key reuses
the repo's existing `lib/shopify/token-crypto.ts` envelope, with no new crypto.
The encryption key must remain stable while connections exist.

Required existing environment names:

```
NEXT_PUBLIC_APP_URL
GRINDCTRL_CAPABILITY_SECRET
SHOPIFY_TOKEN_ENC_KEY
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```

`NEXT_PUBLIC_APP_URL` must be the externally reachable HTTPS origin, without a
path. The original origin and exact webhook URLs are retained for disconnect,
even if configuration later changes. Install states expire after ten minutes;
a callback stages once per nonce and activation consumes it. Opening
a newer link supersedes the old link. Disconnect is required before reinstall.

API calls use one `Api-Key` header constant, an eight-second timeout, bounded
decoded bodies, no redirects or automatic retries, an exact shared rolling
40/minute budget keyed by API-key hash, and persisted 429 cooldowns. The budget
survives reconnects. Parsed order caching lasts 15 seconds with a 200-entry cap;
a webhook whose `new_status` differs from `old_status` advances a persisted cache
epoch so all server instances invalidate on their next connection read.
Webhook payloads are neither stored nor logged.

Webhook throttling (fail closed without Redis, 503): well-formed tokens only,
then a per-network admission limit (600/min, shared by all stores because
EasyOrders sends from its own servers) before the token lookup, then 120/min per
authenticated connection. Identical deliveries (hashed site, order id, event,
new status) are acknowledged without a write for 120 seconds; `last_webhook_at`
is written at most once a minute.
Only coarse API health codes are persisted. A 401/403 disables order lookup
until the owner disconnects/reconnects. Failed webhook deletion keeps the key
for an explicit cleanup retry and disables imported knowledge/lookups meanwhile.

Contract assumptions to verify on a real store:

- Permissions use a comma-separated `orders:read,products:read` string.
- EasyOrders preserves our callback and `redirect_url` `state` queries and the
  exact webhook URL query. The two URLs share a random path token and have
  distinct `event` queries.
- A store name is recorded only if the products response carries `store_name`
  or `store.name`; otherwise the return page shows the store id.
- Webhooks from a discarded staging keep arriving until the merchant removes the
  app in EasyOrders; they get 401 because the token never became active.
- Orders are raw objects or `{ data: object }`; product pages are arrays or
  `{ data: array }`. Unknown envelopes fail closed.
- Product fields are `id`, `name`/`title`, `description`, `price`, and optional
  `variations[].name`; cart titles are `name`/`title` or `product.name`.
- DELETE 2xx or 404 means a webhook URL is absent. Both URLs must be removed
  before the API key is erased. Response bodies for successful DELETEs are ignored.
- No documented install callback field supplies the optional webhook secret.
  The schema supports an encrypted known secret; when available, a supplied
  `secret` header must match it. The path token always authenticates delivery.
- Neither courier tracking, currency nor COD is assumed. Unknown statuses are
  neutral; refund-request states never claim a refund already happened.

Real-store verification still needs merchant consent/callback delivery, the
actual payload/envelope/variation shapes and permission encoding, phone/email
proof checks against known orders, both webhook deliveries, API quota/429
behavior across instances, a product answer from imported knowledge, optional
secret provisioning, and deletion/disconnect followed by reinstall.
