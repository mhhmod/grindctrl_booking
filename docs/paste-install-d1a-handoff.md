# Paste install D1a: server contract

Implemented on `feat/paste-path`. No visible markup, copy, styles, loader,
iframe component, dependency, environment file or Shopify app was changed.
No build, commit, push, deployment, SQL execution or external API call was
performed. Network behavior in the new tests is mocked.

## 1. Trusted domains

`apps/web-next/lib/paste/store.ts:7` normalizes URLs, paths, trailing dots,
case and IDNs using the existing domain normalizer, and treats `www` as an
alias of the normalized host. Arbitrary subdomains are separate domains.
HTTP can be typed, but storefront trust is HTTPS on the default port.

The atomic `paste_domain_operation` RPC in the migration checks existing
`widget_sites.domain`, verified legacy domain patterns and paste trust.
There is one active paste holder per normalized hostname, including within
one workspace; a second site gets `claimed` and proof instructions rather
than a second trust grant. The cap is five distinct active domains per site,
including legacy domain rows. Displaced holders are `disputed`.

Proof can use the existing `_grindctrl-verification.<host>` TXT record or
`<meta name="grindctrl-verification" content="TOKEN">` in the exact HTTPS
root page's head. Meta verification resolves and pins a public address,
refuses redirects, requires HTML and accepts at most 256 KiB of proof HTML.
Its transport has the existing 8 MiB download cap and timeout. Proof tokens
are checked again under the database lock before transfer. A transfer moves
hostname authority only, never another workspace's data or credits.

Origin checks honor exact-host dispute/removal tombstones before legacy
own-domain or wildcard allowances. Private trigger guards prevent legacy
writers from bypassing paste claims through verified domain rows or
`widget_sites.domain`; they run outside the exposed `public` schema.

`app/api/messenger/config/route.ts:75` records an admitted browser Origin on
an active site. `app/api/messenger/event/route.ts:124` records an admitted
`loader_initialized` heartbeat. Query-only origin claims and failure
telemetry do not record a signal. Context minting also records an authorized
signal after signature/launch/garment checks. The database records
`first_seen_at` and `last_seen_at` only on the matching trusted domain.

A Shopify connection's signed shop (`paste_site_connections.shop_domain`)
is never a `widget_domains` row, because `.myshopify.com` cannot be added
as an address. It is trusted through the connection instead: origin checks
(`loadPublicSite` sets `pasteShopDomain`), `pasteTrustedHosts` (paste
context, generation recheck, garment hosts) and signals all accept it like
a trusted domain, with its first/last seen times on the connection row. For
the once-per-apex free plan a shop is its own apex (`registrableDomain` in
`lib/woo/free-plan.ts`), never `myshopify.com`.

Typing a shop name proves nothing, and neither does a signed render alone:
any site owner can sign a render naming any shop with their own secret.
Enabling Shopify paste creates the connection as `pending`; any number of
sites may be pending for one shop. Proof takes two factors:

