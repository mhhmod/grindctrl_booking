# WooCommerce and WordPress parity plan

Goal (owner, 2026-11-04): every capability that works for a Shopify store
works for a WooCommerce store, and for plain WordPress where the capability
does not need a store. No feature may be Shopify-only by accident.

This plan comes from a full audit of the Shopify-coupled code on `main` at
`ec46589`. Paths are relative to `apps/web-next` unless they start with a
top-level folder.

## Decisions

- **Billing:** manual for WooCommerce merchants for now. Connecting a store
  grants the free plan; paid plans are activated by the platform operator
  after payment, as for the custom Shopify app (`plan-actions.ts`,
  `platform-operator.ts`). Self-serve checkout is a later, separate decision.
- **Tenant key:** keep `tryon_shops` as the single try-on tenant registry.
  Add `platform` (`shopify` | `woocommerce` | `wordpress`) and
  `widget_site_id`. A WooCommerce or WordPress tenant uses the reserved key
  `site:<widget_site uuid>`; Shopify keeps `*.myshopify.com`. The two
  namespaces are disjoint.
- **Do not widen `normalizeShopDomain`.** It is the SSRF boundary for Admin
  API calls (`lib/shopify/admin.ts`). Add `normalizeTenantKey` for the
  try-on, credit and launch paths, and `isActiveTenant(key)` in place of
  `isActiveShopifyInstallation` where the caller only needs "is this store
  active".
- **Store authentication:** the plugin pairs with GRINDCTRL using a one-time
  code issued in the dashboard (same pattern as `tryon_shop_links`). Pairing
  returns the site id and a per-site secret. The secret is derived on the
  server, never stored in plain text: `HMAC(core, 'woo-site:' + siteId +
  ':v' + version)`; rotation bumps the version. Server-to-plugin and
  plugin-to-server calls are HMAC-signed with a timestamp and a nonce
  (replay window of 5 minutes, nonce cache in Redis).
- **The secret never reaches a browser.** Anything a shopper's browser needs
  is minted at click time by a plugin REST route with `Cache-Control:
  no-store`, never printed into the page (page caches would freeze it).
- **Order lookup:** GRINDCTRL calls a signed plugin endpoint
  (`/wp-json/grindctrl/v1/order-lookup`), which uses `wc_get_order` and the
  billing-email match. We do not store WooCommerce REST API keys.
- **Free plan abuse:** the free subscription is created only after a verified
  domain exists, at most one per apex domain.
- **Distribution:** the plugin ships from grindctrl.cloud. No WordPress.org
  or WooCommerce Marketplace listing may be claimed until one is approved.

## Parity table

| Capability | Shopify today | WooCommerce / WordPress plan | Phase |
|---|---|---|---|
| Store Chat loader, product context, cart | Theme block | Done (plugin, Store API) | done |
| Domain verification | Admin API sync | Done (DNS TXT) | done |
| Hand-off, rules, alerts, analytics, retention | Platform-neutral | Done | done |
| Tenant registry and credits | `tryon_shops` by shop domain | `site:<uuid>` tenant rows | 1 |
| Store connection | OAuth / session token | One-time-code pairing, per-site secret, signed calls | 1 |
| Install lifecycle | `app/uninstalled` webhook | Plugin deactivate/uninstall ping, daily heartbeat, clone (home URL) detection | 1 |
| Verified shopper identity | App Proxy customer id | Plugin-minted short-lived token for logged-in WordPress users | 2 |
| Order lookup in chat | Admin GraphQL | `OrderProvider` interface; Woo provider calls the signed plugin endpoint | 2 |
| Inbox customer link | admin.shopify.com | wp-admin order/customer edit URL | 2 |
| Try-On session and generation | App Proxy HMAC context | Woo trust domain; plugin mints the storefront context | 3 |
| Garment images | Shopify CDN allowlist | Site's verified domains plus listed CDNs, resolve-then-pin DNS check, private ranges refused | 3 |
| Try-On settings and config | `?shop=` | Public CORS config by site | 3 |
| Try-On product button | Theme app block | WooCommerce hook, Gutenberg block, shortcode; shared `tryon.js` behind adapters; Store API cart add | 4 |
| Catalog try-on | Collection block | `li.product` / block cards, or a plugin card manifest | 4 |
| Dashboard Try-On, Plan, Today | Gated on `shopDomain` | Tenant-aware `ActiveStore` | 5 |
| Launch, preview, holdout | Shop-keyed | Tenant-keyed | 5 |
| Billing | Shopify App Pricing / manual | Manual operator plans for site tenants | 5 |
| Privacy requests | Mandatory webhooks | WordPress exporter/eraser hooks calling signed `/api/woo/privacy/*`; site erase on disconnect | 6 |
| Catalog knowledge for the AI | Not built on either | Build once behind a provider interface | later |

## Build order

1. Tenant foundation, pairing and signing, lifecycle (phase 1). Everything
   else depends on it. Land it before new `shop_domain`-keyed tables.
2. Store Chat identity and order lookup (phase 2).
3. Try-On server side (phase 3), then the plugin side (phase 4).
4. Dashboard, launch and manual billing for site tenants (phase 5).
5. Privacy exporter and eraser (phase 6).

Each phase ships behind honest labels: the product-truth register says what
WooCommerce supports, and only verified capabilities are called live.

## Risks to keep in front of every phase

- An `Origin` header or the public embed key proves nothing to a non-browser
  client; only the per-site secret held in PHP does.
- The secret lives in `wp_options`, which backups and staging clones copy:
  bind tokens to the site's verified domains and offer rotation.
- Merchant-controlled garment URLs are an SSRF surface: resolve the host,
  refuse private and link-local ranges, pin the address, no redirects.
- The Shopify privacy SQL must never touch site tenants; site tenants get
  their own scoped functions.
- WordPress plugins do not auto-update: every call carries the plugin
  version, and the server enforces a minimum.
