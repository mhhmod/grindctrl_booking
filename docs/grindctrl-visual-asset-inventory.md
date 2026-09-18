# GrindCTRL Homepage Visual Asset Inventory

Date: 2026-09-17

## 1. Purpose and method

The homepage rebuild proves every product claim with real visuals: real product screenshots, real try-on images, real UI states, and official integration marks. It never uses placeholders, fake dashboards, fake metrics, or fake logos.

This inventory catalogs every image, video, and SVG asset that could plausibly be used on the homepage, and states plainly which ones are real and which are not.

Method:
- Repo sweep: every image/video/svg under `apps/web-next` (public assets, app icons, inline brand-mark components), the legacy Vite site (`src/`), the Shopify try-on extension (`apps/grindctrl-tryon`), and `docs/` (excluding `node_modules`, `.next`, `dist`, `docs/visual-qa`).
- Git history: assets deleted from the repo in past commits, restored read-only into the scratchpad to inspect what they depicted and why they were removed.
- Local files: GrindCTRL-named images in `C:/Users/HP/Downloads` and the `Desktop` top level.
- Capturable real UI: routes and components that render the actual product (not mockups) and can be screenshotted locally, with or without signing in.
- Direct inspection of the installed `simple-icons` package (`apps/web-next/node_modules/simple-icons`, v16.27.1) and `apps/web-next/components/brand-marks.tsx` / `apps/web-next/lib/product-truth/public-integrations.ts` to confirm which vendor marks exist and how integration depth is currently disclosed.

Rule applied throughout: placeholders, fake dashboards, fake metrics, and fake logos are never used on the public homepage. An asset that fails this rule is marked `not-usable` even if it looks polished.

## 2. Summary by category

| Category | Usable now | Needs anonymization | Outdated | Missing | Verdict |
|---|---|---|---|---|---|
| GrindCTRL logo | 4 | 0 | 2 | 0 | Solid. One consistent real mark (knot glyph) reused everywhere; safe to build on. |
| Product screenshots | 0 | 0 | 0 | Yes | Missing. No real screenshot of the live storefront widget or embedded UI exists anywhere in the repo. |
| Try-on images | 2 | 1 | 0 | Real AI output missing | The demo garment and its disclosed mock result are honest and reusable; the only "real AI try-on result" would have to be generated live, and one marketing composite needs owner clearance before reuse. |
| Customer/store logos | 0 | 0 | 0 | Yes | Missing entirely. No real merchant or customer logos exist in the repo. |
| Integration icons | 18 wired, 6 more available unwired | 0 | 0 | Groq, OpenAI (no vendor mark exists) | Strong. Real, licensed marks from `simple-icons`, already gated by a truthful integration-depth registry. |
| Videos | 0 | 0 | 0 | 5 deleted (all fake) | Nothing to recover. All 5 "operations" clips were AI/stock footage with fabricated or nonsense on-screen UI, already deleted for that reason. |
| Dashboard screenshots | 1 rig (dev-only) | 1 rig (dev-only) | 0 | Real signed-in captures missing | One dev-only page renders real components but needs its inline fake numbers fixed before it can be a marketing screenshot. |
| Inbox screenshots | 1 rig (dev-only) | 0 | 0 | Real signed-in captures missing | `store-chat-check` is the strongest existing rig: real components, clearly-synthetic fixture data. |
| Lead screens | 0 | 0 | 0 | Yes | Missing. The only lead-pipeline images that ever existed were fake mockups, now deleted from history. |
| Operations screens | 0 | 0 | 1 (dead, unreferenced) | Yes | Missing. `hero-operations.jpg` is a fully fabricated dashboard mockup and is already unused; recommend deletion, not reuse. |
| Analytics screens | 0 | 0 | 0 | Yes | Missing. Current `/dashboard/analytics` renders fabricated numbers from a preview-data fixture; not usable as proof. |

"Missing" here means no real, usable asset exists in the repo or in git history for that category; the Gaps section (6) states the honest treatment for each.

## 3. Detailed inventory by category

