# Storefront config proxy

The theme block loads public appearance settings from the storefront's own
origin at `/apps/grindctrl/config`. Shopify proxies that request to this app's
`/proxy/config` route, where `authenticate.public.appProxy(request)` verifies
the signed Shopify request before any shop-specific config is read.

Until the Shopify app's Supabase project is confirmed, the server-side config
repository reads the existing `GRINDCTRL_WEB_URL/api/try-on/config` endpoint.
It validates the response and falls back to the same defaults used by
`apps/web-next` if the upstream is unavailable or malformed. No service-role
key or other secret is exposed to theme JavaScript.

`GRINDCTRL_WEB_URL` is validated when the server module loads. Production
accepts only the exact `https://grindctrl.cloud` origin; local origins are
accepted only outside production. Upstream redirects are rejected.

## Local verification

1. Copy `.env.example` to `.env` and provide the Shopify app credentials.
2. Run `npm run dev` and install the app on a development store.
3. Add the GrindCTRL Try-On app block to a product template.
4. Open `/apps/grindctrl/config` on that storefront and confirm it returns JSON.

This extension version requires the app proxy to remain `/apps/grindctrl`.
Merchants must not customize its prefix or subpath because the extension's
same-origin request path is intentionally fixed.

The button label defaults to dashboard control. A merchant can explicitly
select **Theme override** to preserve the label entered in the theme editor;
dashboard config never overwrites it in that mode. The button is revealed only
after config loading settles, preventing fallback text or styling flashes.

There is no unit-test runner in this generated app. The proxy and extension are
therefore covered by lint, TypeScript, the production build, Shopify app build,
and Theme Check until a test stack is introduced.
