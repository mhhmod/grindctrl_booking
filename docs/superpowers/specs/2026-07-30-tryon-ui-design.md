# Try-On UI: admin preview, gradient control, shopper result and saved photos

Date: 2026-07-30
Status: approved in brainstorming, ready for planning

## Problem

Five separate complaints, three merchant-facing and two shopper-facing.

The Shopify admin settings form cannot show what it configures. A merchant
changes an icon gradient, a loading style or a catalog pill and has no way to
see the result short of saving and opening a storefront. The one preview that
exists shows a fraction of the configurable surface.

The icon gradient is edited as two hex values, "start" and "end". Choosing two
colours that work together is a designer's judgement. Merchants either leave
the default or produce something that looks wrong.

On the shopper side, the generated image is the product, and it is rendered at
panel width with no way to see it larger. The garment competes with it for
attention. And a shopper trying a second product re-picks the same photo from
their device every time.

## Decisions

Recorded from the brainstorming session, with the reasoning that drove them.

**Preview shows every configurable screen, not two.** The reference design has
two tabs. The settings control five distinct screens, and the three that a
two-tab preview omits (the product-page button, the catalog pill, the loading
animation) are exactly the ones a merchant cannot otherwise inspect. Five tabs
cost one row of chrome and close the gap entirely.

**Gradient: presets, then one colour, then raw.** The request was "simpler" and
"more freedom", which pull apart. Presets serve the first, a single brand
colour with a derived partner stop serves the second, and keeping the existing
two hex pickers under Advanced makes the change purely additive: no merchant
who already tuned a gradient loses it.

**The result is the hero, not half of a comparison.** Explicitly not
side-by-side. The generated image takes the full panel width, centred. The
garment drops to a small labelled reference on the leading edge. Tapping the
result opens it full-screen.

**Full-screen means the whole screen.** Not a larger in-panel view. This
requires the storefront iframe to expand, which puts the theme extension in
scope and makes this a two-deploy change.

