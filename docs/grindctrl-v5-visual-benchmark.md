# GrindCTRL V5 — Live Competitor Visual Benchmark

Date: 2026-09-18. All five sites inspected live in-browser, desktop (~800-1440px) and mobile (375px). This is a benchmark record, not a design spec — it feeds `grindctrl-homepage-visual-map.md`, which is the actual implementation plan.

Per the V5 brief: these are visual **communication patterns** to rebuild natively for GrindCTRL, never source, copy, layout, or assets to copy.

---

## GrindCTRL (baseline — as of commit `dad786c`)

Hero: eyebrow badge, headline, subcopy, two CTAs, trust line, then a 4-stop composition of real product screenshots (try-on result → Store Chat handoff → team inbox → report) with numbered badges. This is a genuine improvement over the old silhouette hero, and the numbered-sequence idea is worth keeping.

What's still weak against the benchmark set: everything below the hero is unchanged from the old build — a text table ("Connected system"), an illustrative render-provenance figure, a text ledger ("Platform pillars"), an illustrative downstream-journey diagram, and a text-card grid ("Platform evidence"). None of these show real product UI. The integrations are listed as plain text/badges inside a card, not real marks. This is the "heading + paragraph + three cards" failure mode the brief calls out, everywhere except the hero.

---

## 1. Genlook — genlook.app

**Hero (G1: input → transformation → outcome).** Headline + one line of subcopy + two CTAs, then immediately a real mirror-selfie photo of a shopper. Scrolling the hero reveals a strict numbered sequence, all real photography of the same person in the same room: **01 the shopper's photo → 02 the product photo → 03 the try-on, generated (with a literal "9.3s" generation-time badge) → 04 on any product** (same shopper, different garment, proving reusability). No paragraph is needed to understand what the product does — the four photos say it.
*Why it works:* one continuous visual thread (same person, same setting) removes all ambiguity about what "before" and "after" mean, and the generation-time badge makes the speed claim provable rather than asserted.
*GrindCTRL equivalent:* the hero already does a numbered real-screenshot sequence (signal → context → action → outcome), which is the right shape. What Genlook does that GrindCTRL's hero doesn't: put the *transformation itself* (a literal generate step) in the sequence, and prove speed/reality with a visible, honest badge rather than a claim.
*Do NOT copy:* the mirror-selfie photo style, the specific four-photo grid layout, or Genlook's product photography.

**Trust row.** "Trusted by 400+ fashion brands" + a row of real client wordmark logos + a Shopify-App-Store-style 5.0 rating with star icons.
*GrindCTRL equivalent:* GrindCTRL has no verified client logos yet (per `docs/grindctrl-visual-asset-inventory.md` / legal-entity memory — no customer testimonials are approved). Section 2 of the V5 plan must substitute verified integration/stack proof (real Shopify partner status, etc.) instead of fabricating a client-logo row. This is a hard constraint, not a style choice.

**"Where it lives" (G2: product in real commerce context).** A literal browser-frame mockup of a real Shopify PDP (`demo.genlook.app/products/...`) with the "See it on you" button inserted exactly where it would sit in production, next to real price/rating copy. Three one-line trust facts underneath (any theme, private by default, your brand not ours) — no paragraphs.
*GrindCTRL equivalent:* GrindCTRL already has real try-on and Store Chat UI; the pattern to adopt is showing that UI *inside a real PDP/storefront frame*, not floating in isolation, wherever the copy claims "this lives on your storefront."

**"Every category in your catalog" (G3: breadth proven visually).** A swipeable carousel of the *same shopper*, different real garment categories (dress, coat), each labeled with a category pill (Dresses, Outerwear). Breadth is proven with more real photos, not a text list of categories.
*GrindCTRL equivalent:* GrindCTRL's platform breadth (Shopping, Conversations, Leads, Operations, Reporting) must be proven the same way — one real screenshot per capability, not a text ledger. This is section 4 of the V5 plan.