### GrindCTRL logo

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| `apps/web-next/public/brand/logo.svg` | Infinity-knot glyph, single path, no background (dark-theme variant) | In repo, 20KB | usable-now | Same path geometry as every other logo asset in the repo; real, hand-drawn brand mark, not fabricated. |
| `apps/web-next/public/brand/logo-dark.svg` | Same glyph, light-theme variant | In repo, 20KB | usable-now | Naming is inverted versus usage (a pre-existing quirk in `brand-logo.tsx`, functionally correct today): not a blocker for the homepage, just a note for whoever next touches `BrandLogo`. |
| `apps/web-next/app/icon.svg` | Same glyph on a rounded cream square, 512x512 | In repo, 20KB, Next.js metadata file | usable-now | Serves as the site favicon/app icon. `app/favicon.ico` is not a binary file, it is a redirect route to this SVG; nothing to audit there. |
| `apps/web-next/public/campaigns/grindctrl-logo-white.png` | White knot glyph on black, 180x120px | In repo, 7KB | usable-now | Currently used only in the try-on marketing email template, not on the site; fine to reuse anywhere a raster logo is needed. |
| `src/public/logo-dark.svg` / `src/public/logo-light.svg` | Same glyph geometry, legacy Vite site | In repo, legacy app superseded by `apps/web-next` | outdated | Not relevant to the `web-next` homepage; listed for completeness only. |

### Product screenshots

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| n/a | n/a | n/a | **missing** | No real captured screenshot of GrindCTRL's actual embedded storefront widget, dashboard, or any signed-in product surface exists anywhere in the repo. |
| `apps/web-next/public/campaigns/grindctrl-tryon-proof.png` | A styled marketing composite: knot logo, headline, phone mockup of a generic Shopify-style PDP with a "Try it on with AI" button, 3-step strip | In repo, 1.6MB; used only by the try-on email campaign | not-usable | The phone-screen chrome and PDP shown are not GrindCTRL's actual UI: an AI/stock-styled mockup, not a screenshot. Keep for its existing email role; never present as "real product UI" on the homepage. |

### Try-on images

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| `apps/web-next/public/try-on/premium-ringer-tee.png` (JPEG bytes, `.png` extension) | Flat-lay product photo, cream ringer tee with brown trim | In repo, 1024x1024, 480KB; the single seeded demo garment in `lib/try-on/products.ts` | usable-now | Honestly used: it is the actual garment the live `/try-on` demo tries on. Origin (stock vs. commissioned) is undocumented, but usage is not misleading. |
| `apps/web-next/public/try-on/mock-result.png` (JPEG bytes, `.png` extension) | Studio photo, male model wearing the same tee | In repo, 1024x1024, 496KB; returned by `lib/try-on/mock-runner.ts` only when the demo runs in mock mode | not-usable (as proof) | Static placeholder, not an AI output. It may stay inside the mock-mode demo where the UI discloses it, but it must never appear on the homepage or be presented as a try-on result. Code and UI explicitly disclose this as a demo result (mock-mode badge in `try-on-result.tsx`); keep that disclosure intact anywhere it is reused. Never present as a live AI-generated result. |
| `C:/Users/HP/Downloads/grindctrl-tryon-email-monochrome-v2.png` | Monochrome marketing/email graphic: wordmark, headline, phone-mockup PDP, 3-step before/upload/after strip with two people (model in plain outfit, composited try-on result) | Local file outside the repo | needs-anonymization | Composited marketing creative, not a raw app screenshot. Unclear whether the phone-screen content is a real screenshot or a design mock, and unclear whether the two people are real, consenting individuals or stock/AI composites. Owner must confirm both screenshot authenticity and photo rights before any public reuse. |
| Real AI try-on output | n/a | Would require running the app locally with `TRYON_MODE=live` and a real `OPENROUTER_API_KEY`, then uploading a real, consented photo through `/try-on` | **missing** | Nothing in the repo today is a genuine AI-generated try-on result; every existing "result" image is the static mock. |

### Customer/store logos

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| n/a | n/a | n/a | **missing** | No real merchant, customer, or partner store logos exist anywhere in the repo. |

### Integration icons

See Section 4 for the full, verified list. Summary: 22 real vendor marks are currently wired into `components/brand-marks.tsx` (sourced from `simple-icons`), and the package additionally ships marks for OpenRouter, Clerk, Sentry, PostHog, Upstash, and Hostinger that are not yet imported into that component. Groq and OpenAI have no available mark in `simple-icons` at all.

