# GrindCTRL design-system audit (pre-V5)

Inspected before any V5 code changes, per the V5 brief §8. Source of truth is `apps/web-next/app/globals.css` (Tailwind v4, `@theme inline`) plus `components/ui/*` (shadcn-derived primitives) and `components/brand-marks.tsx`. Nothing below is invented — every value is read directly from the current codebase.

## Colors

Warm, near-monochrome palette in OKLCH. No bright/blue/purple accent is part of the core system — the "color" is really tone and contrast, not hue.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `oklch(0.945 0.007 75)` — warm cream | `oklch(0.135 0.004 70)` — near-black warm ink | page background |
| `--foreground` | `oklch(0.235 0.006 60)` — charcoal ink | `oklch(0.94 0.008 78)` — warm off-white | body text |
| `--primary` | same as foreground (charcoal) | same as foreground (off-white) | primary buttons — **ink, not a saturated brand color** |
| `--card` / `--popover` | `oklch(0.965 0.007 78)` | `oklch(0.175 0.005 68)` | panels |
| `--muted` / `--secondary` / `--accent` | `oklch(0.905 0.008 76)` (all three equal) | `oklch(0.205 0.006 64)` | quiet fills |
| `--border` / `--input` | `oklch(0.86 0.009 76)` | `oklch(0.26 0.006 66)` | hairlines |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | errors only |

Landing-specific overlay tokens (`.gc-landing-root`, defined globally since Jul 2026): `--gc-landing-border/panel/panel-strong/panel-subtle/shadow`, plus two accent-icon pairs (`--gc-input-icon-*` blue-ish, `--gc-output-icon-*` violet-ish, both low-saturation) used narrowly for input/output iconography, not as a general accent.

**One orphaned token pair**: `--gc-scan-from`/`--gc-scan-to` (`#ff9a3d`→`#ffd76e`, warm amber-gold) exists only in `components/landing/try-on-reveal-figure.tsx`, which is no longer rendered anywhere on the live site since this session's hero rebuild. There is currently no live amber/gold accent anywhere on the site. If V5 work wants a warm highlight color for interactive/selected states (e.g., Antla-style selectable events), this pair is the only precedent and should be revived deliberately rather than inventing a new hue.

**Rule for V5:** no new saturated/bright hues. Selected-state or interactive-highlight treatment should use existing ink-on-cream contrast (border + shadow + scale), the existing amber pair if a warm highlight is truly needed, or the two low-saturation icon pairs — never a new blue/purple/green.

## Typography

- `--font-heading` / `--font-sans`: `"Manrope Variable", "Inter", "Segoe UI", sans-serif`
- `--font-arabic`: `"IBM Plex Sans Arabic", "Manrope Variable", "Segoe UI", sans-serif`
- Arabic gets its own tracking rule: `.gc-landing-root:lang(ar) :where(h1,h2,h3)` and `:where(p,li)` strip Latin letter-spacing, since tracking breaks Arabic letter-joining (established this session, verified in golden-standard-rtl tests).
- Hero headline scale: `text-[clamp(2.1rem,6.4vw,4rem)]` — fluid, not fixed per-breakpoint jumps.
- No serif/display face anywhere in the system. **V5 constraint:** any editorial-feeling type treatment (OptiDress-style italic accent line) must stay within Manrope/Inter, not introduce a serif — GrindCTRL's typographic identity is one sans family doing all the work.

## Spacing, container, radius

- Landing container: `max-w-7xl` (not `max-w-6xl` — this was a deliberate fix earlier this session; the golden-standard consistency test in `app/golden-landing-standard.test.ts` enforces it).
- Section rhythm: `px-4 sm:px-6 lg:px-8`, vertical `py-10 sm:py-20 lg:py-28`-class values, consistent across sections built this session.
- Radius scale (all derived from one `--radius: 0.625rem`): `--radius-sm` (0.6×) through `--radius-4xl` (2.6×). Cards/panels typically use `rounded-2xl`/`rounded-3xl`; pills/badges/buttons use fully-rounded (`rounded-full`).

## Shadows