**"Built to convert."** A dashboard-styled proof card: a bar comparison (tried-on 6.4% vs. not 2.1%), a revenue-attributed line, and two headline stats (+32% conversion, -24% returns), sourced to "yourstore.com."
*What must NOT be copied:* the specific numbers, or presenting any number as GrindCTRL's own result. GrindCTRL has no live attribution data yet. If this pattern is adapted at all, it must be visibly labeled as illustrative/demo data exactly like the rest of the site's existing "Demo data" badge convention, or omitted entirely in favor of the real run-status/conversation-count data GrindCTRL does have (Section 8 of the V5 plan).

**Mobile.** Single column, full-bleed photos, headline/CTA stack cleanly above the fold. No overflow, no layout surprises.

---

## 2. Antla — antla.io

**Hero (A1: direct interaction).** Left: headline, one line of subcopy with two inline stats (35% higher conversions, 3x engagement), two CTAs. Right: one large real model photo plus a **vertical strip of selectable product thumbnails** (bag, tank top, jeans, trench, sunglasses, beanie). Clicking a thumbnail swaps the item the model is wearing/holding in the main photo — confirmed by direct interaction during this audit (clicking the sunglasses thumbnail changed the bag in the model's hand). No page reload, instant swap.
*Why it works:* it's the single clearest "try it yourself, right now, with zero commitment" interaction of all four competitors — the visitor proves the product's core loop by clicking once, before reading a word of copy.
*GrindCTRL equivalent:* this is the strongest pattern in the whole benchmark set and maps directly onto the V5 brief's Section 1 requirement ("selectable events: Try-on / Message / Lead / Order, selecting one changes the real visual journey"). GrindCTRL's hero should let a visitor click between the four real signal types and see the *specific* downstream screenshot for that signal, not just a static four-stop scroll.
*Do NOT copy:* Antla's specific product photography, the thumbnail-strip visual chrome, or its layout proportions.

**Trust row.** Real Shopify-brand wordmark logos in a strip, auto-rotating.
*Same constraint as Genlook* — GrindCTRL has no approved client logos.

**"Conversion Engine" (A2/A3: lifecycle + downstream action).** A genuine node-and-edge diagram, not a table: **01 Capture** (Virtual Try-On) → **02 Consent** (Email Collection) → **03 Activate**, which fans out to real integration logos (Shopify segments, Meta ads, Klaviyo email flows, Postscript SMS) → **04 Re-engage** (Personalized outreach) → **05 Return** (Your Storefront). Three headline stats below (60% CTR, 3x session length, "Unlimited" channels).
*Why it works:* it is the single clearest "we are infrastructure, not a widget" section in the whole set, because the diagram uses real product logos at the fan-out point instead of describing integrations in prose.
*GrindCTRL equivalent:* this is exactly what GrindCTRL's "One platform" section (V5 Section 4) and its now-orphaned `ConnectedSystemMap`/`PlatformEvidenceSequence` text-table components should become — a real node diagram: Signal (storefront/try-on/WhatsApp) → Understand (Store Chat/AI) → Act (routing/handoff/workflow, with real Shopify/WhatsApp/Klaviyo-class marks at the fan-out) → Verify (team inbox) → Learn (report). GrindCTRL's own five-part breadth (Shopping/Conversations/Leads/Operations/Reporting) is the node set.
*Do NOT copy:* Antla's specific stats, its exact diagram chrome, or its color-coded edge styling.

**Model/Clothing/Result triptych.** A dark-framed three-column real-photo comparison (labeled MODEL / CLOTHING / RESULT) — a second, more explicit version of the input→transformation→output idea.

**Mobile.** The thumbnail-strip interaction survives on mobile as a horizontally scrollable row *below* the full-width photo, with an explicit "Tap any item to try it on" instruction label — this is the single best mobile-translation example in the whole benchmark set; the interaction is not lost, just re-laid-out.

---

## 3. OptiDress — optidress.fr/en

**Hero.** Centered, editorial: a serif headline with an italic accent line ("...*from a whole new angle*"), one line of subcopy, a small illustrated widget mockup (a size-picker + "Find My Perfect Fit in 10sec" CTA on a product card), two CTAs. More restrained/typographic than Genlook or Antla; leans on positioning language over an immediate hero photo.
*Real bug observed on mobile:* at 375px the serif headline and its italic second line visually overlap and become illegible — a concrete, verified example of decorative display type breaking without adequate mobile line-height. Recorded here specifically as a "what not to copy" — GrindCTRL's own hero already avoids this (tested and verified clean at 320–1440px this session).

**"They trust us" (scroll-pinned reveal).** Real client wordmarks (T2, Maison Arev, others) fade in one at a time as the visitor scrolls through a long pinned section — an animated variant of a trust strip rather than a static row.
*Same constraint as above* — no approved GrindCTRL client logos exist yet; if adopted, this pattern would need to point at verified integration/partner marks instead.

**Problem-first storytelling (O1).** The strongest, most literal realization of "problem before solution" in the set: a single dashed line winds down the page connecting one editorial card at a time, each naming a specific failure of the *status quo* in plain language — "A size guide is not enough" (measuring yourself is not the same as seeing yourself in it), "A photo on a model? Better, sure, but most people don't look like a fashion model." Each card is short (2–3 sentences), never a paragraph, and the dashed path is the only "layout system" — there is no 3-column grid anywhere in this section.
*Why it works:* it makes the merchant's actual pain the hero of the section, in the merchant's own frustrated voice, before OptiDress is even named.
*GrindCTRL equivalent:* this is the exact shape for V5 Section 3 (Broken Journey / Connected Journey) — a sequence of short, single cards on a connecting line, each naming one real point where an unconnected stack fails a merchant today (an Instagram DM nobody sees until Monday; a lead that lives only in someone's inbox; an order update the shopper never gets), followed by the connected GrindCTRL version of the same path. Not a feature grid.

**Real, cited industry statistics (used to frame the problem, not to claim a GrindCTRL result).** "70 to 85% of carts abandoned in online fashion (source: Baymard Institute)," "20 to 30% average returns in fashion e-commerce (source: McKinsey & Company)," a funnel bar chart, a "1-3% conversion" crowd-of-dots illustration (a sea of gray people with only 1-3% highlighted).
*Important distinction for GrindCTRL:* citing real, sourced, external industry statistics as *problem framing* is legitimate and encouraged (with a visible citation, exactly as done here). Fabricating a GrindCTRL-specific performance number is not. These are not the same thing, and V5 Section 3's problem framing should use the former if any statistic is used at all.

**"A complete infrastructure" (O2).** THE SOLUTION eyebrow, then three real-widget product cards (OptiDress / OptiSize / OptiMove), each: small eyebrow label, product name, 1–2 line description, one real UI screenshot. The unreleased third product is shown blurred with a plain "Soon" label — an honest, undisguised maturity state, not a fake feature.
*GrindCTRL equivalent:* directly validates the existing pattern already used in `docs/golden-landing-standard.md` (`NotLiveList`/maturity labels) — keep using real screenshots per capability, and keep the same honesty about what's not live yet, exactly like OptiDress's "Soon" card.

**Integration visualization (O3).** A radial hub-and-spoke diagram — the OptiDress mark at the center, real platform logos (Shopify, Wix, Squarespace, Webflow, Salesforce Commerce Cloud, others) arranged in concentric rings and connected by lines. Visually distinctive; explicitly not a marquee or a repeated-wordmark strip.
*GrindCTRL equivalent:* V5 Section 9 asks for integrations grouped **by job** (Commerce/Channels/Automation/CRM/AI), which is a better fit for GrindCTRL's actual integration depth story than a single radial hub (GrindCTRL's integrations vary by depth, not just by presence) — so the grouped-card structure from the existing `components/landing/proof/integrations-directory.tsx` (built this session, not yet wired in) is the right base, but it must carry real official marks per group, sized and laid out with clearly more presence than a thin wordmark row.
*Do NOT copy:* the literal radial/orbit diagram or OptiDress's specific platform set.

---

## 4. Perfect Corp — perfectcorp.com/business/products/virtual-dressing-room-online

**Hero.** More corporate/enterprise in tone than the other three (Perfect Corp is a large established company with many products under one roof). Desktop: plain headline + paragraph + two CTAs, immediately followed by a literal numbered "How It Works" list. Mobile surprisingly leads with a stronger visual: a carousel of three real models each in a different generated outfit, with tappable thumbnail chips below each model and left/right arrows — better than the desktop version.

**"How It Works (3 Easy Steps)" (P1: visual step education).** Vertical, numbered (huge numeral type), one small real UI thumbnail per step (an upload-photo placeholder, outfit-picker thumbnails, a before/after result photo), connected by simple chevron arrows, one short instruction line each.
*Why it works:* the numerals do the hierarchy work, so each step reads in under two seconds; the accompanying visual is a real (if small) product screenshot, not an icon.
*GrindCTRL equivalent:* directly reusable for V5 Section 7 (Leads + Operations) and anywhere else a workflow needs explaining — e.g., Operations: 1) event enters → 2) GrindCTRL decides under rules → 3) action runs → 4) outcome is logged, each with one real screenshot crop, exactly the shape the V5 brief specifies for P1.

