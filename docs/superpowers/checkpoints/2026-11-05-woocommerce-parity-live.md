# WooCommerce parity: live verification against production (2026-11-05)

Evidence for marking WooCommerce Try-On and order lookup **implemented**,
following `2026-11-04-woocommerce-live.md` (Store Chat). Production at
`d9aa8f8` (PR #86, parity phases 2 to 6). Test store
`https://woo-m1-dev.grindctrl.cloud` (WordPress 7.1.4, WooCommerce 11.2.1),
plugin 0.3.0 installed from production's `/downloads/grindctrl-store-chat.zip`,
paired with a one-time code (phase 1, PR #85). Shopper side driven by Chrome.

## Try-On

| Check | Result |
|---|---|
| Button | "Try it on with AI" renders on a product with an image (products without an image are correctly not eligible) |
| Signed context | plugin `POST /wp-json/grindctrl/v1/tryon-context` 200, which signs and forwards to `/api/woo/tryon-context` |
| Embed | `grindctrl.cloud/embed/try-on` opens with the product title |
| Pipeline | `/api/try-on/session` 200, `attempt` 200, `generate` 200 |
| Result | a generated look of the Linen Overshirt on an AI-generated sample shopper photo |
| Add to cart | `POST /wp-json/wc/store/v1/cart/add-item` 201; the store cart then holds Linen Overshirt |
| Free plan | `claim_site_free_plan` granted the site tenant one active subscription, apex recorded; a repeat claim is harmless |

## Order lookup in Store Chat

| Check | Result |
|---|---|
| Guest lookup | email `shopper-test@example.com` + order 14 returned "Found it. It hasn't shipped yet." with status Preparing and Linen Overshirt × 1, fetched by a signed server-to-plugin call |
| Wrong email | the same order number with another email answers "I couldn't find an order matching those details" (no data) |
| Switch | order lookup follows the merchant's Set up switch, off by default, as on Shopify |

## Operational finding

Adding the DNS TXT verification record under a host that only resolved
through the zone's `*` wildcard made that host stop resolving (it became an
existing DNS name, which wildcards do not cover). An explicit A record fixed
it. Merchant domains normally have explicit records; the domain guide should
tell anyone on wildcard DNS to add an A or CNAME for the store host.

## Still not verified live

- Privacy exporter, eraser and uninstall redaction: code is live, the
  migration `supabase/20261105_woo_privacy.sql` awaits approval; until it is
  applied the routes answer 503 and the retention job logs a skip.
- Logged-in shopper identity (customer-mode order lookup): unit-tested only.
- The merchant dashboard screens for a WooCommerce tenant: unit-tested; a
  signed-in browser check needs the owner.

## Your own website (2026-11-05)

Verified live against production, with no WordPress plugin running: a plain
static HTML page whose only GRINDCTRL code is
`<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="...">`,
served from a DNS-verified domain.

| Check | Result |
|---|---|
| Loader | the chat launcher renders from the script tag alone |
| Calls | `config`, `event`, `bootstrap`, `sync` and `send` all answered 200 |
| Handoff | "Talk to a person" created a conversation in `handoff_requested` |
| Scope | Store Chat only. No Try-On, no order lookup, no native product sync (those need the WooCommerce plugin or the Shopify app) |

Product truth: `custom-website` is `implemented` for Store Chat only, by script
tag on a DNS-verified domain. Salla and Zid stay planned.
