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

Typing a shop name proves nothing. Enabling Shopify paste creates the
connection as `pending`; any number of sites may be pending for one shop.
The first render accepted by `/api/try-on/paste-context` whose Liquid HMAC
verifies with that site's own derived secret calls `prove_paste_shop`: the
site becomes the shop's one `active` holder (`shop_proven_at`), and every
other pending/active claim on the shop is `disconnected` with
`disconnected_reason = 'displaced'` (its owner can re-enable). The proving
render may come from the shop host or one of the site's trusted domain rows.
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

Shopify Footer > Custom Liquid:

```liquid
{%- assign gc_issued_at = 'now' | date: '%s' -%}
{%- assign gc_variant = product.selected_or_first_available_variant.id -%}
{%- capture gc_message -%}gc-paste-v1|SITE_UUID|{{ shop.permanent_domain }}|{{ product.id }}|{{ gc_variant }}|{{ gc_issued_at }}|{{ customer.id }}{%- endcapture -%}
{%- assign gc_signature = gc_message | hmac_sha256: 'DERIVED_SECRET' -%}
<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="EMBED_KEY" data-gc-install="paste" data-gc-platform="shopify" data-gc-site="SITE_UUID" data-gc-shop="{{ shop.permanent_domain | escape }}" data-gc-product="{{ product.id }}" data-gc-variant="{{ gc_variant }}" data-gc-issued-at="{{ gc_issued_at }}" data-gc-customer="{{ customer.id }}" data-gc-signature="{{ gc_signature }}"></script>
```

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
```

Enable, rotate, snippet and status require owner `store` capability; status
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
store"), `proven` or null, with `shopProvenAt`. It contains no signing secret. Missing migrations
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