### Videos

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| `apps/web-next/public/landing/operations/{vision,team,systems,monitoring,review}.mp4` + poster JPEGs | Five clips of an AI-generated/stock corporate video shoot (same 2-3 models, same set, same backlit logo prop); where a screen appears on camera, the "UI" shown has garbled or nonsense labels | Git history only (deleted in commit `2d2688d`, "evidence-gated public claims"); restored read-only to `scratchpad/asset-sweep/history/` for inspection | not-usable | Deleted specifically because they were unverified/fabricated evidence. Do not restore. No real product video exists anywhere in the repo or history. |

### Dashboard screenshots

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| `apps/web-next/app/dev/ui-check/page.tsx` | Real `ShopPlanControl` and `TryOnSettingsPanel` dashboard components, plus 4 fabricated KPI tiles and 1 fake shop row written directly into the page | In repo, dev-only (`notFound()` in production) | needs-anonymization | The dashboard components themselves are real and screenshot-safe; the 4 stat tiles and the fake shop table row must be removed or replaced with real/clearly-labeled demo numbers before any screenshot leaves "dev debugging" and becomes marketing proof. |
| `apps/web-next/lib/dashboard/analytics-preview-data.ts` + `components/dashboard/analytics-preview.tsx` (renders at `/dashboard/analytics`, Clerk-gated) | Fabricated funnel/operations/channel metrics (invented visit counts, conversion numbers) | In repo | not-usable | Entirely invented numbers with no real backing data. Do not screenshot this page for the homepage under any circumstances. |
| `apps/web-next/public/landing/hero-operations.jpg` | Fake dark-theme operations dashboard: fake nav, 4 fabricated KPI tiles (12,842 messages handled, 342 leads, etc.), fake bar chart, fake automations list and fake admin account | In repo, 1536x1024, 144KB; zero references anywhere in the current codebase (dead file) | outdated | Textbook fake-dashboard asset the rebuild is meant to eliminate. Already orphaned; recommend deleting the file outright rather than leaving it available to be picked back up. |

### Inbox screenshots

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| `apps/web-next/app/dev/store-chat-check/page.tsx` | Real `MessengerOverview` in 4 states (off / active-not-detected / live-with-traffic / long-domain Arabic RTL), real `ConversationsPanel` with 3 mock conversations, real `MessageText` bubble rendering, real sticky `PublishBar` | In repo, dev-only (`notFound()` in production) | usable-now | Best existing screenshot rig in the repo: the components are byte-for-byte what ships in production; only the numbers/copy are clearly-synthetic fixtures defined in the page itself. Dev-only, needs `next dev` running locally to capture. |
| `apps/web-next/app/embed/messenger/page.tsx` | Real shopper-facing `MessengerPanel` chat widget | In repo, public production route, no auth | usable-now | Cannot be loaded with fixture data: the server re-verifies the requesting origin and embed key against a real active site. Needs one real connected Shopify dev-store and its real embed key to screenshot live. |
| `apps/web-next/public/landing/proof-inbox.png` | Dark "Conversations inbox" Figma-style mockup with placeholder-kit names (Dianne Russell, Devon Lane, etc.) and a nav that does not match the real dashboard | Git history only (deleted in `2d2688d`); restored to `scratchpad/asset-sweep/history/` | not-usable | Not a real screenshot; stock UI-kit names and a nav inconsistent with the actual product. Deleted intentionally, do not restore. |
| `apps/web-next/public/landing/proof-whatsapp.jpg` | "WhatsApp Automation" mockup with a fabricated customer name/phone number and scripted dialogue | Git history only (deleted in `2d2688d`) | not-usable | Same fake-mockup family as proof-inbox.png, with a different (also non-matching) nav. Do not restore. |

### Lead screens

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| `apps/web-next/public/landing/proof-leads.jpg` | "Lead Pipeline" kanban mockup with fabricated Indian-market lead names and fake timestamps | Git history only (deleted in `2d2688d`) | not-usable | Fabricated mockup, internally inconsistent with the other deleted "proof" images (different sidebar nav), confirming none of them were captured from one real running app. Do not restore. |
| `apps/web-next/lib/dashboard/lead-preview-data.ts` + `crm-pipeline-preview.tsx` / `leads-preview-table.tsx` (renders at `/dashboard/crm`, Clerk-gated) | Fully invented lead names, companies, emails, phone numbers | In repo | not-usable | Fabricated PII-shaped data. Do not screenshot for the homepage. |
| n/a | n/a | n/a | **missing** | No real, current lead-pipeline screenshot exists anywhere. |