1. Storefront (`lib/paste/storefront-scan.ts`): our server fetches
   `https://<shop>.myshopify.com/` and must find this site's rendered
   snippet tag (`data-gc-site` = this site, `data-gc-shop` = this shop, MAC
   valid under this site's current or overlapping Liquid secret) outside
   comments and raw-text elements. HTTPS on 443 only, no credentials, every
   resolved address public and the socket pinned to it, 5 s per request,
   12 s per check, 2 MiB decoded body, at most 4 redirects, only between
   the myshopify host and the one primary domain that host redirects to
   (plus its `www` twin).
2. Render: a render verified by `/api/try-on/paste-context` for this
   pending site within the last day (`record_paste_shop_render`).

`prove_paste_shop` refuses without a recent render (`render_required`) and
`provePasteShop` requires the scan's `StorefrontEvidence`. Then the site
becomes the shop's one `active` holder (`shop_proven_at`), and every other
pending/active claim on the shop is `disconnected` with
`disconnected_reason = 'displaced'` (re-enabling starts its proof over).
A verified render triggers the check (`lib/paste/shop-proof.ts`); so does
the owner's `provePasteShopAction`. Checks are leased per site for 30 s
(`begin_paste_shop_check`), limited to 10 per site and 30 per shop per 10
minutes, and a failed result is reused for 120 s (render) or 30 s (owner;
a storefront password skips the wait). A finding stored as
`awaiting_visit` lets the next render finish the proof within 15 minutes
without fetching again. Password-protected stores answer
`password_required`; a password given to the action is posted once to the
storefront's own `/password` form with its hidden fields and session
cookies, and is never stored, logged or returned. The proving render may
come from the shop host or one of the site's trusted domain rows.
Only `pasteTrust(connection) === 'trusted'` (`lib/paste/store.ts`) admits the
shop host, signals, Try-On capabilities, garment hosts and the tenant. A
Shopify paste store earns its free plan only from a signed render
(`record_paste_install_signal(..., p_signed => true)`), claiming the shop
and the storefront apex it ran on; Origin-only signals return `recorded`.
Domain rows keep their own per-row trust lifecycle.

An active `shopify_installations` row for the shop always wins. It is read
on every `getPasteConnection` and inside every paste RPC, so an app install
after a paste connection takes effect without any webhook: enabling is
refused and the connection reports `shopify_app_installed`.

Typing a domain, enabling an install, generating a snippet or reading status
never grants a subscription. The first authorized signal calls the existing
atomic `claim_site_free_plan` / `ensure_free_tryon_subscription` ledger path.
The new non-cascading `tryon_free_apex_history` preserves the apex claim even
if the old registry entry is removed by site deletion. It is seeded from
current claims; it cannot reconstruct claims deleted before this migration.

## 2. Tenant and billing

`enablePasteInstallAction` explicitly opts an already-owned widget site in.
The tenant is `site:<widget_site UUID>`. The existing non-Shopify tenant
registry model stores it as `platform = 'wordpress'`; its actual install kind
is unambiguously held in `paste_site_connections` and signed capabilities
use `paste-website` or `paste-shopify`. It has no Shopify Admin credentials.
Enabling refuses an existing app/plugin tenant rather than replacing it.

`lib/dashboard/active-store.ts:91`, `active-store-server.ts` and
`lib/shopify/tokens.ts:319` recognize active paste connections. Existing
tenant-aware settings, plans, credits, results, RBAC and N5/N6 actions use
the same site key. Plain Store Chat sites are unchanged until explicit opt-in.
Paid plan activation/top-ups retain the existing operator-only actions and
`runOwnerEntitlementMutation` ledger entry point. No payment writer was added.

## 3. Liquid signing and rotation

`lib/paste/signing.ts:36` signs these exact ASCII bytes, without whitespace
or trailing newline:

```text
gc-paste-v1|SITE_UUID|SHOP.myshopify.com|PRODUCT_ID|VARIANT_ID|UNIX_SECONDS|CUSTOMER_ID
```

The last field is empty for an anonymous shopper, so the message ends in `|`.
Protocol version `v1` is independent of secret rotation. Product, variant and
customer IDs are decimal strings; the optional customer ID is not promoted
to verified shopper identity. The MAC is lowercase hex HMAC-SHA256.

Like Woo, no plaintext per-site secret is persisted. Liquid's key is
`base64url(HMAC-SHA256(core, 'paste:liquid:SITE_UUID:vVERSION'))`. The core is
`GRINDCTRL_CAPABILITY_SECRET`. Storefront capabilities use the separately
derived `paste:capability:SITE_UUID:v1` key. A disclosed Liquid key cannot mint
session/attempt capabilities or Woo requests.

Renders may be up to 900 seconds old or 30 seconds ahead, accommodating a
bounded Liquid cache while refusing older cached pages with `stale_signature`.
Rotation retains only the immediately previous key for 15 minutes. Repeated
rotation retires anything older. Capability/session TTLs remain 2/10 minutes.

Redis NX/EX claims the canonical render plus network/visitor identity for
931 seconds, after valid MAC verification. A repeated render for the same
network/visitor is `replayed`, including across rotation. Other visitors can
use the cached render. Visitor IDs are browser-supplied; independent strict
network, visitor/site and site-wide limits bound ID rotation. Missing Redis,
timeout-success and malformed limiter results deny work.

## 4. Context and generation

`POST /api/try-on/paste-context` accepts `PasteContextRequest` and returns
`PasteContextResult` from `lib/paste/types.ts`. It accepts no body tenant,
shop or top-level site ID. The public embed key selects the stored site;
the connection selects the platform and the server derives the tenant.

The caller must have an admitted browser Origin or an existing signed origin
token bound to that embed key. The page's origin must match it exactly and
be one of the site's trusted hosts. Shopify paste also verifies all Liquid
claims and the MAC. Paid work still uses the existing entitlement, launch,
preview/holdout, garment resolve/check/pin and credit paths. Capability tokens
are carried in the embed URL fragment. Generation rechecks domain authority.

For paid website looks, `/api/try-on/attempt` adds:

```ts
turnstile: { siteKey: string | null; action: 'paste_tryon'; cData: string }
```

Render Turnstile inside our `/embed/try-on` iframe, using those values.
Pass its result as `turnstileToken` to `/api/try-on/generate`. The server
calls Cloudflare siteverify before reservation/provider work and requires
success, our exact app hostname, action and attempt-bound cData. The attempt
request key is also the siteverify idempotency key, so verification retries
refer to the same look. Tokens cannot move to another generation attempt.
Missing secret returns `turnstile_not_configured` (503). Signed preview test
looks and Shopify/Woo generation are exempt; a caller's `test=true` or mock
photo flag is not an exemption. Free-plan credit looks still require it.

## 5. Exact snippet templates

`lib/paste/snippet.ts:11` returns these templates, replacing `SITE_UUID`,
`EMBED_KEY` and `DERIVED_SECRET` on the server. Only the owner-authorized
snippet action returns Liquid containing the derived signing secret.

Generic:

```html
<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="EMBED_KEY" data-gc-install="paste" data-gc-platform="website"></script>
```

Shopify Footer > Custom Liquid (code version 2, `data-gc-v="2"`; version 1
is the same tag without the attribute and without the cards block):

```liquid
{%- assign gc_key = 'DERIVED_SECRET' -%}
{%- assign gc_issued_at = 'now' | date: '%s' -%}
{%- assign gc_variant = product.selected_or_first_available_variant.id -%}
{%- capture gc_message -%}gc-paste-v1|SITE_UUID|{{ shop.permanent_domain }}|{{ product.id }}|{{ gc_variant }}|{{ gc_issued_at }}|{{ customer.id }}{%- endcapture -%}
{%- assign gc_signature = gc_message | hmac_sha256: gc_key -%}
{%- liquid
  assign gc_cards = nil
  case request.page_type
    when 'collection'
      assign gc_cards = collection.products
    when 'search'
      assign gc_cards = search.results
    when 'index'
      assign gc_cards = collections.all.products
  endcase
-%}
{%- if gc_cards != blank -%}
<script type="application/json" data-gc-cards="SITE_UUID">{"site":"SITE_UUID","shop":{{ shop.permanent_domain | json }},"issuedAt":"{{ gc_issued_at }}","customer":"{{ customer.id }}","products":[
{%- assign gc_count = 0 -%}
{%- for gc_item in gc_cards limit: 50 -%}
{%- if gc_item.object_type != blank and gc_item.object_type != 'product' -%}{%- continue -%}{%- endif -%}
{%- assign gc_card_variant = gc_item.selected_or_first_available_variant.id -%}
{%- if gc_card_variant == blank or gc_item.featured_image == blank -%}{%- continue -%}{%- endif -%}
{%- capture gc_card_message -%}gc-paste-v1|SITE_UUID|{{ shop.permanent_domain }}|{{ gc_item.id }}|{{ gc_card_variant }}|{{ gc_issued_at }}|{{ customer.id }}{%- endcapture -%}
{%- if gc_count > 0 -%},{%- endif -%}
{"id":"{{ gc_item.id }}","variant":"{{ gc_card_variant }}","handle":{{ gc_item.handle | escape | json }},"title":{{ gc_item.title | escape | json }},"image":{{ gc_item.featured_image | image_url: width: 1200 | escape | json }},"signature":"{{ gc_card_message | hmac_sha256: gc_key }}"}
{%- assign gc_count = gc_count | plus: 1 -%}
{%- endfor -%}
]}</script>
{%- endif -%}
<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="EMBED_KEY" data-gc-install="paste" data-gc-platform="shopify" data-gc-v="2" data-gc-site="SITE_UUID" data-gc-shop="{{ shop.permanent_domain | escape }}" data-gc-product="{{ product.id }}" data-gc-variant="{{ gc_variant }}" data-gc-issued-at="{{ gc_issued_at }}" data-gc-customer="{{ customer.id }}" data-gc-signature="{{ gc_signature }}"></script>
```

Each card is signed with the one canonical message above, with that
product's id and its selected-or-first-available variant (sold-out products
included, as in the Shopify app). Free text is `escape`d then `json`-encoded,
so no value can close the script element; the loader decodes the entities.
The secret occurs once, in the `gc_key` assign, and only feeds
`hmac_sha256`. Liquid reaches collection pages (`collection.products`, the
first 50 in the current sort and filter), search results (products only) and
the home page (`collections.all.products`); it cannot see a section's own
collection setting, recommendation sections or product pages' related
products. When the theme filters or sorts in place (the address changes)
and cards appear that the first render did not sign, the loader reads the
listing at its new address, at most three times and once per address; the
address the page loaded with is never fetched again. `lib/paste/snippet.test.ts` renders this template with a small
Liquid interpreter and verifies every card MAC with `liquidMacMatches`.

