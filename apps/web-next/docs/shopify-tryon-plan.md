# Shopify Try-On App Plan

Date: 2026-07-13. Scope locked with owner: virtual try-on on product pages; custom-distribution app installed per client store; merchant config BOTH embedded in Shopify admin AND mirrored in the GrindCTRL dashboard.

## Phase 0: Consolidated discovery (verified facts)

**Try-on today (from codebase audit, high confidence):**
- Public `/try-on` works but is a MOCK: `lib/try-on/service.ts` `TRYON_MODE` defaults `'mock'`; `mock-runner.ts` sleeps 1.5-2.5s and returns static `/try-on/mock-result.png`. `'live'` mode returns failed job "Live provider is not configured yet."
- The photo is NEVER transmitted: `try-on-demo.tsx:85` sends `photoReference: 'uploaded-photo'` literal. No image pipeline exists.
- Jobs live in an in-memory `Map` (`service.ts:14`), lost on restart. No Supabase usage in try-on (Supabase IS used by the chat-widget/leads product).
- Routes `/api/try-on/session|generate|jobs/[jobId]` are public, no rate limiting, no CORS headers, `next.config.ts` has no headers()/CSP/frame-ancestors.
- UI chain: `TryOnPageContent` → `TryOnDemo` → `PhotoUpload`/`TryOnResult`; self-contained EN/AR i18n (`lib/try-on/i18n.ts`). Product hardcoded to `premium-ringer-tee` (`lib/try-on/products.ts`).
- `app/dashboard/try-on/page.tsx` is a hardcoded mock dashboard (fake KPI/jobs, fake embed snippet pointing to a script that doesn't exist).
- Reusable embed PATTERN exists from the chat widget: `lib/adapters/install.ts` (loader snippet builder), `widgetSites.ts` (site keys + allowed domains, Supabase-backed).

**Shopify facts (from shopify.dev):**
- Custom distribution: no App Store review, no Billing API, installable on a single store (or stores in one Plus org). Multiple client stores ⇒ one custom app per store, created in the Partner Dashboard (runbook, scriptable).
- Theme app extension "app block": merchant-placeable on OS 2.0 product pages via theme editor; Liquid entry + CSS/JS assets on Shopify CDN; settings schema editable by merchant in theme editor.
- Storefront→backend calls go through the App Proxy: `https://<shop>/apps/<subpath>` proxies to the app backend; Remix/React-Router template verifies via `authenticate.public.appProxy(request)`; JSON responses pass through. This avoids CORS entirely for storefront calls.
- Embedded admin config UI: App Bridge + Polaris inside Shopify admin (standard template pages).

**Monorepo:** `apps/web-next`, `apps/clerk-mcp`. No Shopify code anywhere yet. Hosting: VPS + Traefik + Docker (see grindctrl-deploy memory) — the Shopify app becomes a third container + subdomain.

## Decisions (locked 2026-07-13)
1. **Image model provider**: OpenAI `gpt-image-2` (owner's choice; launched 2026-04-21, images/edit endpoint). Env: `OPENAI_API_KEY`, optional `TRYON_OPENAI_MODEL` override. Implemented in `lib/try-on/openai-runner.ts`.
2. **Persistence**: DEFERRED — the web-next Supabase project could not be identified safely (three connected MCP projects lack the app's `dashboard_*` RPCs; docs/deployment.md names a fourth, unreachable ref `egvdxshlbcqndrcnzcdn`; the `prsusuwxbzaekynonifl` project times out/paused). Owner must confirm the real `NEXT_PUBLIC_SUPABASE_URL` project before `tryon_jobs` lands. Until then: in-memory jobs, data-URL results (no storage writes).

## Phase 1: Real try-on pipeline (prerequisite for everything)
- Transmit the actual photo: `PhotoUpload` already produces a data URL; send it in `POST /api/try-on/generate` (base64 JSON, 8MB cap already enforced client-side; enforce server-side too).
- `lib/try-on/service.ts` live mode: upload user photo + garment image to provider, poll/await result, store result image in Supabase Storage, job row in `tryon_jobs` (id, shop/site, product, status, result_url, created_at). Keep mock mode for dev/tests.
- Rate limit the public routes (simple per-IP counter in Supabase or upstash-style memory+TTL; ponytail: per-IP fixed window in a small lib).
- Migration: reversible `create table tryon_jobs` + storage bucket. RLS: service-role only (API routes server-side).
- Verify: real photo in → generated composite out on `/try-on`; job persisted; vitest suite green (service unit tests use mock mode).

## Phase 2: Embeddable try-on (iframe endpoint)
- New route `app/embed/try-on/page.tsx`: bare TryOnDemo (no site header/footer), accepts `?product=<handle>&locale=&site=<siteKey>`; loads product config from DB instead of the hardcoded product.
- `next.config.ts` `headers()`: `Content-Security-Policy: frame-ancestors https://*.myshopify.com <client custom domains>` for `/embed/*` only (allowlist from site keys, mirroring chat-widget domain verification).
- postMessage height reporting for responsive iframe.
- Product data model: `tryon_products` (site key → product handle, garment image URL, copy overrides) replacing the single seeded product for embed contexts.
- Verify: iframe of `/embed/try-on` inside a test HTML page on another origin renders and generates.

## Phase 3: Shopify app scaffold (`apps/shopify`)
- `shopify app init` (Remix/React-Router template, TypeScript) in monorepo `apps/shopify`. Custom distribution set in Partner Dashboard.
- App proxy config: `/apps/grindctrl` → app backend; endpoints: `GET /proxy/config` (per-shop config JSON for the block), optional `POST /proxy/generate` passthrough later (Phase 2 iframe hits web-next directly, so proxy starts config-only).
- Theme app extension with one **app block** "GrindCTRL Try-On" targeted at product pages: Liquid renders a button/section; JS mounts the iframe pointing at `https://grindctrl.cloud/embed/try-on?product={{ product.handle }}&site=<shop-site-key>`; merchant-editable schema settings: button label, placement style, locale override.
- App DB (Supabase, same project): `shopify_shops` (shop domain, access token, site key, enabled), `shopify_product_config` (per-product enable/garment image mapping).
- Session storage: template default (Prisma) swapped for Supabase adapter OR keep SQLite file in container volume (ponytail: template default first).
- Verify: `shopify app dev` against a development store; block visible in theme editor; try-on generates from a product page.

## Phase 4: Merchant + owner config UIs
- Embedded admin page (Polaris): toggle app per product (product picker), set garment image per product (defaults to product featured image), preview. Writes `shopify_product_config`.
- GrindCTRL dashboard `app/dashboard/try-on/page.tsx`: replace ALL hardcoded mock content with real data — jobs list from `tryon_jobs`, per-shop config mirror (read/write same tables), working embed snippet/install status. Delete the fake snippet teaser.
- Verify: change config in Shopify admin → reflected in dashboard and vice versa (same rows).

## Phase 5: Hosting + per-client runbook
- Dockerfile for `apps/shopify`; Traefik route `shopify.grindctrl.cloud`; env: Shopify API key/secret per app instance, `SCOPES=read_products`, Supabase URL/service key, disk watch (VPS ~90%).
- Runbook doc: create custom app in Partner Dashboard → set URLs → generate install link → install on client store → create site key → enable block in theme editor.
- Verify: end-to-end on a real development store over the public domain.

## Phase 6: Final verification
- Full vitest, eslint, tsc in both apps; preview matrix for `/embed/try-on` (mobile widths, RTL); anti-pattern greps; deploy; live product-page try-on demo recorded via screenshot.

## Anti-pattern guards
- Do not invent Shopify CLI/API surface: follow the generated template's own auth/proxy helpers (`authenticate.public.appProxy`, `authenticate.admin`).
- Do not ship the public generate endpoint without rate limiting + size validation (real provider = real cost).
- No secrets in the theme extension JS (site key is public; provider tokens live server-side only).
- Reversible migrations only; flag RLS + storage bucket policies before applying (supabase rule).
