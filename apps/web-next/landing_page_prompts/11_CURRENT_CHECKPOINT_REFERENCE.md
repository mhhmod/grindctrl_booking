# GrindCTRL Landing Checkpoint Reference

Date: May 1, 2026

This document describes the current checkpoint reached for the `apps/web-next` landing experience after the landing rebuild plus the theme, logo, and contrast pass.

## Current Product State

The Next.js landing page now presents GrindCTRL as a premium AI operations platform with:

- A dark-first visual direction.
- A hero section with an animated workflow preview.
- A full guided AI operations playground below the hero.
- Three interactive preview modes:
  - Workflow Planner
  - Voice Lead Capture
  - File/Image Intake
- Post-playground sections for capabilities, workflow templates, operations preview, integrations, trial path, and final CTA.
- Auth-gated next-step CTAs that lead users toward sign-up after they see value.

The root Vite/static site is not part of this checkpoint. Work is focused on:

```txt
apps/web-next
```

## Theme And Logo Checkpoint

The landing and app shell now have a real theme toggle and brand logo setup.

Theme behavior:

- Default theme is dark.
- User theme choice persists through `next-themes`.
- The header has a compact Sun/Moon pill toggle.
- Theme transitions are smooth for color, background, border, shadow, fill, and stroke.
- Reduced-motion users get near-instant transitions.
- No Clerk, Supabase, n8n, or API behavior was changed.

Logo behavior:

- Fake square `G` marks were replaced with the provided SVG logo assets.
- Logo assets live at:

```txt
apps/web-next/public/brand/logo.svg
apps/web-next/public/brand/logo-dark.svg
```

- Current chosen mapping is intentionally inverse:
  - Light mode uses `logo-dark.svg`.
  - Dark mode uses `logo.svg`.
- Shared logo rendering is centralized in:

```txt
apps/web-next/components/brand-logo.tsx
```

The logo is used in the landing header, landing footer, auth shell, and dashboard sidebar shell.

## Contrast Checkpoint

The light-mode contrast issue shown in the screenshots was addressed in the landing preview surfaces.

Main fixes:

- Added landing-specific theme tokens in `app/globals.css`.
- Replaced dark-only pale `white/10`, `white/[0.03]`, and very light icon color patterns in the hero workflow preview and playground.
- Strengthened icon separation in light mode with clearer foreground colors, stronger backgrounds, borders, and shadows.
- Kept the dark mode premium/glass look without making the light mode washed out.

Primary areas fixed:

```txt
apps/web-next/components/landing/hero-workflow-preview.tsx
apps/web-next/components/landing/try-grindctrl-sandbox.tsx
apps/web-next/app/globals.css
```

## Important Files

Landing entry:

```txt
apps/web-next/app/page.tsx
```

Theme provider:

```txt
apps/web-next/components/theme-provider.tsx
```

Theme toggle:

```txt
apps/web-next/components/dashboard/theme-toggle.tsx
```

Shared brand logo:

```txt
apps/web-next/components/brand-logo.tsx
```

Landing visual components:

```txt
apps/web-next/components/landing/hero-workflow-preview.tsx
apps/web-next/components/landing/try-grindctrl-sandbox.tsx
apps/web-next/components/landing/landing-after-playground-sections.tsx
apps/web-next/components/landing/trial-path-card.tsx
apps/web-next/components/landing/unlock-workflow-card.tsx
```

Global theme and animation CSS:

```txt
apps/web-next/app/globals.css
```

Auth/dashboard logo reuse:

```txt
apps/web-next/components/auth/auth-shell.tsx
apps/web-next/components/dashboard/dashboard-shell.tsx
```

## Verification Already Run

From `apps/web-next`:

```bash
npm run lint
npm run test -- components/dashboard/theme-toggle.test.tsx components/landing/try-grindctrl-sandbox.test.tsx
npm run build
```

Status:

- Lint passed.
- Focused tests passed.
- Production build passed.

Build warning still present:

- Next.js warns about multiple lockfiles and inferred workspace root.
- This is an existing workspace configuration warning, not a blocker.

## Local Viewing

Run:

```bash
cd apps/web-next
npm run dev
```

Open the URL printed by Next.js.

Usually:

```txt
http://localhost:3000
```

If port `3000` is already used, Next chooses another port such as:

```txt
http://localhost:3001
```

Known localhost-only caveat:

- Clerk production keys may reject localhost origins.
- That Clerk error is expected locally unless local/dev Clerk keys are configured.
- The deployed domain should use the production Clerk domain configuration.

Known browser-extension caveat:

- Hydration warnings containing `bis_skin_checked` are usually caused by a browser extension injecting attributes before React hydrates.
- Test in an incognito window with extensions disabled before treating that as an app bug.

## Current Git/Delivery Notes

The previous landing rebuild was already pushed to `main`.

The latest theme/logo/contrast checkpoint is implemented locally but was not pushed in the last step.

There are local unrelated changes already present in the worktree under:

```txt
apps/web-next/lib/landing-sandbox/
```

Those should not be accidentally reverted or mixed into a small visual-only commit unless intentionally included.

For a clean theme/logo/contrast commit, include these paths:

```txt
apps/web-next/app/globals.css
apps/web-next/app/page.tsx
apps/web-next/components/brand-logo.tsx
apps/web-next/components/auth/auth-shell.tsx
apps/web-next/components/dashboard/dashboard-shell.tsx
apps/web-next/components/dashboard/theme-toggle.tsx
apps/web-next/components/landing/hero-workflow-preview.tsx
apps/web-next/components/landing/try-grindctrl-sandbox.tsx
apps/web-next/components/theme-provider.tsx
apps/web-next/public/brand/logo.svg
apps/web-next/public/brand/logo-dark.svg
```

This checkpoint doc itself:

```txt
apps/web-next/landing_page_prompts/11_CURRENT_CHECKPOINT_REFERENCE.md
```

## Recommended Next Checks

Before pushing this checkpoint:

- Visually check light and dark mode at desktop width.
- Visually check mobile width around `390px`.
- Confirm the header does not overflow with the logo, theme toggle, and auth buttons.
- Confirm the logo mapping is still desired:
  - light mode: `logo-dark.svg`
  - dark mode: `logo.svg`
- Confirm the post-playground sections have acceptable light-mode contrast too, even though the most visible screenshot issues were in the hero preview and playground.

