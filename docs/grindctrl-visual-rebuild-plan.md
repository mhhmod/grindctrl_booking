# GrindCTRL homepage visual rebuild plan (V4)

Date: 2026-09-17
Inputs: `GrindCTRL_V4_Visual_Fidelity_Implementation_Correction.md` (visual execution), the master product strategy spec and `apps/web-next/lib/product-truth/` (product truth; no separate V3 file exists on this machine), `docs/grindctrl-visual-asset-inventory.md` (what real visuals exist), before screenshots in `docs/visual-qa/2026-09-17-before/`.

## 1. What the live site gets wrong today

Checked on grindctrl.cloud at 1440px and 390px (release `c2039ef`):

| Area | Problem |
|---|---|
| Hero | Headline is platform-level, but the only visual is a generic silhouette icon with a scan animation. Nothing shows the product. |
| Connected system | A text table (Shopper / GrindCTRL / Business system). |
| Live demo | A decorative "render receipt" silhouette. |
| Platform pillars | Five text rows with status badges. |
| Journey tabs | Eight text tabs. |
| Evidence | Five text cards; integrations are small logo chips inside a text card. |
| Final CTA | "Give shoppers a reason to feel sure before checkout." Try-on only, one button. |
| Footer | "AI commerce experiences for Shopify fashion stores." Narrower than the platform. |

## 2. The asset reality that shapes this plan

The inventory found no real captured product screenshots and no real AI try-on result anywhere. Every old "proof" image (`proof-*.jpg/png`, `hero-operations.jpg`, the operations videos) was an AI-generated mockup with invented people and metrics. They stay deleted.

Real visual proof therefore comes from the product itself:

1. **Real UI, demo data.** A dev-only capture rig (`app/dev/visual-proof`) renders the shipping components (`TryOnDemo`, `MessengerPanel`, `ConversationsPanel`, `MessengerOverview`, the try-on usage overview) with one coherent demo scenario, and a script captures them to WebP in both English and Arabic. Every placement on the site carries a visible "Demo data" label.
2. **Official integration marks** from the installed `simple-icons` package, with the integration depth taken from the product-truth register.
3. **Real try-on imagery** requires owner input (see section 6). Until it exists, try-on is shown through its real interface and real garment, never through the mock result image.

Demo scenario used across every capture, so the visitor can follow one shopper through the system: the GrindCTRL demo store, the Premium Ringer Tee (the garment the live `/try-on` demo already uses), a shopper named Salma asking about sizing, an AI answer grounded in store knowledge, a handoff to the team, and the merchant's inbox and report reflecting it.

## 3. Design direction

- Keep the brand: warm stone background, ink text, the existing amber accent, Manrope display and Inter body, IBM Plex Sans Arabic. The GrindCTRL logo is not touched.
- Signature: **one shopper, four real screens.** The same shopper and product appear in each captured frame, joined by one solid signal rail with four numbered stops (the numbers encode a real sequence: signal, context, action, outcome). No thin arrows, no glow, no abstract AI imagery.
- Screenshots sit in quiet frames (hairline border, layered soft shadow, 12 to 16px radius). Browser or phone chrome appears only around a real product capture.
- Motion: one short entrance for the hero frames and the rail (GSAP timeline, transform and opacity only, under 700ms total), skipped under reduced motion. The hero is fully understandable with JavaScript disabled.
- Copy explains visuals in one or two lines. No section is words-only.

## 4. Section plan

