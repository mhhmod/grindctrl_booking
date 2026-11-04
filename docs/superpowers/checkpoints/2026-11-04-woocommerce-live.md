# WooCommerce Store Chat: live verification against production (2026-11-04)

Evidence for marking WooCommerce **implemented** (Store Chat only) in
`apps/web-next/lib/product-truth/public-integrations.ts`.

## Setup

- Production at `9197513` (PR #82, Store Chat on WooCommerce merged and deployed).
- Test store `https://woo-m1-dev.grindctrl.cloud` on the GRINDCTRL VPS
  (`/root/woo-m1-test`, official `wordpress` and `mariadb` images behind
  Traefik, `noindex`): WordPress 7.1.4, WooCommerce 11.2.1, three simple
  products in USD.
- Plugin installed from the exact file production serves at
  `/downloads/grindctrl-store-chat.zip` (5253 bytes), activated, embed key of
  test Store Chat site `5cd16e50-415f-45da-bd54-85935babd2a5` pasted in
  Settings → GRINDCTRL Store Chat.
- Shopper side driven by Chrome (Playwright, headless) on the live store.

## Results

| Check | Result |
|---|---|
| Plugin download | `GET /downloads/grindctrl-store-chat.zip` 200; installs and activates in WordPress |
| Loader on the store | product page carries `widget/v1/messenger.js`, the `data-key` and `window.grindctrlWoo` |
| Domain verification | real TXT `_grindctrl-verification.woo-m1-dev.grindctrl.cloud` published through the Hostinger DNS API; the shipped `verifyDomainTxt` returned true for it and false for a wrong token; the domain row now records `dns_txt` (it was `manual_test_simulated`) |
| Production API | `config`, `event`, `bootstrap`, `sync`, `send` all 200 from the store's origin |
| Product context | panel shows "You're viewing Linen Overshirt $48" |
| AI reply | production answered a product question. The site has no knowledge entries, so it said it did not have the details and offered a person instead of inventing them (answers come only from store knowledge, as on Shopify) |
| Hand-off | "Talk to a person" created conversation `bbb60a24…` with status `handoff_requested`, reason `shopper_requested_human` |
| Cart | with `n25_handoff_rules` on for the test site only, Add to cart on the store reached the conversation: `POST /api/messenger/cart` 204, conversation `375e8c03…` metadata cart `USD`, `totalMinor` 4800, 1 item "Linen Overshirt" |

## Limits that stay true

- Store Chat only. Try-On, order lookup and billing remain Shopify-only.
- The AI answers from the store's knowledge entries; it has no WooCommerce
  catalog sync.
- Cart forwarding needs the `n25_handoff_rules` store flag, as on Shopify.
- The plugin is distributed from grindctrl.cloud, not WordPress.org or the
  WooCommerce Marketplace. No marketplace listing may be claimed.
- `grindctrl.cloud` hosts are refused by the domain form by design; the test
  domain row was updated directly after the real DNS check passed.
- "Your own website" uses the same loader and DNS verification but was not
  separately tested without the plugin, so it stays in testing.

## Test data left in production

- Store Chat site `5cd16e50…` (test), its verified domain row, the
  `n25_handoff_rules` flag row for that site, and three test conversations.
- DNS TXT record `_grindctrl-verification.woo-m1-dev` on grindctrl.cloud.
- The VPS test store (`docker compose -p woo-m1-test down -v` removes it).
