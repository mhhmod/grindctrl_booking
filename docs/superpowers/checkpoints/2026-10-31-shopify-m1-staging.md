# Shopify M1 staging checkpoint (2026-10-31)

Branch: `feat/shopify-installation-isolation` (PR #75, Draft). Staging copy:
`https://shopify-m1-dev.grindctrl.cloud`, deployed by pushing `staging/m1`.
Staging shares the production Supabase project by owner decision; test rows
are bounded to `grindctrl-m1-test-a.myshopify.com`.

## Verified on a real Shopify dev store (TEST A app, store A)

| Check | Evidence |
|---|---|
| OAuth install | `shopify_installations` row `active`, encrypted token, scopes `read_orders,read_products,write_app_proxy` |
| Embedded admin + App Bridge | `/shopify/app` loads from staging inside Shopify admin |
| Storefront origin per app | Page source loads `https://shopify-m1-dev.grindctrl.cloud/widget/v1/messenger.js`; try-on blocks carry `data-app-origin` = staging. Production falls back to `https://grindctrl.cloud`. |
| Try-On buttons | Render on product cards (mock mode, 12 test looks/day) |
| Store Chat | Enable in app, bubble renders, panel boots and connects |
| Signed webhooks | Unsigned `401`; signed `app/uninstalled` and 3 privacy topics recorded as `manual_required` (simulated, signed server-side with the TEST A secret) |

## Fixed during this pass

- Theme blocks hardcoded production; origin now comes from an app-data
  metafield written after OAuth and on bootstrap (`98d05bb`).
- Launcher invisible on Dawn (`div:empty { display: none }`); shipped to
  production in PR #76, release `6a4908a`.
- Release audit blocked by new advisories (nodemailer, glob/minimatch via
  Sentry's build plugin); fixed in PR #76.
- Staging lacked `GRINDCTRL_CAPABILITY_SECRET`, so every chat panel was
  refused; staging guard now requires it (`53ae80f` on `staging/m1`).
- A leftover `shopify app dev` preview overrode the released version; clear
  it with `shopify app dev clean --config grindctrl-test-a`.

## Open

- AI replies are unverified on staging by design (no provider key). When AI
  fails the shopper sees "Message not sent" while the header says
  "Assistant answers now"; it should hand off to the team instead.
- First run: enabling the theme embed shows nothing until Store Chat is
  turned on in the app; the app or embed should say so.
- Admin banner copy hardcodes "grindctrl.cloud".
- Real `app/uninstalled` and reinstall, app proxy shopper identity, store B
  isolation: not yet run.
- Privacy fulfilment (P0) and an alert mailbox for staging: owner decisions.
- `staging/m1` guard commit `53ae80f` still needs to reach `ci/m1-staging`.