No generic "drop shadow everywhere" — shadows are sparse and specific:
- `--gc-landing-shadow`: a soft, large, low-opacity spread (`0 22px 70px -46px oklch(.. / 42%)` light / `0 24px 80px -48px oklch(0 0 0 / 65%)` dark) used for landing panels only.
- Proof-composition frames (`hero-system.tsx`'s `FRAME` constant): `shadow-[0_1px_2px_rgb(0_0_0/0.05),0_18px_40px_-18px_rgb(30_20_10/0.3)]` — a tight contact shadow plus a soft ambient one, warm-tinted (not neutral black).
- Card hover (`.gc-card-hover:hover`): `0 18px 48px -30px color-mix(in oklch, var(--foreground) 30%, transparent)`.

**Rule for V5:** reuse the `FRAME` shadow recipe (tight contact + soft warm ambient) for any new real-screenshot frame, rather than inventing a new shadow per section.

## Buttons

`components/ui/button.tsx` variants: `default` (primary/ink), `secondary`, `outline`, `ghost`, `link`, `destructive`. Sizes: `sm`/`default`/`lg`/`icon`. Landing CTAs consistently use `size="lg"`, `rounded-full`, `h-12`, with a hover micro-interaction (`hover:-translate-y-0.5 hover:shadow-md`, disabled under `motion-reduce`).

## Motion tokens

Exactly four approved classes exist in `globals.css` (enforced by `app/golden-landing-standard.test.ts` — any new motion idiom must be added there deliberately, not invented ad hoc):
- `gc-fade-in-up` — entrance, 0.5s ease-out, used with staggered inline `animationDelay`.
- `gc-scroll-reveal` — scroll-triggered reveal, 360ms `cubic-bezier(0.22,1,0.36,1)`.
- `gc-spotlight` — cursor-tracked radial glow on card hover (280px circle at `--gc-mx/--gc-my`, set by a global pointer listener).
- `gc-card-hover` — lift + shadow + border-color shift on hover/focus-within.

All four are wrapped in `@media (prefers-reduced-motion: reduce)` kill-switches (`.gc-animated, .gc-animated *` block under `reduce`), verified this session via `page.emulateMedia({reducedMotion:'reduce'})` in the visual-regression suite.

**Rule for V5:** any new interaction (e.g., an Antla-style click-to-swap hero) should use plain opacity/transform transitions consistent with these four, not a new animation library. GSAP is mentioned in the earlier V4 plan doc as a possibility for the hero's one-time entrance sequence but has not been added as a dependency — introducing it is a real, discussable dependency decision, not a given.

## Icon language

- UI icons (chevrons, arrows, checks): `lucide-react` (already a dependency).
- Brand/integration marks: `components/brand-marks.tsx`, built on `simple-icons` — `makeMark(siX)` factory pattern, exported per-brand (`ShopifyMark`, `StripeMark`, `LinearMark`, `OpenRouterMark`, etc.) plus a `BRAND_MARKS` lookup record keyed by brand name. This is the correct, extensible mechanism for V5's Section 9 integration marks — extend this file, don't build a parallel icon system.
- No emoji anywhere in the codebase as UI icons (grep-verified this session).

## Logo usage

- `GRINDCTRL` wordmark + a knot/link mark (`components/landing/site-header.tsx` / footer) — not touched by any work this session, not to be touched by V5 per the brief ("the logo changes" is a zero-tolerance failure condition).
- No repeated/decorative use of the GrindCTRL wordmark as a design element anywhere in the current build — the "no text pretending to be logos" rule in the V5 brief is about *competitor* integration marks, not GrindCTRL's own mark, and the current build already doesn't violate it for its own brand.

## Dark/light surfaces

Full dark-mode token set exists and is live (`.dark` class, see color table above); the landing pages currently force light theme only for visual-regression purposes (`golden-standard-visual.spec.ts` — "light theme only" per its own comment), but the app itself supports both. Any new V5 section must define both light and dark values for new custom properties, matching the existing `:root` / `.dark` pattern — not just light.

## Breakpoints

No custom `--breakpoint-*` overrides in `@theme inline` — Tailwind v4 defaults apply: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536. The hero's stacked-to-absolute composition switch happens at `xl` (1280px), matching the project's own responsive-QA checklist (320/360/390/430/768/1024/1280/1440), which V5 sections must continue to verify against.

## What V5 must NOT introduce

- A new accent hue (blue/purple/green/neon) as a primary interactive color.
- A serif or second display typeface.
- A new shadow recipe that doesn't follow the tight-contact + soft-warm-ambient pattern.
- A new animation library without an explicit decision (GSAP is discussable, not assumed).
- A parallel icon/brand-mark system outside `brand-marks.tsx`.
- Any change to the wordmark/logo mark.
