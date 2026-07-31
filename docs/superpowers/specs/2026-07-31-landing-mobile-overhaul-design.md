# Landing page, mobile UX, and pinned-preview overhaul

Date: 31 July 2026
Status: approved, ready for implementation planning

## Problem

Six defects were reported from a phone and confirmed against the code. They fall
across two unrelated surfaces, which is why they are described together but must
not be implemented as one blob.

**Public landing page**

1. The top bar is empty below 640px. The wordmark, sign-in, book-a-call and the
   whole nav are each hidden behind `sm:` or `lg:` breakpoints, and no menu
   button exists at any width. What remains is a bare logo mark and two toggles.
2. Text overflows the viewport on a phone.
3. The "how it works" step markers read as ambiguous: a hairline ring almost the
   same colour as the page, with the step number floating beside it as a second,
   disconnected mark.
4. The icons themselves are abstract rather than depicting the thing they name.
5. The try-on example only reveals itself if the visitor discovers a drag handle
   and drags it. Most never do, so most never see the product's whole point.

**Try-on settings (dashboard *and* Shopify embedded admin)**

6. The live preview is pinned with `sticky top-0`. After it grew to five tabs it
   became tall enough that controls scrolled beneath it and stayed hidden.

A seventh reported defect, sign-in redirecting to the marketing home page instead
of the dashboard, is already fixed and tested on the working tree. It is out of
scope here and only needs committing.

## Out of scope

The AI-agent sandbox, the pricing page, and the phase-1.5 App Proxy verification
work in `PLANS.md`. None of them are touched.

## Decisions

| Area | Decision |
|---|---|
| Mobile top bar | Wordmark and the primary CTA stay visible; a menu button holds everything else |
| Language and theme | Removed from the top bar, moved into the menu sheet and kept in the footer |
| Step markers | Charcoal squircle tile, cream icon knocked out, oversized ghost numeral behind |
| Step icons | Literal drawings of the thing named, replacing the abstract marks |
| Try-on example | Passive looping animation; the drag slider is deleted outright |
| Pinned preview | Container queries, not viewport breakpoints; preview gets its own column |

### Why the CTA stays visible

A bare hamburger hides the conversion path behind a tap. On a marketing page that
is a measurable cost, so the one action that earns money stays on screen and the
navigation folds away instead.

### Why the slider is deleted rather than reworked

The existing `BeforeAfterSlider` is well built — RTL-aware clip maths, pointer
capture, full keyboard support, roughly 170 lines. None of that matters if the
interaction is never discovered. Replacing it with something that plays on its
own removes the code and the defect together.

The visitor is not being asked to try anything here. The animation communicates
"this is how the garment will look on you"; it is not an interactive try-on, has
no thumbnails, no upload and no gate. This was explicitly narrowed during design:
a live render for anonymous landing traffic would cost $0.03–$0.068 per visitor
against no billable shop, and would carry face-image consent duties.

### Why container queries

`TryOnSettingsControls` has two mounts: `components/dashboard/tryon-settings-panel.tsx`
and `components/shopify/admin-settings.tsx`. The Shopify one runs inside an
iframe, where viewport-based rules describe the wrong box:

- `lg:` measures the iframe, so a merchant on a wide monitor can fall below the
  breakpoint because Shopify's own navigation consumes the width.
- `vh` measures the iframe. If App Bridge sizes the iframe to its content, the
  iframe never scrolls — the parent document does — so `sticky` is inert and any
  viewport-height rule never fires.

Container queries let the component respond to the width it actually has, and
neither caller needs to know about the other. Tailwind 4.1.11 supports them with
no plugin.

## Design

### Mobile navigation

`SiteHeader` is extracted from `site-landing.tsx` into its own component; that
file is currently 35KB and holds several unrelated concerns.

Below `lg` the bar carries the wordmark, the "Book a call" button, and a menu
button. The menu is a Radix dialog — already a dependency, so focus trap, Escape
handling and scroll lock are inherited rather than written. It opens from the
inline-end side so it mirrors correctly in Arabic without a direction-specific
branch. Contents in order: the four nav links, sign-in, a divider, then the
language and theme controls. Every target clears 44px.

The footer keeps its own language and theme controls, because that is where
people look for them.

### Step markers

A `StepMarker` component replaces the markup currently repeated inline for each
of the three steps. It renders a charcoal squircle with the icon knocked out in
cream, and the step numeral set large and ghosted behind the heading.

