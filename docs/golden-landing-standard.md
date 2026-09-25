# Golden Landing Standard

This is the single reference for the public marketing/landing surface of
`apps/web-next`: which primitives to reuse, what the brand system's rules
are, and how compliance is checked automatically. It exists because a
change once shipped on `/pricing` and went unnoticed for a while — nothing
running anywhere knew that page existed to check it against. The fix isn't
a document nobody re-reads; it's this doc plus the test suites in
`apps/web-next/e2e/golden-standard-*.spec.ts` and
`apps/web-next/app/golden-landing-standard.test.ts`, which make drift a
failing check instead of something only caught by luck.

**Default rule: reuse what's here. Only build something new when nothing
here can express the requirement**, and say explicitly why in the PR/commit
— see "When to add something new" at the end. AGENTS.md's "Landing and
marketing pages" section is the enforceable, agent-facing version of this
rule; this doc is the detail behind it.

## The golden page set

`apps/web-next/e2e/golden-pages.ts` is the single list every check in this
suite reads from — adding a marketing page there is what puts it under the
standard. Today: home, pricing, roi, shopping, conversations, operations,
integrations, security. `/try-on` and `/sign-in` are public but intentionally
outside this list (their own product surfaces, see AGENTS.md); the dashboard
is a different design system entirely (Mantine 9 — see AGENTS.md's Mantine
section) and is never part of this standard.

## Composition primitives

