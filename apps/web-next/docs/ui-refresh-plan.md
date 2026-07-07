# UI Refresh Plan: warm theme app-wide, split-screen auth, Clerk dark mode, hover system

Date: 2026-07-07. Decisions locked with owner: (a) auth brand panel = typographic brand statement only, (b) warm cream/charcoal theme promoted app-wide, (c) hover style = lift + caption reveal.

Each phase is self-contained and executable in a fresh context. Copy patterns from the cited files; do not invent APIs.

---

## Phase 0: Consolidated discovery (DONE — facts below are verified, cite-checked)

**Theme architecture** (`app/globals.css`):
- Default `:root` (lines ~93-120) and `.dark` (~128-160) are pure grayscale (chroma 0). This is the "cold" theme auth + dashboard render on today.
- Warm tokens live in `.gc-landing-root` (~202-224) and `.dark .gc-landing-root` (~226-241): light bg `oklch(0.945 0.007 75)` cream / fg `oklch(0.235 0.006 60)`; dark bg `oklch(0.135 0.004 70)` / fg `oklch(0.94 0.008 78)`, card `oklch(0.175 0.005 68)`. Applied only at `app/page.tsx:26`.
- Scoping comment at globals.css ~197-201 says warm was kept off dashboard deliberately "for now" — owner has now approved app-wide.
- Arabic typography resets are scoped `.gc-landing-root:lang(ar)` (~262-273).

**Clerk** (versions verified in package.json + node_modules types):
- `@clerk/nextjs` ^6.21.3; `@clerk/themes` NOT installed.
- `<ClerkProvider>` in `app/layout.tsx:26` has NO `appearance` prop; `<SignIn>`/`<SignUp>` have NO `appearance` prop → widget renders Clerk's default LIGHT theme always. That is the white-in-dark-mode bug.
- `Appearance` type accepts `baseTheme`, `variables` (`colorPrimary`, `colorBackground`, `colorForeground`, `colorInput`, `colorInputForeground`, `colorNeutral`, `colorMutedForeground`, `colorBorder`, `colorDanger`...), `elements`, `layout` (`socialButtonsVariant`, `logoPlacement`).
- Dark mode = `next-themes` ^0.4.6, `attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}` (`components/theme-provider.tsx`). Light mode reachable via ThemeToggle, so appearance MUST be theme-reactive, not hardcoded dark.

**AuthShell** (`components/auth/auth-shell.tsx`, 96 lines):
- Two-col only at `lg:` (`grid-cols-[0.9fr_1.1fr]`, line 48). Below lg: single column with marketing list ABOVE the form (bad mobile priority).
- Decorative blur blobs `h-72 w-72` / `h-80 w-80` fixed sizes (lines 44-45).
- Clerk visual patching via arbitrary selectors `[&_.cl-card]:...` (line 80).

**Hovers**:
- `.gc-card-hover` (globals.css ~410-417) uses HARDCODED `border-color: oklch(1 0 0 / 20%)` + blue-purple shadow `oklch(0.72 0.14 265 / 38%)` — invisible/wrong on warm light theme. Must be tokenized.
- `.gc-glass` (~465-476) is UNUSED dead code — delete.
- Inconsistency: "What we automate" cards have `gc-card-hover` (site-landing.tsx ~280); identical-shape "How it works" cards (~254) do not.
- Image+text surfaces for caption-reveal: `ScreenshotFrame` (site-landing.tsx ~92-120; hero use ~233, proof use ~299).
- `prefers-reduced-motion` guard exists (~518-521) — extend it to any new animation.
- `components/ui/card.tsx` `size` prop is a no-op (dead) — do not rely on it.

**Anti-patterns (do NOT)**:
- Do not pass CSS `var(...)` strings into Clerk `variables` — Clerk computes derived shades and needs parseable concrete colors. Use hex: cream `#f0ede9`, warm charcoal `#2a2826`, warm near-black `#141210`, dark card `#1d1a17`.
- Do not use `appearance.baseTheme` string `'clerk'|'simple'` guesswork; if using a prebuilt dark theme, install `@clerk/themes` and import `{ dark }`.
- Do not add `border-left` accent stripes, gradient text, or glassmorphism (design bans).
- Do not touch `--chart-*` / `--sidebar-*` tokens beyond neutrals unless a contrast check fails.
- Do not animate layout properties; transform/opacity only; keep reduced-motion guards.

---

## Phase 1: Promote warm theme app-wide

**What**: Replace the grayscale values in `:root` and `.dark` (globals.css) with the warm values COPIED from `.gc-landing-root` (~202-224) and `.dark .gc-landing-root` (~226-241). Then delete the now-redundant token-override blocks of `.gc-landing-root` (keep the class itself and every OTHER `.gc-landing-root`-scoped rule: `:lang(ar)` typography, `gc-hero-grid-warm`, animations). Update the ~197-201 comment to say the warm theme is now global.

- Copy source: `app/globals.css` `.gc-landing-root` blocks — exact values, verbatim.
- Keep `--chart-*`, `--sidebar-*`, `--gc-input-icon-*`, `--gc-output-icon-*` untouched.
- Fix `.gc-card-hover:hover` hardcoded colors → token-based: `border-color: color-mix(in oklch, var(--foreground) 20%, transparent)`; shadow color from `var(--foreground)` at low alpha (verify against both light cream and dark).
- Delete unused `.gc-glass` block.

**Verify**: `npx vitest run` (all pass); preview: landing unchanged visually (tokens identical); dashboard + auth now warm in light AND dark; grep `gc-glass` returns nothing; hover border visible on light cream background.

---