**"Instant, Realistic Results" / "Inclusive Fit for Every Body Type."** Real photography, a soft multi-color gradient wash used tastefully as a *background*, never as a stand-in for product proof — the actual proof is always a real photo or phone-mockup in front of it. The inclusive-fit section shows the *same garment* applied to two different real body types side by side (labeled Plump / Thin) as direct proof of robustness, not a claim.
*Note for GrindCTRL:* the gradient wash here is subtle and brand-tinted, not the "generic dark navy AI glow" the brief prohibits — the distinction is that it never replaces a real visual, it only sits behind one.

**Use-case breadth (P3).** An expandable accordion list, one entry per garment category (Jackets, Trousers, Shirts & Tops), each with a short description and a "Try [X] Try-On Now" link. Breadth as a real, if minimal, per-category CTA rather than a static grid.

**API / technical trust (P2).** A plain inline text link ("Clothes API") in the hero paragraph pointing to a developer surface, and a "See Pricing" link — present but low-key on this particular page; Perfect Corp's technical-trust depth lives mostly off this specific product page (on their platform/API pages), not on it.
*GrindCTRL equivalent:* GrindCTRL's technical-trust section (V5 Section 11) should surface what's real today — Shopify app install method, webhook/API surface if any, monitoring, human review boundary, and link out to the actual security/privacy pages already live on the site — rather than inventing enterprise features Perfect Corp implies but doesn't show here either.

