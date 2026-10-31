# Platform readiness matrix

Updated 2026-10-31. Research date for third-party platforms: 2026-10-30.
Public product claims come from `apps/web-next/lib/product-truth/public-integrations.ts`;
this file explains the evidence behind each state. Nothing below "implemented"
may be advertised as supported.

States: **implemented** (verified on a real store), **setup-required** (built,
merchant must install or verify, not yet proven live), **evidence-required**
(researched, nothing built), **planned**, **not pursued**.

## GRINDCTRL readiness by platform

| Platform | Store Chat | Try-On | Product context | Cart add from chat | Install / uninstall | Public state | Evidence | Next step |
|---|---|---|---|---|---|---|---|---|
| Shopify | Verified on dev store (staging) | Buttons render; mock render only on staging | Theme app extension + Admin API | Storefront AJAX cart | OAuth, `app/uninstalled`, privacy webhooks (simulated) | implemented | `docs/superpowers/checkpoints/2026-10-31-shopify-m1-staging.md` | Real uninstall/reinstall, store B isolation, privacy fulfilment |
| WooCommerce | Built: plugin + loader adapter, DNS-verified domain | Not built | `window.grindctrlWoo` page context | Store API `/cart`, same origin only | Plugin activate/uninstall; no GRINDCTRL webhooks | setup-required | Branch `feat/woocommerce-store-chat` (`3c99ab5`), unit tests only | Live test on a disposable WordPress site |
| Custom website | Built: script tag + DNS TXT verified domain | Not built | None | None | None | setup-required | Same branch, unit tests only | Live test on a real external domain |
| Salla | Not built | Not built | Twilight SDK documented | `salla.cart.addItem()` documented | `app.installed/uninstalled` documented | evidence-required | Research below | Free Partner demo store, App Snippets spike |
| Zid | Not built | Not built | Themes Library JS documented | Themes Library cart JS documented | Lifecycle events unverified | evidence-required | Research below | After Salla; script injection needs Zid approval |
| BigCommerce, Ecwid | Not built | Not built | Documented | Documented, clean | Documented | not pursued yet | Research below | Third choice if global expansion comes before MENA depth |
| Wix, Magento, PrestaShop | Not built | Not built | Documented with more ceremony | Partly documented | Mixed | not pursued yet | Research below | Only on merchant demand |
| Squarespace, OpenCart, ExpandCart, YouCan | Not built | Not built | Weak or unverified | No supported path or unverified | Unverified | not pursued | Research below | Deprioritized |

## Recommended order

1. **WooCommerce live test.** Already built; proving it live is the cheapest real gain and it reaches the largest global install base.
2. **Salla.** App Snippets inject the loader on install with no theme work, Twilight gives product context and cart add, and a free Partner demo store exists. Best MENA fit.
3. **Zid.** Same architecture as Salla, but script injection needs manual approval and an in-app support channel is mandatory, so it goes after Salla's patterns exist.

Marketplace listing (WordPress.org, Salla, Zid) is a separate decision: each needs its own review, and none may be claimed until approved.

## Technical feasibility (research, 2026-10-30)

"UNVERIFIED" means the official documentation did not settle it.