### Operations screens

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| `apps/web-next/public/landing/proof-operations.jpg` | "Operations" workflow-runs mockup with 4 fabricated metric tiles and an invented runs table | Git history only (deleted in `2d2688d`) | not-usable | Textbook fake-metrics dashboard; the deleting commit's own message states it was removed for being unverified. Do not restore. |
| `apps/web-next/public/landing/hero-operations.jpg` | See Dashboard screenshots above | In repo, unreferenced | outdated | Same asset, listed here for cross-reference since it depicts an "operations" nav/metrics screen. |
| n/a | n/a | n/a | **missing** | No real operations/workflow-run screen has ever been captured. |

### Analytics screens

| Path | Depicts | Provenance | Status | Notes |
|---|---|---|---|---|
| `apps/web-next/public/landing/operations/monitoring.mp4` + `monitoring-poster.jpg` | Poster shows a model at a desk in front of a monitor with a generic filler line chart | Git history only (deleted in `2d2688d`) | not-usable | On-screen chart is decorative filler, not real product analytics. Do not restore. |
| `apps/web-next/lib/dashboard/analytics-preview-data.ts` (see Dashboard screenshots) | Fabricated funnel/channel metrics | In repo, Clerk-gated | not-usable | Same fabricated-numbers issue as above. |
| n/a | n/a | n/a | **missing** | No real analytics screen with real numbers exists anywhere. Real analytics only render at `/dashboard/overview` behind sign-in with a real connected account, and there is no dev-mirror for it today. |

## 4. Integration marks

Verified directly against the installed package: `apps/web-next/node_modules/simple-icons`, version 16.27.1 (`apps/web-next/package.json` pins `^16.27.1`).

| Brand | In `simple-icons`? | Guideline URL (from `simple-icons` data) | Currently wired into `brand-marks.tsx`? |
|---|---|---|---|
| Shopify | Yes | https://www.shopify.com/brand-assets | Yes |
| WhatsApp | Yes | https://about.meta.com/brand/resources/whatsapp/whatsapp-brand | Yes |
| Instagram | Yes | https://about.meta.com/brand/resources/instagram | Yes |
| Telegram | Yes | none listed | Yes |
| Zapier | Yes | https://www.figma.com/file/NQFxTCE5pGR3dHZt0DkOyy/Zapier-Brand-Guidelines-%5BExternal%5D | Yes |
| Make | Yes | https://www.make.com/en/press | Yes |
| n8n | Yes | none listed | Yes |
| Notion | Yes | none listed | Yes |
| HubSpot | Yes | https://www.hubspot.com/style-guide | Yes |
| Supabase | Yes | none listed | Yes |
| OpenRouter | Yes | none listed | No (not yet imported into `brand-marks.tsx`) |
| Clerk | Yes | none listed | No |
| Sentry | Yes | none listed | No |
| PostHog | Yes | https://posthog.com/handbook/company/brand-assets | No |
| Upstash | Yes | none listed | No |
| Hostinger | Yes | https://www.hostinger.com/newsroom | No |
| Google Gemini | Yes (slug `googlegemini`) | none listed | Yes |
| Claude | Yes | none listed | Yes |
| Groq | No mark in `simple-icons` | n/a | No |
| OpenAI | No mark in `simple-icons` (trademark exclusion, documented in `brand-marks.tsx`) | n/a | No |

`brand-marks.tsx` also wires several marks not in the task's list that are relevant to the wider product (Anthropic, Meta, Facebook, TikTok, Zapier, WooCommerce, Vercel, GitHub, Stripe, Airtable, Linear): 22 marks total are currently imported and rendered from real `simple-icons` path/color data.

The rule already implemented in code (`apps/web-next/lib/product-truth/public-integrations.ts`) is the one to keep following: every mark shown publicly carries a `state` (`implemented`, `setup-required`, `evidence-required`, `planned`, or `infrastructure`) and an `evidenceRef` pointing at the code that backs the claim. For example, WhatsApp and Instagram currently render with state `evidence-required` because no repository evidence supports presenting them as ready, and OpenRouter and Groq are explicitly excluded from the general-audience homepage marquee (`components/landing/collaborations-marquee.tsx`) because they are internal AI infrastructure, not merchant-connectable integrations: they are named only on the dedicated `/integrations` page. Any new mark added to the homepage must go through this same registry: a logo alone, without a truthful state label, would imply a partnership or integration depth the product does not yet have.

