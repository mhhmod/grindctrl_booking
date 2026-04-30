# Quickstart: Refine Current UI Stabilization

## Goal

Implement the UI/runtime stabilization work against the current repository without replacing the existing architecture.

## Prerequisites

- Node.js environment that can run Vite and Playwright
- Existing Clerk and Supabase environment variables if runtime validation is needed
- Awareness that the repo uses two Supabase projects with different keys

## Setup

1. Install dependencies.

```bash
npm install
```

2. Start local development.

```bash
npm run dev
```

3. Build once before and after major changes.

```bash
npm run build
```

## Implementation Sequence

1. Audit the shared foundation files first:
   `src/tokens.css`, `src/base.css`, `src/layout.css`, `src/components.css`, `src/overrides.css`
2. Refine auth shell and Clerk alignment:
   `src/sign-in.html`, `src/sign-up.html`, `src/auth.css`, `src/scripts/clerk-appearance.js`
3. Fix header/drawer priority and RTL/mobile geometry:
   `src/index.html`, `src/components.css`, `src/layout.css`, `src/scripts/site-header.js`
4. Stabilize widget composer behavior in both implementations:
   `src/chat-widget.css`, `src/public/scripts/chat-widget.js`, `src/public/scripts/grindctrl-support.js`
5. Refine dashboard shell polish and responsiveness:
   `src/app.html`, `src/app.css`, `src/scripts/app.js`
6. Validate runtime issues and only then touch Supabase/client code or SQL:
   `src/lib/supabase.js`, `src/lib/clerk-supabase-sync.js`, `supabase/*.sql`
7. Run final build and manual QA pass.

## Manual QA Matrix

Check these widths in English and Arabic where relevant:

- 390px
- 480px
- 768px
- 1280px+

Check these surfaces:

- Landing page
- Sign-in
- Sign-up
- Dashboard
- Trial playground widget
- Production widget/demo mockup

## Acceptance Checklist

- Auth branding is readable and intentional
- Clerk controls feel native to GRINDCTRL dark mode
- Mobile header has no collisions
- Drawer placement and active states behave correctly in LTR and RTL
- Widget composer stays contained in English and Arabic
- Dashboard shell feels like the same product as public/auth surfaces
- No duplicate-client warnings in normal runtime paths
- No known workspace policy recursion errors
- `npm run build` succeeds

## Notes

- Do not convert classic scripts under `src/public/scripts/` into modules during this feature.
- Do not mix the trial and production Supabase projects.
- If SQL changes are required, follow the repo's manual migration pattern in `supabase/` and preserve RLS.

## Validation Notes (2026-04-21)

- `npm run build` passed.
- `npx playwright test e2e/stabilization.spec.ts` passed (one transient timeout was resolved on retry; no reproducible failure).
- `npx playwright test e2e/stabilization-matrix.spec.ts` passed for EN/AR auth widths (`320/360/375/390/414/768`) and dashboard widths (`390/768/1280`).
- `npm run test` passed (`82/82`), including drawer, RTL, auth, dashboard, widget, and runtime warning smoke coverage.
- No active `Multiple GoTrueClient`, `workspace_members` recursion, or `widget_sites` 500 runtime regression was reproduced during this pass.
- Task tracker closeout was finalized by explicit operator choice to force-close the remaining live-only tasks (`T021`, `T038`) without additional runtime reproduction.