| Platform | Generic JS embed (merchant-pasted) | Native app/plugin route | Product API + auth | Widget cart add | Install/uninstall webhooks | Privacy hooks | Marketplace requirements | Free test env | Effort: Store Chat | Effort: Try-On (+cart return) |
|---|---|---|---|---|---|---|---|---|---|---|
| WooCommerce | Yes, trivial (theme/plugin) | `wp_enqueue_script` | REST v3, Consumer Key/Secret | Store API `/cart/add-item` (nonce/cart-token) | `product.*`, HMAC-signed | Core exporter/eraser hooks | WP.org: serviceware OK, no trialware; WC Marketplace: biz+code+UX review | Free, self-hosted | **S**: standard WP script enqueue + REST, well-trodden path | **M**: image upload via REST media, Store API cart add is clean |
| Salla | Admin custom-code area | App Snippets (auto-inject on install) | OAuth2, `/admin/v2`, scoped | Twilight SDK `addItem()` | `app.installed/uninstalled` etc. | UNVERIFIED | Partner review + Pricing section, in-platform billing | Free Partner demo store | **S**: App Snippets built for exactly this | **M**: SDK gives cart hook; image handling is custom |
| Zid | UNVERIFIED (likely none) | App Scripts (needs scope + manual team approval) | OAuth2, app token + store `X-MANAGER-TOKEN` | Themes Library JS (add/remove/update) | Order events confirmed; app lifecycle UNVERIFIED | UNVERIFIED | In-app support channel mandatory (Jul 2026+), 1-4 pricing plans | Documented dev-store flow | **M**: manual script approval adds a review cycle | **M-L**: same approval friction plus image/variant handling |
| BigCommerce | Yes, Script Manager (no app) | Scripts API (OAuth, 10/app cap) | OAuth/API accounts, V3 Catalog | REST Storefront Cart API (cookie/CORS, no token) | Full webhook catalog | Platform-level only; apps excluded from BC's own GDPR coverage | Multi-user mandatory, no all-scope apps, PCI review if card data, paid review | 15-day trial (persistent sandbox needs Partner status) | **S**: Scripts API + open Storefront Cart API | **M**: clean APIs, PCI review only if GRINDCTRL touches payment data |
| Adobe Commerce/Magento | Yes, admin "Miscellaneous HTML" (no module) | Module + layout XML | OAuth1.0a (Integrations) or IMS OAuth2 (Cloud) | `/V1/guest-carts/{id}/items` | Webhooks module (observer-based); OS has no native dispatcher | UNVERIFIED | Adobe EQP: automated scan + manual QA + marketing review | Free self-hosted OS; Cloud sandbox UNVERIFIED | **M**: module/layout XML has more ceremony than other platforms | **L**: module dev + OAuth1.0a handshake adds real integration time |
| Wix eCommerce | Yes, Custom Code (Premium plan) | Custom Element / Embedded Script extension | OAuth, `wixapis.com` eCommerce REST | `/ecom/v1/carts/current/add-to-cart` | `App Installed` / `App Instance Removed` | No mandatory webhook; manual SLA ~30 days | Must keep a live demo account; Billing API optional (external billing allowed) | Free Premium dev site | **M**: extension model (Custom Element) is heavier than a raw script tag | **M**: Product Page Site Plugin gives productId/variantId cleanly |
| Squarespace Commerce | Yes, Code Injection (Business/Commerce plan only) | Extensions (invite/application-gated) | REST, Bearer/OAuth (Extensions only) | **No official endpoint**: unsupported internal API | `order.create/update`, `extension.uninstall` | UNVERIFIED | Invite-only; apply via email, no public checklist found | No official free sandbox found | **M**: Code Injection works, but no official app-store route without becoming a vetted Extension partner | **L**: no supported cart-add API; would need DOM-click simulation (fragile) |
| PrestaShop | No native field; needs a tiny module | Hooks (`displayHeader`, `displayProductAdditionalInfo`) | Webservice API, 32-char key, Basic Auth | No turnkey add-item REST action; module-injected JS to theme AJAX controller | None native; GDPR hooks only | `actionDeleteGDPRCustomer` / `actionExportGDPRData` | Addons: automated Validator + manual review | Free self-hosted | **S-M**: hooks are clean but cart add is DIY | **M**: hooks give product context; cart-return path is custom |
| OpenCart | Needs a module (no native field) | Events System (logic) + OCMod (template) | Admin API key, `api/login` → token | No documented storefront JSON endpoint | None native | None found | Manual review; stricter structure for cloud marketplace | Free self-hosted; official demo site | **M**: weaker script-injection story (OCMod) than most | **L**: thin official docs overall, more reverse-engineering risk |
| Ecwid | Yes, native custom-JS/HTML field | Storefront JS API (any script) | OAuth2 REST v3 | `Ecwid.Cart.addProduct()`: official, clean | Full catalog incl. "personal data requests" | Implied by webhook entity; needs confirmation | Validation checklist + readiness form + video demo | Free-tier status UNVERIFIED for 2026 | **S**: OnPageLoaded + addProduct is purpose-built for this | **S-M**: cleanest official cart-add API of the non-Shopify set |
| YouCan (MENA) | UNVERIFIED | Theme App Extensions (Shopify-like) | REST Admin + Storefront API, Partner OAuth | UNVERIFIED specifics | UNVERIFIED specifics | UNVERIFIED | UNVERIFIED | Partner dev stores confirmed | **M** (provisional) | **M** (provisional) |
| ExpandCart (MENA) | UNVERIFIED | No public dev platform found | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | **Unknown**: likely requires direct partner outreach | **Unknown** |

## Sources

Official documentation consulted:

- https://addons.prestashop.com/en/content/37-contributor-guide-technical-validation
- https://api-docs.ecwid.com/reference/add-custom-javascript
- https://dev.wix.com/docs/build-apps/build-your-app/testing/how-to-test-your-app-on-a-free-premium-development-site
- https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/embedded-scripts/customize-wix-stores-using-embedded-scripts
- https://dev.wix.com/docs/build-apps/get-started/tutorials/tutorial-create-a-site-plugin-for-the-wix-stores-product-page
- https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/submit-your-first-app-version
- https://dev.wix.com/docs/rest/app-management/app-billing/billing/introduction
- https://dev.wix.com/docs/rest/app-management/app-instance/instance-app-removed
- https://dev.wix.com/docs/rest/business-solutions/e-commerce/cart/introduction
- https://devdocs.prestashop-project.org/9/modules/concepts/hooks/list-of-hooks/actionbuildfrontendobject/
- https://devdocs.prestashop-project.org/9/modules/concepts/hooks/list-of-hooks/actiondeletegdprcustomer
- https://devdocs.prestashop-project.org/9/modules/concepts/hooks/list-of-hooks/displayproductadditionalinfo
- https://devdocs.prestashop-project.org/9/webservice/tutorials/creating-access/
- https://developer.adobe.com/commerce/extensibility/webhooks/commands
- https://developer.adobe.com/commerce/frontend-core/guide/layouts/
- https://developer.adobe.com/commerce/marketplace/guides/sellers/extension-quality-program
- https://developer.adobe.com/commerce/webapi/rest/
- https://developer.adobe.com/commerce/webapi/rest/tutorials/orders/order-add-items/
- https://developer.bigcommerce.com/docs/integrations/apps/guide/requirements
- https://developer.bigcommerce.com/docs/integrations/apps/unified-billing
- https://developer.bigcommerce.com/docs/integrations/scripts
- https://developer.bigcommerce.com/docs/integrations/webhooks/events
- https://developer.bigcommerce.com/docs/rest-storefront/carts/cart-items
- https://developer.bigcommerce.com/docs/start/authentication/api-accounts
- https://developer.woocommerce.com/docs/apis/rest-api/v3/webhooks/
- https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/cart/
- https://developer.woocommerce.com/docs/woo-marketplace/submitting-your-product/
- https://developer.wordpress.org/plugins/privacy/adding-the-personal-data-eraser-to-your-plugin/
- https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/
- https://developer.wordpress.org/reference/functions/wp_enqueue_script/
- https://developer.youcan.shop/apps/introduction
- https://developers.ecwid.com/external-applications
- https://developers.squarespace.com/commerce-api
- https://developers.squarespace.com/webhooks/overview
- https://developers.wixanswers.com/kb/en/article/data-protection-gdpr
- https://docs.bigcommerce.com/developer/docs/storefront/stencil/utils/reference
- https://docs.ecwid.com/build-apps/webhook-automations/learn-ecwid-webhooks/list-of-webhook-events
- https://docs.ecwid.com/launch-apps/steps-to-go-live-with-a-public-app/guide-to-app-validation
- https://docs.ecwid.com/storefronts/manage-cart-and-checkout/add-product-to-the-cart
- https://docs.ecwid.com/storefronts/track-storefront-events/page-is-loaded-events
- https://docs.opencart.com/en-gb/system/users/api/
- https://docs.salla.dev/1650500m0
- https://docs.salla.dev/421118m0
- https://docs.salla.dev/421410m0
- https://docs.salla.dev/421413m0
- https://docs.salla.dev/421944m0
- https://docs.salla.dev/422610m0
- https://docs.salla.dev/422629m0
- https://docs.salla.dev/422990m0
- https://docs.zid.sa/authorization
- https://docs.zid.sa/webhook-events-order
- https://forum.opencart.com/viewtopic.php?t=209911
- https://help-partner.zid.sa/en/articles/10658329-zid-app-market-app-review-requirements-checklist
- https://help-partner.zid.sa/en/articles/11311085-understanding-the-zid-app-scripts-and-event-layer
- https://support.bigcommerce.com/s/article/General-Data-Protection-Regulation
- https://support.squarespace.com/hc/en-us/articles/205815908-Using-code-injection
- https://support.squarespace.com/hc/en-us/articles/360000975547-Squarespace-Extensions
- https://support.wix.com/en/article/embedding-custom-code-on-your-site
- https://woocommerce.com/document/woocommerce-rest-api/
- https://woocommerce.github.io/code-reference/classes/WC-Frontend-Scripts.html