`components/marketing/page-primitives.tsx` is the shared shell, deliberately
built on the same contract [Launch UI](https://github.com/launch-ui/launch-ui)
(MIT) uses for its own block components: small components, fully-optional
props, a `false` sentinel to hide a slot, one fixed vertical-rhythm wrapper
per section. It exports:

- `MarketingPage` — the page shell: `AmbientBackground` + `SiteHeader` +
  `<main>` + `SiteFooter`. Every golden page except pricing and roi (which
  predate this file and hand-roll the same four pieces directly — the one
  documented exception, not a pattern to copy for a new page) composes this
  rather than assembling its own header/footer/background.
- `ProductHero` — the page-level hero: eyebrow badge, `h1`, lead paragraph,
  `CtaRow`.
- `ProductSection` — a titled content section with the standard
  eyebrow/heading/body header.
- `CtaRow` — the book-a-call primary button plus optional secondary links,
  with `trackClick` wired in.
- `NotLiveList` — the honesty list: what's built vs. what isn't yet, used
  wherever a page would otherwise imply more than the product currently does.

The home page (`components/landing/site-landing.tsx`) uses the same
container width, spacing rhythm, `Eyebrow`, and CTA button styling as
`page-primitives.tsx`, but keeps its own section markup rather than routing
through `ProductSection` — its hero and its `#see-it-working`-style proof
sections carry real screenshots and bespoke layout that don't fit the
single-column `ProductSection` shape. That's a legitimate, understood
exception, not license to hand-roll a new one elsewhere.

Smaller reusable pieces, all in `components/landing/`:

- `Eyebrow` — the small label above a section heading. Centralizes the
  Arabic-specific typography (drops uppercase/tracking, bumps size) so it
  isn't reimplemented per file.
- `PlatformPillars` — a numbered, bordered list of items with a status
  badge. Reused 3+ times; extend it with new items rather than building a
  parallel numbered-list component.
- `ConnectedSystemMap` — a 3-column row table (shopper → product →
  business), with a direction-aware connector icon between columns.
- `PlatformEvidenceSequence` — a card grid for "what's real vs. what's
  planned" evidence, each card an `.gc-landing-card`.
- `JourneyProofTabs` — a `Tabs`-based stage walkthrough.

## Container, spacing, and typography

- Container: `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`, hero and
  normal sections alike — no narrower container exists on a golden page.
  Guarded by `golden-landing-standard.test.ts`.
- Section vertical rhythm varies deliberately by page density (roughly
  `py-12` to `py-28` depending on section weight) — match the nearest
  existing section's rhythm rather than picking an arbitrary value.
- Headings: `text-[28px] ... sm:text-4xl lg:text-[44px]` for `h2`s is the
  standard section-heading scale; the home hero's `h1` is the one place a
  larger `clamp()` scale is used.

## Brand tokens

Defined once in `apps/web-next/app/globals.css` (`:root`/`.light`/`.dark`
blocks) — read them from there, never restate a hex/oklch value in a
component or in this doc. Warm cream/charcoal identity; no gradient text,
no side-stripe borders, no nested cards, no em dashes in copy (see
`DESIGN.md`).

## Motion vocabulary

Small and deliberate. `golden-landing-standard.test.ts` asserts these four
classes still exist in `globals.css`; if one is ever renamed, update the
test in the same change:

- `.gc-fade-in-up` — entrance fade+rise for hero content, CSS keyframe only.
- `.gc-scroll-reveal` — scroll-linked reveal via `lib/landing/use-scroll-reveal.ts`
  (GSAP + ScrollTrigger, adds `.in-view`) with a native `animation-timeline:
  view()` enhancement where supported. This is the reveal primitive — a new
  scroll-triggered effect should use this hook, not a second one.
- `.gc-spotlight` — a cursor-following highlight via one delegated pointer
  listener (`components/gc-spotlight.tsx`, mounted once in the root
  layout), baked into the shared `Card` primitive. Add it to any bordered
  card or row that should feel interactive. Do **not** combine it with
  `.gc-card-hover` on a row that shares a border with siblings inside an
  `overflow-hidden` list (the hover lift clips against the parent's rounded
  corners and jumps against the next row) — see `PlatformPillars` for the
  spotlight-only pattern.
- `.gc-card-hover` — `translateY(-2px)` + border/shadow lift on hover, for
  standalone cards only (see above).

All four respect `prefers-reduced-motion: reduce` (see the consolidated
block in `globals.css`, guarded by `app/globals.motion.test.ts`).

### Approved story motion set (site v15)

A paced product story cannot be built from reveal classes alone, so the v15
pages (landing, try-on, pricing) also use the story motion set in
`globals.css`, under "Site v15: the approved story motion set" and "Site
v15: the landing story". It is the prototype's own vocabulary
(the prototype in the site-v15 handoff bundle, whose notes are in
`apps/web-next/docs/handoff/site-v15`), renamed with a `gcs-` prefix:

- Entrances and dialogs: `.gc-anim-fade`, `-menu`, `-in`, `-rise`,
  `-reveal`, `-swap`, `-drop`, `-open` (keyframes `gcs-fade` … `gcs-open`).
- Loops that show something is live: `.gc-anim-invite`, `-typing`, `-ring`,
  `-live`, `-spin`, `-scan`, `-flow`, and the background wiring
  (`.gc-wire-pulse`, `.gc-wire-node`, `.gc-wire-step`), which run only while
  on screen and in a visible tab.
- Story keyframes the scene scripts name inline: `gcs-ping`, `gcs-twinkle`,
  `gcs-nudge`, `gcs-float`, `gcs-msg`, `gcs-scan-seq`, `gcs-scan-once`, and
  the restartable pairs `gcs-down-a/b`, `gcs-up-a/b`, `gcs-tap-a/b`,
  `gcs-prog-a/b`, `gcs-type-a/b`, `gcs-flow-a/b`, `gcs-oflow-a/b`,
  `gcs-grow-a/b`, `gcs-pop-a/b` (switching between the identical halves of
  a pair is how a beat replays a tap, a wipe or a progress bar).
- Scroll pacing is not an animation class: `components/landing/story`
  moves between beats with a quartic tween of `window.scrollTo` and writes
  per-frame transforms straight to elements, never through React state.

Under reduced motion every one of these stops: the entrances resolve to
their end frame, the loops stop, and the landing story does not pace at all
(its scenes become ordinary sections, each showing its final beat; the same
happens on screens shorter than 560px). Blocks after the story rise 34px
into place once as they enter the view (`[data-reveal]`), except under
reduced motion.

**Reaching for a new motion/visual-effect library:** check the above first.
React Bits (reactbits.dev, MIT + Commons Clause, free via its own public
shadcn registry — `npx shadcn add @react-bits/<Name>`) is a reasonable
source for something genuinely missing, but several of its strongest
components need the `motion` package (not `framer-motion`, a different,
unrelated package despite the similar API) — check its registry's declared
`dependencies` before reaching for one, and prefer GSAP (already a
dependency, already used by `use-scroll-reveal.ts`) when the effect is
simple enough to write directly rather than adding a new runtime dependency
for it.

## Responsive

Checked by `e2e/mobile-overflow.spec.ts` at every documented breakpoint —
320/360/390/430/768/1024/1280/1440 — across every golden page, in both
locales: no horizontal overflow, and the resolved `dir`/`lang` on the
correct root element actually matches the requested locale (so a test can't
silently pass by checking English twice).

## RTL / i18n

- Logical properties throughout (`ps-`/`pe-`/`inset-inline-*`), never
  `left`/`right`.
- A handful of elements are directional on purpose (an arrow that must
  point at reading-direction "next") and mirror via Tailwind's `rtl:`
  variant. **Tailwind v4 implements `scale-x-*`/`rotate-*` utilities via
  the native CSS `scale`/`rotate` properties, not `transform`** — check
  `getComputedStyle(el).scale` / `.rotate`, not `.transform`, when writing
  a new check for one (confirmed against the real compiled stylesheet, not
  assumed — see `e2e/golden-standard-rtl.spec.ts`'s own comment for how
  this was verified). Every existing `rtl:` mirror is checked there.
- Arabic gets the `--font-arabic` stack and drops Latin-only
  letter-spacing/uppercase automatically via `:lang(ar)` in `globals.css` —
  no manual class needed per component.

## Accessibility

`e2e/golden-standard-a11y.spec.ts` runs an axe-core scan (WCAG 2.2 A/AA
tags) against every golden page in both locales. axe is a floor, not a
substitute for a real screen-reader pass, but it catches the mechanical,
regressable failures: contrast, missing labels, invalid ARIA, broken
heading order. Any violation it reports on a golden page is real — fix the
component, don't loosen the check.

## Visual regression

`e2e/golden-standard-visual.spec.ts` screenshots the two highest-traffic,
highest-risk pages (home, pricing) at 390/1024/1440px, both locales, light
theme, with `prefers-reduced-motion: reduce` emulated so the aurora/entrance
animations don't introduce nondeterministic pixels. Extend `VISUAL_PAGES`
in that file, deliberately, as a page earns the baseline-maintenance cost —
this is not meant to cover every golden page.

Playwright names baseline files with the OS in the filename
(`*-chromium-win32.png` vs. `*-chromium-linux.png`), so a Windows-local
baseline and a CI-generated Linux baseline never collide or get compared
against each other — each platform keeps and compares against its own. The
committed `win32` baselines were generated and visually reviewed locally;
the CI-run `linux` baselines still need seeding once via
`.github/workflows/update-visual-baselines.yml` (`workflow_dispatch`,
manual only — visual baselines are never auto-committed) before the visual
spec in `next-release-check.yml` will pass on a PR (until then, expect it to
fail once with "no baseline, new snapshot written" — that failure is
informational on the first run, not a regression).

## How this is enforced

| Check | File | Runs |
|---|---|---|
| Composition/consistency (source-text) | `apps/web-next/app/golden-landing-standard.test.ts` | `npm test` (vitest) |
| Responsive overflow, all breakpoints | `apps/web-next/e2e/mobile-overflow.spec.ts` | `npm run test:golden` (Playwright), CI |
| Accessibility (axe, WCAG 2.2 AA) | `apps/web-next/e2e/golden-standard-a11y.spec.ts` | same |
| RTL icon mirroring | `apps/web-next/e2e/golden-standard-rtl.spec.ts` | same |
| Visual regression | `apps/web-next/e2e/golden-standard-visual.spec.ts` | same |

CI runs the Playwright suite against the real production Docker candidate
`next-release-check.yml` already builds and starts for the release-checks
job (see that workflow's "Golden landing standard checks" step) — not a dev
server — so visual baselines come from the same Linux/Docker environment
every time, and the other checks run against exactly what would ship.

Run locally from `apps/web-next`: `npm run test:golden` (all four Playwright
specs) or `npx playwright test <file>` for one. `npm run
test:golden:update-visual` regenerates the local (Windows, if that's what
you're on) visual baselines after a deliberate, reviewed visual change —
look at the diff before committing new baseline images.

## When to add something new

Ask, in order:

1. Does an existing primitive above already express this, maybe with new
   props or content? Extend it.
2. Does `page-primitives.tsx`'s contract cover the shape (a titled section,
   a hero, a CTA row, an honesty list) but no concrete component exists yet?
   Add one there, following the same fully-optional-props /
   `false`-to-hide / single-Section-wrapper contract — that keeps it
   reusable by the next page instead of one more one-off.
3. Genuinely nothing above fits (a new kind of interaction, not just new
   content)? Build it, matching the brand tokens and motion vocabulary
   above, and add it to `golden-pages.ts`/the relevant spec if it's a new
   page, or note in the PR why none of the existing patterns applied. Don't
   reach for a new external component library before re-reading the motion
   vocabulary section above — the two real gaps this project has found so
   far (a cursor spotlight, a scroll reveal) both turned out to already
   exist here.
