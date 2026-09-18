# GrindCTRL homepage visual map (V5)

Every section of the rebuilt homepage, mapped from `grindctrl-v5-visual-benchmark.md` to a real GrindCTRL asset. This is the implementation plan gates 4-8 execute against. Section numbers match the V5 brief §7.

Legend for asset paths: all relative to `apps/web-next/`.

---

## Section 1 — HERO

**Competitor benchmark:** Genlook G1 (numbered real-photo sequence) + Antla A1 (click-to-swap interaction).
**GrindCTRL purpose:** within 5 seconds, prove GrindCTRL is a broad platform where try-on is one signal among several, not the whole product.
**PRIMARY_VISUAL_ASSET:** a click-to-select strip of four real signal types (Try-on / Message / Lead / Order), each swapping the visual journey shown.
**Asset paths:**
- Try-on: `public/landing/proof/tryon/woman-linen-shirt.webp` (real generated result) + `public/landing/proof/tryon/inputs/shopper-woman.webp` + `garment-linen-shirt.webp`
- Message: `public/landing/proof/hero-chat-{locale}.webp` (real Store Chat capture)
- Lead: `public/landing/proof/hero-inbox-{locale}.webp` (real team inbox capture)
- Order/Outcome: `public/landing/proof/hero-report-{locale}.webp` (real Store Chat report capture)
**Interaction:** click/tap one of four labeled chips (Try-on, Message, Lead, Order); the composed frame(s) below cross-fade to that signal's real screenshot(s), matching the already-built `TryOnSwitcher` cross-fade pattern (no network wait, no layout shift). Default/first-paint state shows Try-on (highest lc visual weight) already selected.
**Desktop composition (xl, 1280px+):** existing `HeroSystem` absolute-position frame layout is kept structurally (4 numbered stops in a loose collage), but stop 1 becomes the *selected* signal's real asset instead of always being the try-on photo; a horizontal row of 4 selector chips sits above or beside the collage.
**Mobile composition:** selector chips become a horizontal scrollable row (Antla's verified-good mobile pattern), immediately above the stacked real-screenshot frames; stacking order and frame sizing otherwise unchanged from the current (already mobile-verified) `HeroSystem`.
**Fallback:** if JS/hydration hasn't run yet, the default (Try-on) state renders via plain `next/image` — the brief requires the hero be understandable with the default state alone even before interaction.
**Performance cost:** all four signals' images are already-optimized static WebP (same budget class as the current hero, which already loads 3-4 proof images with `priority` on the first two); no new network requests on interaction since all assets are present in the initial payload, matching `TryOnSwitcher`'s existing zero-latency-switch design.

---

## Section 2 — REAL TRUST

**Competitor benchmark:** Genlook + Antla trust rows, Perfect Corp partner language — but GrindCTRL has **no approved customer logos** (confirmed: `legal-entity` memory, `docs/grindctrl-visual-asset-inventory.md`).
**GrindCTRL purpose:** substitute verified stack/integration proof for unavailable client logos, honestly.
**PRIMARY_VISUAL_ASSET:** real official marks for Shopify (native app, verified) + the AI infrastructure marks already in `brand-marks.tsx` (OpenRouter, etc.) + a factual line (native Shopify app, Arabic/English, managed setup) — this already exists in the current hero's trust row (`heroTrust` + `ShopifyMark`) and should be promoted into its own short band rather than invented from scratch.
**Asset path:** `components/brand-marks.tsx` (`ShopifyMark`, others already exported).
**Interaction:** none.
**Desktop composition:** a single short band, marks + one factual line, no card chrome.
**Mobile composition:** wraps to two lines, same as the existing hero trust row (already verified this session at 320-430px).
**Fallback:** n/a — static marks.
**Performance cost:** negligible — inline SVG marks, no images.

---

## Section 3 — BROKEN JOURNEY / CONNECTED JOURNEY

**Competitor benchmark:** OptiDress O1 (dashed-path, one editorial card at a time, real cited stats for problem framing).
**GrindCTRL purpose:** show the fragmented merchant reality before GrindCTRL, then the same path connected.
**PRIMARY_VISUAL_ASSET:** a connecting line (SVG path, not a 3-column grid) linking 4-5 short cards: an Instagram/WhatsApp DM nobody sees until Monday → a lead that lives only in someone's inbox → an order update the shopper never gets → (repeat with GrindCTRL connected) the same DM captured by Store Chat → routed to the real team inbox (`hero-inbox`) → reflected in the real report (`hero-report`).
**Asset paths:** reuses `public/landing/proof/hero-chat-{locale}.webp`, `hero-inbox-{locale}.webp`, `hero-report-{locale}.webp` as the "after" thumbnails beside the "before" text cards — no new captures needed for the connected half.
**Interaction:** none required; optional scroll-reveal (`gc-scroll-reveal`, already an approved motion token) as each card enters viewport.
**Desktop composition:** vertical or gently S-curved path, cards alternating or stacked, "before" cards in muted/quiet styling, "after" cards carrying the real screenshot thumbnails.
**Mobile composition:** straight vertical path, one card per row, thumbnails full-width.
**Fallback:** with JS disabled, cards render in document order without the path animation — the path is decorative, not load-bearing for comprehension.
**Performance cost:** low — reuses already-shipped images, path is inline SVG or CSS border, no new heavy assets.

---

## Section 4 — ONE PLATFORM

**Competitor benchmark:** Antla A2/A3 (Capture→Consent→Activate→Re-engage→Return node diagram with real logos at the fan-out).
**GrindCTRL purpose:** replace the current text-table (`ConnectedSystemMap`) and text-ledger (`PlatformEvidenceSequence`) with one real node diagram proving the five-part platform (Shopping, Conversations, Leads, Operations, Reporting) is genuinely connected.
**PRIMARY_VISUAL_ASSET:** five nodes, each carrying a real screenshot thumbnail:
- Shopping → `public/landing/proof/storefront-tryon-{locale}.webp`
- Conversations → `public/landing/proof/chat-{locale}.webp`
- Leads → `public/landing/proof/inbox-{locale}.webp`
- Operations → `public/landing/proof/tryon-usage-{locale}.webp`
- Reporting → `public/landing/proof/report-{locale}.webp`
**Interaction:** click/tap a node to expand its thumbnail to full size in place (matches V5 §7 Section 4: "tap/click expands actual state"); default state shows all five at thumbnail size.
**Desktop composition:** a connected diagram (edges linking the five nodes in sequence, echoing Antla's fan-out shape), each node = small real screenshot + one-line label + maturity tag (`live`/`foundation`/`planned`, reusing the existing maturity-label convention from `docs/golden-landing-standard.md`).
**Mobile composition:** nodes stack vertically in sequence order; tapping still expands in place; edges become simple vertical connectors.
**Fallback:** un-expanded thumbnail state is fully legible on its own (each thumbnail crop chosen to be meaningful at small size, same as the hero's existing stop images).
**Performance cost:** moderate — five thumbnail images (already shipped for the hero/other sections, several are reused, not new), one image per node; no video.

---

## Section 5 — AI SHOPPING / TRY-ON

**Competitor benchmark:** Genlook G1 breadth-by-category carousel + Antla's real generated-result switcher.
**GrindCTRL purpose:** premium, fashion-forward proof of the try-on capability specifically, using only real generated outputs.
**PRIMARY_VISUAL_ASSET:** the already-built `TryOnSwitcher` component (`components/landing/proof/try-on-switcher.tsx`), which cross-fades between the 4 real generated pairs.
**Asset paths:** `public/landing/proof/tryon/woman-linen-shirt.webp`, `woman-abaya.webp`, `man-denim-overshirt.webp`, `man-knit-polo.webp`, plus their input pairs under `public/landing/proof/tryon/inputs/` — all real outputs from `lib/try-on/image-runner.ts` via `google/gemini-3.1-flash-image` (see `public/landing/proof/tryon/manifest.json` for provenance/cost per pair). No CSS-faked results anywhere.
**Interaction:** click a garment thumbnail, the result cross-fades (already implemented, zero network wait).
**Desktop composition:** result frame + shopper-photo/garment-photo mini-frames beside it (already built into `TryOnSwitcher`), garment picker row beneath.
**Mobile composition:** existing component already uses a `minmax(0,1fr)_minmax(0,0.34fr)` grid that reflows; verify at 320-430px as part of Gate 6 QA.
**Fallback:** first garment (`woman-linen-shirt`) pre-selected and rendered without interaction.
**Performance cost:** 4 result images + up to 4 input pairs = up to 8-10 images for this section alone (each already-shipped WebP); acceptable since this is explicitly allowed to be "visually fashion-heavy" per the V5 brief, but should lazy-load below the fold (not `priority`).

---

## Section 6 — CONVERSATIONS

**Competitor benchmark:** Genlook G2 (real UI in a real surface) + Perfect Corp's real-imagery-over-text discipline.
**GrindCTRL purpose:** show the actual inbox/chat UI, not a text description of "AI replies in WhatsApp tone."
**PRIMARY_VISUAL_ASSET:** the real Store Chat capture already used in the hero, shown larger/standalone here with channel icon, message, AI response, handoff state all visible in the actual screenshot (not re-described in text).
**Asset path:** `public/landing/proof/chat-{locale}.webp` (the full-size capture the hero's `hero-chat-{locale}.webp` was cropped from).
**Interaction:** none required; optional hover/focus state consistent with `gc-card-hover`.
**Desktop composition:** large single real screenshot, short caption (2-3 lines) beside or below it, no "feature card" grid.
**Mobile composition:** full-width screenshot, caption below.
**Fallback:** n/a — static image.
**Performance cost:** low — one already-shipped image.

---

## Section 7 — LEADS + OPERATIONS

**Competitor benchmark:** Perfect Corp P1 (numbered visual steps, real UI thumbnail per step).
**GrindCTRL purpose:** one real end-to-end workflow, visually, not a text description.
**PRIMARY_VISUAL_ASSET:** 3-4 numbered steps, each with a real screenshot crop: 1) event enters (real inbox capture) → 2) lead created/routed (`inbox-{locale}.webp`) → 3) operation executed (`tryon-usage-{locale}.webp`) → 4) outcome verified (`report-{locale}.webp`).
**Asset paths:** `public/landing/proof/inbox-{locale}.webp`, `tryon-usage-{locale}.webp`, `report-{locale}.webp` (all already-shipped, reused from other sections — consistent with "one shopper, one system" visual thread already established in the hero).
**Interaction:** none required; connected by chevrons/arrows (Perfect Corp P1 pattern), numerals carry the hierarchy.
**Desktop composition:** horizontal 4-step row.
**Mobile composition:** vertical 4-step stack, same as Perfect Corp's verified-working mobile step list.
**Fallback:** static, no JS dependency.
**Performance cost:** low — all images reused from elsewhere on the page (browser cache hit if already loaded above the fold), no new captures needed.