Card pills are shown by the loader only after
`GET /api/try-on/paste-config?key=&locale=&vid=&preview=` answers
`tryOn: 'live'` and `showCardPill: true` (trusted connection, active tenant,
the site config's launch answer, then the visitor's preview/holdout
audience). It returns only the pill's label and styling.

The result includes structured `PasteStep[]`: open the editor, select
Footer/Custom Liquid, paste, save and visit a product page; or open website
HTML, paste before body-end, save and visit the trusted domain. No localized
UI instructions were added.

## 6. UI action signatures

Import actions from `app/dashboard/store-chat/paste-actions.ts` and result
types from `lib/paste/types.ts` / `lib/paste/status.ts`.

```ts
type R<T> = Promise<PasteResult<T>>;
enablePasteInstallAction(siteId: string, platform: 'website' | 'shopify', shopDomain?: string): R<{ tenantKey: string }>;
addPasteDomainAction(siteId: string, domain: string): R<PasteDomain>;
removePasteDomainAction(siteId: string, domainId: string): R<null>;
provePasteDomainAction(siteId: string, domainId: string): R<PasteDomain>; // TXT
provePasteDomainMetaAction(siteId: string, domainId: string): R<PasteDomain>;
rotatePasteSecretAction(siteId: string): R<{ version: number; overlapUntil: string }>;
getPasteSnippetAction(siteId: string): R<PasteSnippet>;
getPasteInstallStatusAction(siteId: string): R<PasteInstallStatus>;
provePasteShopAction(siteId: string, storefrontPassword?: string): R<PasteShopProof>; // "Check my store"
```