## 5. Capturable real UI

These routes render the actual GrindCTRL components (not mockups) and can be screenshotted for the homepage:

| Route | Reachable without signing in? | What it shows | Must be labelled "Demo data"? |
|---|---|---|---|
| `/try-on` | Yes, public production route | Real `TryOnDemo` against the one seeded catalog product (Premium Ringer Tee) | No for the UI itself; yes for the result image unless captured with `TRYON_MODE=live` and a real uploaded photo, since the default result is the static mock. |
| `/embed/try-on` | Yes, public production route | Iframe-embeddable version of the same flow, can target a real store product via query params | Same as `/try-on`. |
| `/embed/messenger` | Yes, but requires a real active site's embed key and matching origin | Real shopper-facing `MessengerPanel` | No, if loaded against a real connected dev store; this is genuinely live. |
| `/dev/store-chat-check` | Only in `next dev` locally (404s in production) | Real `MessengerOverview`, `ConversationsPanel`, `MessageText`, `PublishBar`, across 4 states including Arabic RTL | Yes. All stats/conversations are synthetic fixtures defined in the page. |
| `/dev/ui-check` | Only in `next dev` locally (404s in production) | Real `ShopPlanControl` and `TryOnSettingsPanel` | Yes, and the 4 inline KPI tiles plus the fake shop row need to be removed or replaced first, since they are not sourced from a labelled fixture the way store-chat-check's are. |
| `/dashboard/overview`, `/dashboard/try-on`, `/dashboard/messenger`, `/dashboard/routing`, `/dashboard/inbox` | No, Clerk-gated | Real Supabase/Shopify-backed data for a signed-in account | No, if captured from a real connected account with real data. Would need real account access and owner permission to capture. |
| `/dashboard/analytics`, `/dashboard/crm` | No, Clerk-gated | Fabricated preview-data fixtures (invented customers, invented metrics) | Not applicable: do not use for the homepage regardless of labelling, since the underlying numbers are fictional, not just synthetic-and-disclosed. |

## 6. Gaps and honest treatment

| Gap | Honest treatment |
|---|---|
| Real screenshot of the live embedded storefront widget (try-on button, PDP) | Capture fresh from `/embed/try-on` or a real connected Shopify dev store. Do not reuse `grindctrl-tryon-proof.png`, which is a styled mockup, not a screenshot. |
| Real customer/store logos | Omit until real merchants give logo-use permission. Do not substitute stock or placeholder logos. |
| Real signed-in dashboard, inbox, leads, and analytics screens | Two options: (a) capture from `/dev/store-chat-check` and a corrected `/dev/ui-check` with clearly labelled "Demo data" fixtures, since the real components are what ships; or (b) capture from a real signed-in account with real data once the owner grants access, in which case no "demo" label is needed. Never source from `analytics-preview-data.ts`, `conversation-preview-data.ts`, or `lead-preview-data.ts`: those are fabricated, not demo-labelled, and the code that renders them is exactly the "fake dashboard" pattern being eliminated. |
| Real AI-generated try-on result image | Run the app locally with `TRYON_MODE=live` and a real `OPENROUTER_API_KEY`, then upload a real, consented photo through `/try-on`. Nothing in the repo today is a genuine AI output. |
| Real product/operations video | None exists and none should be resurrected from history: the 5 deleted "operations" clips were AI/stock footage with fabricated or nonsense on-screen UI. If video is wanted, it needs a fresh screen recording of a real flow (e.g., the `/try-on` demo end to end) or real footage the owner commissions. |
| `hero-operations.jpg` (fake, orphaned dashboard mockup) | Delete. It is unreferenced by any current page and depicts a nav and metrics that do not match the real product. |
| Two Downloads-folder images of uncertain provenance (`grindctrl-tryon-email-monochrome-v2.png`, `grindctrl-image.png`) | The email graphic needs the owner to confirm whether its phone-screen content is a real screenshot and whether the people shown consented to public use, before any reuse. The lion/BMW image is unrelated AI-generated content and should not be used anywhere near a "no fake AI content" claim. |
| Testimonial photos (`person-1.png`, `person-2.png`) | Correctly already hidden: the testimonials feature is hard-disabled in code (`ENABLE_TESTIMONIALS = false`, empty arrays) pending real client sign-off. Keep it that way until real customer quotes and photos are approved; do not use these stock/AI-looking headshots as social proof. |