---

## Section 8 — REPORTING / CONTROL

**Competitor benchmark:** Genlook's "Built to convert" dashboard card — **structure only**, never its fabricated numbers.
**GrindCTRL purpose:** show real GrindCTRL report/operations data, or clearly-labeled demo data — never an invented uplift metric.
**PRIMARY_VISUAL_ASSET:** the real Store Chat report capture (`hero-report-{locale}.webp`) plus, if desired, the real try-on usage-overview capture (`tryon-usage-{locale}.webp`) — both already carry the "Demo data" badge convention established in `proof-copy.ts`'s `demoDataBadge`/`demoNote` fields.
**Asset paths:** `public/landing/proof/report-{locale}.webp`, `public/landing/proof/tryon-usage-{locale}.webp`.
**Interaction:** none.
**Desktop composition:** one or two large real screenshots side by side, "Demo data" badge visible on each, one caption line.
**Mobile composition:** stacked, full width.
**Fallback:** n/a.
**Performance cost:** low — reused images.

---

## Section 9 — INTEGRATIONS

**Competitor benchmark:** OptiDress O3 (grouped, not a marquee) — grouping structure adopted over the literal radial-hub visual, since GrindCTRL's integration *depth* varies per item (see benchmark doc).
**GrindCTRL purpose:** replace any remaining text/badge integration list with real official marks, grouped by job, each carrying an honest depth label sourced from the product-truth register.
**PRIMARY_VISUAL_ASSET:** the already-built `IntegrationsDirectory` component (`components/landing/proof/integrations-directory.tsx`), which derives depth per integration from `lib/product-truth/public-integrations.ts` — cannot claim more than the register does, by construction.
**Asset path:** `components/brand-marks.tsx` (real marks: Shopify, WhatsApp, Instagram, Telegram, Zapier, Make, n8n, Notion, HubSpot, Supabase, OpenRouter, etc., per `GROUPS` in the component).
**Interaction:** none required (static grouped grid); optional hover state per `gc-card-hover`.
**Desktop composition:** grouped cards (Commerce / Channels / Automation / CRM & data / AI infrastructure), each card = mark + name + depth label + one line, per the component's existing structure.
**Mobile composition:** groups stack, cards wrap to a narrower grid (verify at 320-430px in Gate 7 QA — component not yet responsive-tested since it isn't wired in yet).
**Fallback:** n/a — static marks.
**Performance cost:** negligible — inline SVG marks via `simple-icons`, no raster images.

---

## Section 10 — BUSINESS CASE

**Competitor benchmark:** OptiDress O4/business-case stats — **cited external industry figures**, not invented GrindCTRL performance numbers (see benchmark doc's explicit distinction).
**GrindCTRL purpose:** measurable-outcomes framing without fabricated uplift, since no ROI-calculator assumptions have been owner-approved.
**PRIMARY_VISUAL_ASSET:** none fabricated. Either (a) omit this section's numeric claims entirely and keep it to the dimensions named in the V5 brief (conversion, support workload, response time, lead handling, automation hours, return confidence) stated as *what GrindCTRL measures*, not as achieved results, or (b) if the owner supplies real, sourced industry statistics (Baymard/McKinsey-class citations, matching the OptiDress pattern), use those with visible citation for problem framing only.
**Asset path:** none required — this section is copy + the same real report screenshot already used in Section 8, if a visual anchor is wanted.
**Interaction:** none, unless an approved ROI calculator is later commissioned (explicitly gated by the brief — "only if approved").
**Desktop/mobile composition:** short text block, no card grid, no fake calculator UI.
**Fallback:** n/a.
**Performance cost:** none.

---

## Section 11 — MANAGED IMPLEMENTATION / TECHNICAL TRUST

**Competitor benchmark:** Perfect Corp P2 (technical trust) — real, not implied enterprise maturity.
**GrindCTRL purpose:** state what's real today: Shopify app install method, human review boundary, monitoring, and link to the site's actual (already-live) security/privacy pages.
**PRIMARY_VISUAL_ASSET:** no new visual required — this is the one section in the plan that is legitimately copy-led, matching Perfect Corp's own low-key treatment of this exact topic on this exact page (see benchmark doc). If a visual is wanted, reuse the Shopify mark + a small "native app, managed setup" fact line already established in Section 2.
**Asset path:** n/a / `components/brand-marks.tsx` if a mark is used.
**Interaction:** links to existing security/privacy pages (already live, not built by V5).
**Desktop/mobile composition:** short text block with real links.
**Fallback:** n/a.
**Performance cost:** none.

---

## Section 12 — FINAL CTA

**Competitor benchmark:** all four sites close platform-level, never product-narrow.
**GrindCTRL purpose:** replace the current try-on-only closing line ("Give shoppers a reason to feel sure before checkout") with a platform-level close.
**PRIMARY_VISUAL_ASSET:** a small echo of the Section 4 node diagram (same five-node shape, compact), not a new asset.
**Asset path:** reuses Section 4's thumbnails at a smaller crop, or omits imagery entirely in favor of the existing dark closing-band treatment already live on the site.
**Interaction:** none.
**Desktop/mobile composition:** unchanged from current closing-band layout; only copy and CTA pair change ("See it working" / "Book a call", matching the hero's own CTA pair for consistency).
**Fallback:** n/a.
**Performance cost:** none if imagery is reused/omitted.

---

## Assets confirmed to exist today (no new captures required for Gates 4-9)

All under `apps/web-next/public/landing/proof/`:
`chat-{ar,en}.webp`, `hero-chat-{ar,en}.webp`, `hero-inbox-{ar,en}.webp`, `hero-report-{ar,en}.webp`, `inbox-{ar,en}.webp`, `report-{ar,en}.webp`, `storefront-tryon-{ar,en}.webp`, `tryon-usage-{ar,en}.webp`, and under `tryon/`: `woman-linen-shirt.webp`, `woman-abaya.webp`, `man-denim-overshirt.webp`, `man-knit-polo.webp` plus their 6 input photos (`inputs/shopper-woman.webp`, `shopper-man.webp`, `garment-linen-shirt.webp`, `garment-abaya.webp`, `garment-denim-overshirt.webp`, `garment-knit-polo.webp`).

Components already built, not yet wired into `site-landing.tsx`: `TryOnSwitcher`, `IntegrationsDirectory` (both in `components/landing/proof/`).

Components to be replaced (currently still imported in `site-landing.tsx`, all text/illustration-based, none carry a real screenshot): `ConnectedSystemMap`, `JourneyProofTabs`, `PlatformEvidenceSequence`, `RenderReceiptFigure`.