| # | Section | Purpose | Primary visual asset | Supporting copy | Interaction | Mobile treatment | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Hero | Say in one viewport that GrindCTRL connects shopper signals, conversations, leads, operations and outcomes, with try-on as one capability | Composition of four real captures: storefront try-on (signal), Store Chat answer with handoff (context), team inbox with the handed-off conversation (action), Store Chat report (outcome) | Existing platform headline; two lines naming the connected system; CTAs "See it working" (to the proof section) and "Book a call" | Frames enter in sequence once; nothing required to understand | Headline, copy, CTAs, then the four frames stacked with their stop labels, each at readable width using mobile crops | `TryOnDemo`, `MessengerPanel`, `ConversationsPanel`, `MessengerOverview`; demo data label |
| 2 | Trust band | Truthful proof without customer logos (none are approved) | Official Shopify mark plus the Arabic/English and managed-setup facts | One line | None | Wraps to two lines | `public-integrations.ts` (Shopify implemented) |
| 3 | One system | Show the five connected parts as one flow | Five nodes, each with a real thumbnail crop: storefront, conversation, captured contact, handoff and job status, report | Node titles plus one short line each; maturity shown where a part is foundation only | None | Vertical rail | Same captures as the hero; register statuses |
| 4 | See it working (product proof) | Let the visitor switch between Shopping, Conversations, Leads, Operations, Reporting | One large real capture per tab | Two or three short captions per tab and a status line (live, foundation, demo data) | Tabs (keyboard and touch), content swaps without layout shift | Tabs become a scrollable row of 44px chips; capture shown full width | Leads tab shows captured contacts in the real inbox and states that pipeline and CRM sync are not live; Reporting uses real report components with demo data |
| 5 | Try-on | Keep try-on compelling but subordinate | Real `TryOnDemo` interface with the real garment; real before and after once the owner provides consented imagery | Input guidance, privacy fact (results kept about 30 minutes), link to the live demo | Link to `/try-on` | Stacked | `lib/try-on/persistence.ts`, cleanup workflow |
| 6 | Integrations | Replace text chips with a legitimate integration directory | Cards grouped by job (Commerce, Channels, Automation, CRM and data, AI infrastructure), each with the official mark, name and depth label | One line per group | None | Two-column grid | `public-integrations.ts`; marks from `simple-icons` |
| 7 | Final CTA | Platform-level close | Small echo of the four-stop rail | One line about the connected system; "See it working" and "Book a call" | None | Stacked buttons, full width | n/a |
| 8 | Footer | Describe the whole platform | Logo | "Managed AI commerce systems for online stores." (EN and AR) | Existing links and toggles | Wraps | n/a |

Sections removed because they were words standing in for visuals: the connected-system table, the render-receipt figure, the platform-pillars ledger, the text journey tabs and the platform-evidence cards. Their honest maturity statements move into the captions of sections 3 and 4.

Header: add a "See it working" link beside Sign in and Book a call; the Product menu keeps its existing pages (Try-On, Conversations, Operations, Integrations). No new thin pages.

## 5. Build order and gates

1. Capture rig and script: `app/dev/visual-proof/*` (404 in production), `MessengerPanel` gains a preview-only `previewMessages` input, the try-on usage overview is split into a presentational component so it can render demo data. Output: `public/landing/proof/<scene>-<locale>.webp` at 1x and 2x plus mobile crops.
2. Hero, then browser inspection at 1440, 1024, 768, 390 and 320 in both locales. Gate: a visitor who sees only the first viewport understands GrindCTRL is broader than try-on.
3. Integrations directory.
4. One system and See it working.
5. Try-on section, final CTA, footer.
6. Before and after screenshots in `docs/visual-qa/`, mobile performance comparison (LCP, CLS, JS, largest media), full test suite, build, deploy, production recheck.

## 6. Owner decisions needed

1. **Real try-on imagery.** Provide one or more consented shopper or model photos and two to four garment images you have rights to, or approve AI-generated model imagery clearly labelled as such. With those, real results are generated through the live pipeline (a few cents of provider cost) and replace the interface-only try-on visual.
2. **WhatsApp and Instagram depth.** The repository has no WhatsApp or Instagram integration code, so the site labels them "Planned". If client WhatsApp automations already run through n8n in production, confirm and they can be labelled "Automation layer".
3. **Customer logos.** None are approved, so no logo wall is shown.

## 7. Acceptance checks carried from V4

Fail if the hero implies try-on only, the footer or final CTA is try-on only, integrations are plain or repeated text, proof sections are mostly words, any logo, metric or dashboard is fake or presented as real when it is demo data, mobile overflows horizontally, screenshots are too small to read, the hero needs JavaScript to be understood, or the logo changes.