**Saved photos live on the device only.** IndexedDB in the widget, never on our
servers. The app stores zero images today (`persistence.ts`: "images are never
stored, so customer photos stay ephemeral") and this preserves that. Server
storage would mean holding customer body photos: consent, retention, deletion,
GDPR, Shopify disclosures, and a materially worse breach. Rejected.

## Scope

### 1. Admin preview panel

Two columns at >=1024px: settings left, preview right, `position: sticky` so it
stays visible while the form scrolls. Below 1024px the preview stacks above the
settings, unpinned.

Five tabs, each rendering the real component driven by live form state rather
than a static image:

| Tab | Shows | Settings it makes visible |
| --- | --- | --- |
| Button | Product-page button | label, icon size, icon gradient, accent colours, radius |
| Catalog | Catalog grid pill | catalog label, icon/font/padding sizes, radius |
| Upload | Upload step | header copy, upload info text, theme |
| Generating | Loading state | loading style, loading steps |
| Results | Result screen | result buttons, disclaimer, result layout |

Lives in `components/try-on/settings-controls.tsx`, the form shared by the
Shopify embedded admin and the dashboard, so both surfaces get it from one
implementation.

### 2. Gradient control

Three tiers in one control:

1. A row of curated preset pairs. One click.
2. "Use my colour": a single colour input plus an intensity slider. The second
   stop is derived by hue rotation and lightness lift in oklch, with intensity
   controlling the distance between stops.
3. "Advanced": the existing two hex inputs, unchanged.

All three write the same stored `iconBgFrom` and `iconBgTo`, so the widget, the
storefront extension and the config route are untouched.

The derive is a pure function, `deriveGradient(baseHex, intensity)`, unit
tested independently of the UI.

### 3. Shopper result screen

Generated image full panel width, centred, dominant. Garment reduced to a
thumbnail with a "Trying on: <product>" label on the leading edge. Actions
below. Never equal weight, never side by side.

### 4. Full-screen zoom

Tapping the result opens a full-viewport viewer: pinch and wheel zoom, drag to
pan, smooth open and close.

The widget renders inside an iframe on the merchant's product page, so a
viewer that fills the iframe still only fills the iframe. The panel posts a
message to the parent requesting expansion; `tryon.js` in the theme extension
expands the iframe to the viewport and restores it on close. The existing
`EmbedFrameBridge` already does height messaging, so this extends an
established channel rather than inventing one.

Built on the native `<dialog>` element: focus trap, Escape to close and
inertness come free rather than being hand-rolled.

### 5. Saved photos

The shopper's chosen photo is cached in IndexedDB in the widget. On a later
product they are offered their recent photos as thumbnails instead of a file
picker. A merchant setting, on by default, controls whether this is offered.

Browsers partition third-party iframe storage per top-level site, so saved
photos are scoped to one merchant's store and do not follow the shopper across
stores. This is a browser rule, not a design choice, and it is the
privacy-preferable behaviour. Safari may evict the cache; the flow degrades to
today's file picker rather than breaking.

## Cross-cutting requirements

These are acceptance criteria, not polish.

**Bilingual.** Every new string exists in English and Arabic. Merchant-facing
strings go in `lib/try-on/settings-copy.ts`, shared by the Shopify admin and
the dashboard. Shopper-facing strings go in the try-on dictionary and follow
the shopper's locale, which is resolved separately from the merchant's. The
existing dictionary-parity test is extended to cover the new keys: it fails if
Arabic ever has fewer keys than English, which is what stops a half-translated
feature shipping.

**RTL.** Logical properties only. The result reference thumbnail sits on the
leading edge, so it is left in English and right in Arabic with no mirrored
special case. Zoom controls and the close affordance follow the same rule.

**Theming.** Everything new reads the merchant's tokens: accent colour,
`--gc-control-radius` for pill controls, `--radius` for panels, and the
light/dark widget theme. The zoom overlay and saved-photo chips are themed. No
new hardcoded colour.

**Saving.** The saved-photos toggle goes through the same path as every other
setting: a `tryon_settings` column, the shared form, the dashboard save action,
the proxy config route, and the admin settings API. That API whitelists fields
explicitly and silently drops anything not listed, a trap already hit once
during the Arabic label work.

**Parity.** The preview and the gradient control live in the shared form, so
the dashboard and the Shopify admin cannot drift.

**Motion.** Additions respect `prefers-reduced-motion`, which reduces rather
than eliminates: the zoom opens without travel under that setting instead of
not opening. Guarded by the existing motion test.

## Out of scope

- Server-side photo storage, and any photo library that follows a shopper
  across stores.
- Side-by-side result comparison.
- Translating theme preset names.
- Auto-following preview that jumps to whatever field is focused. Additive on
  top of the tabbed preview later, not instead of it.

## Risks

**Two deploys.** Items 1, 2, 3 and 5 ship with the web app. Item 4's parent
half ships with the theme extension via `npx shopify app deploy` from the
owner's machine. Until that second deploy the zoom is iframe-sized. The panel
must therefore work correctly whether or not the parent supports expansion, and
degrade to a panel-sized viewer when the message goes unanswered.

**Storage availability.** IndexedDB can be unavailable or evicted in private
browsing and under Safari's policies. Every saved-photo path needs a working
fallback to the file picker.

**Preview fidelity.** A preview that renders the real components is only
trustworthy if it uses the same code paths. Any divergence makes it a lie that
is worse than no preview.

## Verification

- Unit: `deriveGradient` across hues, intensity bounds, and invalid input.
- Unit: dictionary parity for every new key, English and Arabic.
- Unit: saved-photo store with IndexedDB unavailable.
- Browser: preview tabs reflect live settings changes; no horizontal overflow
  at 360, 390, 430, 768, 1024, 1440; RTL renders with the thumbnail on the
  leading edge; zoom opens, pans, and closes by Escape and by the close
  control.
- Full suite, lint, typecheck and a production build before deploy. The build
  is not optional: it has already caught a CSS error that tests and typecheck
  both missed.