---

## Cross-cutting patterns worth carrying into every GrindCTRL section

1. **Numbered or lettered real-photo sequences beat prose every time** (Genlook 01-04, Perfect Corp Step 1-3, Antla's 01-05 lifecycle). GrindCTRL's hero already does this; the rest of the page currently doesn't.
2. **A real UI screenshot inside a real surface (PDP, phone frame, browser frame) reads as more credible than the same screenshot floating alone.** Genlook's PDP mockup and Perfect Corp's phone mockups are the clearest examples.
3. **Interaction, where present, is a single click with an immediate visual result** (Antla's thumbnail swap). It is never a modal, a multi-step form, or anything that interrupts scrolling.
4. **Short captions, not paragraphs, accompany every visual** — one to three lines maximum, consistently, across all four sites.
5. **Fabricated or unverified numbers never appear without a source or a "demo data" label.** OptiDress cites Baymard/McKinsey for industry-wide problem framing; nobody presents an invented GrindCTRL-specific result as fact. This is the line GrindCTRL must not cross (per V5 §9 and this repo's existing "no fake metrics/clients" rule).
6. **Honest maturity labeling of unfinished features is normal and doesn't read as weakness** — OptiDress's blurred "Soon" card is the clearest example, and matches the maturity-label convention GrindCTRL already uses (`docs/golden-landing-standard.md`, `NotLiveList`).
7. **Mobile is a re-layout of the same real assets, never a downgrade.** Antla's "tap any item" row survives mobile as a labeled horizontal scroller; Genlook's four-photo sequence survives as a stacked single column. The one mobile failure observed (OptiDress's overlapping serif headline) is decorative typography outrunning its own line-height, not a content or interaction loss.