`PasteShopProof` (`lib/paste/types.ts`) is `{ shopProof: 'pending' |
'proven'; shopProvenAt; outcome; checkedAt; retryAfterSeconds }` where
`outcome` is `proven`, `awaiting_visit` (code found, open a product page),
`not_found`, `outdated_code` (this site's code with a retired secret),
`wrong_site` (another site's code), `password_required`,
`password_rejected`, `unreachable` or `rate_limited` (with
`retryAfterSeconds`). While a shop is pending the context route answers
`403 { error: 'shop_proof_pending' }`.

Enable, rotate, snippet, shop proof and status require owner `store` capability; status
contains billing state and is therefore owner-only. Domain changes/proofs
require `settings` capability. Every action resolves Clerk identity and site
access before service-role work and applies strict merchant rate limits.

Status includes domain state and first/last signal times (the shop host's
in `shopFirstSeenAt`/`shopLastSeenAt`), `seen`/`seenHost` (our code ran on
a trusted domain or the shop host within the existing 30-minute window, in
any launch mode: use this for "installed"), `chatLive` (seen, and shoppers
see chat: live or holdout mode), Try-On readiness/reason, complete plan
state, effective preview/live/holdout mode, rotation metadata and whether
Turnstile is configured. `connected` means paste is enabled (a pending shop
included, so its snippet is served); `trusted` means our code is trusted;
`connectionReason` is null or `paste_not_connected`, `shop_proof_pending`,
`shop_proven_elsewhere` or `shopify_app_installed` (also used as
`tryOnReason`); `shopProof` is `pending` ("Waiting for your code on your
store"), `proven` or null, with `shopProvenAt`; `shopCheck` is the last
storefront check `{ outcome, checkedAt, retryAfterSeconds }` or null;
`codeVersion`/`codeVersionSeenAt` are the Shopify snippet version seen in the
latest verified render (sent unsigned by the loader as `codeVersion`, stored
in `paste_site_connections.code_version` by
`supabase/20261108_paste_code_version.sql`; a hint, not an authority), and
`codeOutdated` asks the merchant to copy the new code (false while unknown or
for website code). `PasteSnippet.codeVersion` is the version handed out. It
contains no signing secret. Missing migrations
are typed `schema_not_ready` for new operations where identifiable; legacy
connection lookups/signals degrade to no paste connection/no-op.

## 7. Migration, environment and validation

The complete migration text is `supabase/20261108_paste_install.sql`.
It is additive/idempotent, with the existing status CHECK widened to admit
trusted/disputed states, two new server-only RLS tables, signal columns,
unique trust index, serialized invoker RPCs and private trigger guards.
No SQL was run against a real database. `lib/paste/paste-install-sql.test.ts`
executes the migration twice in PGlite over minimal legacy fixtures and the
real `20261105_woo_dashboard_plans.sql`; concurrency under real load is not
proven.

New configuration names: `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY`,
both read at runtime (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is only a build-time
fallback for the site key). Existing required configuration:
`GRINDCTRL_CAPABILITY_SECRET`, `NEXT_PUBLIC_APP_URL`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
No environment/secret file was read or changed.

All gates ran from `apps/web-next` using Windows `npx.cmd` because this host
blocks PowerShell's `npx.ps1`:

```text
npx.cmd tsc --noEmit
  PASS, exit 0.
npx.cmd eslint <all 36 changed/new TypeScript files>
  PASS, exit 0, no warnings or errors.
npx.cmd vitest run --configLoader runner lib/messenger lib/try-on lib/tenancy lib/dashboard lib/adapters app/api/try-on app/api/messenger app/api/woo lib/woo lib/launch --testTimeout=60000
  166 files: 165 passed, 1 failed. 2,127 tests: 2,126 passed, 1 failed.
  Sole failure: lib/try-on/controlled-provider.test.ts:77,
  expected 'failed' to be 'completed' (the known Windows failure, unchanged).
npx.cmd vitest run --configLoader runner lib/shopify/tokens.test.ts app/dashboard/try-on/plan-actions.site.test.ts app/dashboard/try-on/plan-actions.roles.test.ts --testTimeout=60000
  PASS, 45 tests in 3 files.
git diff --check
  PASS.
```

Tests cover signature validity/tampering/freshness/replay/overlap, key and
tenant isolation, origin mismatch/revocation, Turnstile dummy pass/fail keys
with mocked fetch, missing configuration, DNS/meta proof and collision result
handling, free grant only at signal, apex history/serialization contracts,
action RBAC and denial on Redis failures. SQL lock/constraint behavior still
requires an authorized database execution test later.

## Claude's remaining UI integration

The existing loader currently ignores the new paste data attributes. This
part intentionally does not add a Try-On launcher or a Turnstile renderer.
Claude must consume those attributes, obtain product/image/page context,
call the context endpoint, open its embed URL, render the attempt's Turnstile
inside that iframe and send `turnstileToken` during generation. Carry preview
tokens and the shared visitor ID as the existing platform loaders do.

Existing tenant-aware dashboard controls can edit the site tenant. Existing
Shopify-only setup hints/theme links and Today setup presentation have not
been redesigned for paste; Claude should use this read model and structured
steps when adding the new presentation. No end-to-end paste installation,
browser rendering, live Liquid cache behavior, Cloudflare verification or
database migration is claimed as verified. EasyOrders remains later, as
requested. WooCommerce stays on its plugin.