The icons become literal depictions — a garment, a photo upload, a completed
purchase. Preference order: a suitable literal icon from the libraries already
installed (HugeIcons, Lucide, Simple Icons), and only where none depicts the
subject plainly enough, a custom SVG drawn to the same 24px grid and stroke
weight as its neighbours. Mixing weights across the three markers is the failure
mode to avoid. The palette stays warm
monochrome: `--primary` is the charcoal foreground, there is no chroma accent in
this system, so these marks earn their presence through shape and contrast rather
than colour.

### Try-on animation

`BeforeAfterSlider` and its three i18n strings (`heroSliderLabel`,
`heroSliderValue`, `heroSliderHint`, in both languages) are removed.

The replacement is a single `<figure>` driven by CSS keyframes: the garment
drifts in from the inline-start side, settles onto the figure, the worn result
wipes across, a short caption lands, and the sequence loops. No library, nothing
running on the main thread.

Accessibility is not reduced by making it passive:

- `prefers-reduced-motion: reduce` cancels every animation and settles on the
  finished state, matching the handling already present in `globals.css`.
- The figure carries a text alternative stating the outcome, so the message
  survives without the motion.
- Nothing needs operating, so there is no keyboard interaction to preserve.

The animation starts when the section scrolls into view rather than on page load.

### Mobile overflow

The overflow has a single systemic cause. This declaration appears about twelve
times across five files:

```
text-[11px] font-semibold uppercase tracking-[0.22em]
```

Wide letter-spacing on uppercase eyebrow text overflows at 320px. In Arabic it is
worse and also wrong: `tracking` breaks cursive letter-joining, so the text is
both visually broken and considerably wider. It is currently applied regardless
of locale.

An `Eyebrow` component becomes the single definition, dropping `tracking` and
`uppercase` when the locale is Arabic. Twelve call sites collapse into it.

This fixes the cause that is visible statically. It is not assumed to be the only
offender — widths are verified empirically as described under Testing, and
anything else found is fixed in the same pass.

### Pinned preview

`TryOnSettingsControls` becomes a container context. At or above a container width
of 48rem the controls and the preview sit in two columns, with the preview sticky
inside its own column, where it cannot cover controls that are no longer beneath
it. Below 48rem it does not stick at all and scrolls away as normal content.

48rem is the point at which the controls column still holds a readable label and
input side by side; it is a starting value to be confirmed against the real panel
during the build, not a derived constant.

This removes the class of defect rather than tuning a height, which would only
relocate the breaking point the next time the preview grows.

Locale reaches the component as a prop in both mounts: the Shopify admin takes it
from the `?locale` URL parameter, the dashboard from its cookie. `Eyebrow` inside
this component reads the same prop rather than a context, so both callers work.

## Testing

The existing suite — 78 files, 261 tests, all passing — is the regression net and
must stay green.

New tests:

- `Eyebrow` drops `tracking` and `uppercase` under the `ar` locale and keeps them
  under `en`.
- `StepMarker` renders its icon, numeral and accessible name.
- The mobile menu opens, closes on Escape, and traps focus while open.
- The preview is not sticky below the container threshold.
- The animation figure exposes its text alternative and cancels animation under
  reduced motion.

Browser verification with Playwright at 320, 360, 390 and 430px in both English
and Arabic, asserting no horizontal overflow on `document.documentElement`. This
is the proof for the overflow item; a green unit suite is not sufficient evidence
for a layout defect.

## Risks

Replacing an interactive control with a passive one removes a way to inspect the
result at the visitor's own pace. Accepted: the text alternative carries the
message, and the interaction was not being discovered.

Deleting the slider strings touches `landing-i18n.ts` in both languages; a missed
key surfaces as a build-time type error rather than a runtime gap, so the risk is
contained.

Extracting `SiteHeader` from a 35KB file risks incidental breakage in unrelated
sections of that file. Mitigated by moving markup without rewriting it, and by
the existing suite.

## To verify during implementation

These are known unknowns, resolved by inspection during the build rather than
guessed at now:

- Whether the Shopify iframe is fixed-height or auto-resized by App Bridge, which
  determines whether the sticky path is reachable in that mount at all.
- Whether any overflow source exists beyond the eyebrow pattern, established by
  the Playwright width sweep.