## Phase 2: Clerk dark-mode fix (theme-reactive appearance)

**What**: `npm i @clerk/themes`. Create ONE small client component `components/auth/clerk-appearance.ts(x)` exporting a `useClerkAppearance()` hook (or plain function taking `resolvedTheme`) that returns an `Appearance` object:
- dark: `{ baseTheme: dark, variables: { colorPrimary: '#f0ede9', colorBackground: '#1d1a17', colorInput: '#141210', colorText/colorForeground: '#f0ede9', colorNeutral: '#f0ede9' } }`
- light: `{ variables: { colorPrimary: '#2a2826', colorBackground: '#f7f5f2', colorInput: '#ffffff' } }`

Convert the two auth pages' Clerk mount into a tiny client wrapper (`components/auth/auth-clerk.tsx`) that reads `useTheme()` from `next-themes` and renders `<SignIn appearance={...}>` / `<SignUp appearance={...}>` with the existing routing props COPIED VERBATIM from `app/sign-in/[[...sign-in]]/page.tsx:34` and `app/sign-up/[[...sign-up]]/page.tsx:34`. Guard hydration (render after `mounted` or use `resolvedTheme ?? 'dark'`).

- Import name check: `import { dark } from '@clerk/themes'` (verify export exists in installed package's .d.ts before using).
- Keep the `[&_.cl-*]` overrides in AuthShell only if still needed after variables land; delete the ones the variables make redundant.

**Verify**: dev server: /sign-in in dark mode shows dark form (no white card); toggle to light — form goes light; no hydration warning in console; existing sign-in/sign-up page tests pass (update copy assertions only if markup moved).

---

## Phase 3: Split-screen AuthShell redesign

**What**: Rewrite `components/auth/auth-shell.tsx` keeping its exact public props (`title, subtitle, footerPrompt, footerCtaLabel, footerCtaHref, children`) so both pages need zero changes.

Layout:
- Desktop (lg+): full-height 2-pane grid (`lg:grid-cols-[1fr_1fr]`, `min-h-dvh`). Brand pane: ALWAYS warm-charcoal dark (independent of theme — style with explicit dark tokens, not theme vars), containing BrandLogo (link to /), a large typographic brand statement — reuse hero scale pattern from `site-landing.tsx` heroTitle styling (`text-[clamp(...)] font-bold leading-[1.06] tracking-tight`) — e.g. "We build, run, and maintain your AI." + one short muted line. Optional: subtle `gc-hero-grid-warm` background (already defined in globals.css ~251).
- Form pane: centered column, max-w-md, `title`/`subtitle` heading block above the Clerk widget, footer prompt below.
- Mobile (<lg): FORM FIRST. Brand pane collapses to a slim top strip (logo + one-line statement) — fix the discovery finding that marketing renders above the form. Delete the AUTH_POINTS list entirely (brand statement replaces it) or keep max ONE line; delete blur blobs (lines 44-45).
- Fluid paddings (`px-4 sm:px-6`), no fixed widths; test 320px.
- RTL-safe: logical properties only (`ps-/pe-/ms-/me-/start-/end-`); no uppercase+tracking on anything that could become Arabic later.

**Verify**: preview at 320 / 375 / 430 / 768 / 1024 / 1280 / 1440: no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`), form visible without scrolling past marketing on mobile; dark + light both correct; sign-in/sign-up tests updated for removed AUTH_POINTS copy and pass.

---

## Phase 4: Hover system — lift + caption reveal

**What**: In globals.css add a token-based `.gc-hover-reveal` pattern for image+text frames:
- Container: `overflow-hidden`, transition transform/box-shadow (220ms ease-out).
- On hover: lift `translateY(-3px)` + shadow (tokenized), inner `img` scales to ~1.04 (transform only), caption bar (absolute, inset-inline-0 bottom-0, bg `color-mix(in oklch, var(--background) 85%, transparent)`, backdrop-blur ok as function not decoration) slides from `translateY(100%)` to `0`.
- Apply to `ScreenshotFrame` (site-landing.tsx ~92-120): move `figcaption` into the image wrapper as the reveal bar when a new `reveal` prop is true; enable on proof frames (~299) and hero (~233). Keep non-reveal fallback for reduced-motion: caption statically visible (never hide content permanently behind hover).
- Add `gc-card-hover` to "How it works" cards (~254) for consistency with automate cards.
- Touch devices: caption must be visible by default (`@media (hover: none)` → caption pinned visible). Hover is enhancement, not gate.
- Extend the `prefers-reduced-motion` block (~518-521) to neutralize the new transforms.

**Verify**: preview hover on proof + hero frames (screenshot before/after hover via eval `:hover` simulation or class toggle); captions readable on mobile (hover:none) without interaction; reduced-motion leaves captions visible; vitest run green.

---

## Phase 5: Final verification

1. `npx vitest run` — full suite green (except pre-existing `install-page-content.test.tsx` type errors, known on main).
2. `npx eslint .` on changed files; `npx tsc --noEmit` — no NEW errors.
3. Anti-pattern grep: `grep -rn "gc-glass" app components` → 0; `grep -n "oklch(0.72 0.14 265" app/globals.css` → 0 (old hardcoded shadow gone); no `border-l-4`/gradient-text introduced.
4. Preview matrix: {/, /sign-in, /sign-up, /dashboard/overview(redirect)} × {light, dark} × {375, 768, 1440} × {en, ar(RTL)}: no overflow, no white-on-dark Clerk, warm palette everywhere.
5. Commit; deploy via `/root/grindctrl-next/deploy-next.sh` after `docker builder prune -af` (disk hot, ~91%).
