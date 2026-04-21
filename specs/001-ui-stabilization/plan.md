# Implementation Plan: Refine Current UI Stabilization

**Branch**: `001-ui-stabilization` | **Date**: 2026-04-21 | **Spec**: [`specs/001-ui-stabilization/spec.md`](./spec.md)
**Input**: Feature specification from `specs/001-ui-stabilization/spec.md`

## Summary

This plan is anchored to the current repository state, not an idealized rebuild. The goal is to preserve the good parts of the current GRINDCTRL implementation, systematically revise weak shared foundations, and selectively rewrite the parts that are fragile or broken.

This revision also corrects the first auth/dashboard stabilization direction: sign-in and sign-up should move back toward a more native Clerk feel with a restrained auth-only neutral palette, and the dashboard progress treatment should be redesigned based on the latest screenshot-backed review.

The work should prioritize shared-system fixes over page-local pixel nudges:

- Fix shared visual primitives before touching page-local overrides.
- Align Clerk through supported `appearance` configuration, then use `auth.css` only for shell-level integration.
- Stabilize header, drawer, widget composer, and dashboard shell through reusable layout rules instead of one-off spacing tweaks.
- Treat Supabase/runtime issues as targeted client and RLS corrections that preserve security.
- Make the icon decision explicit instead of continuing mixed ad hoc usage.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript on Node.js with Vite  
**Primary Dependencies**: Vite, `@clerk/clerk-js`, `@supabase/supabase-js`, `@shoelace-style/shoelace`  
**Storage**: Supabase Postgres, browser local/session storage  
**Testing**: `npm run build`, targeted Playwright validation, manual responsive and RTL QA, browser console/runtime verification  
**Target Platform**: GitHub Pages-served static site across mobile, tablet, and desktop browsers  
**Project Type**: Single-repo frontend with static public pages, protected app shell, and copied classic widget scripts  
**Constraints**: Current repo is the baseline; preserve working auth; keep classic public scripts as classic scripts; support EN and AR; keep dark mode; do not mix Supabase projects; do not broadly disable RLS

## Constitution Check

The repository constitution file at `.specify/memory/constitution.md` is authoritative for this plan and its MUST rules govern scope, validation, and release readiness.

| Gate | Status | Notes |
|------|--------|-------|
| Current implementation is the baseline | PASS | This plan is explicitly correction-first, not greenfield. |
| Shared system before local patching | PASS | CSS cascade, Clerk appearance, header/drawer logic, widget composer rules, and icon strategy are addressed first. |
| Supported vendor integration paths only | PASS | Clerk stays on supported `appearance` config; Supabase fixes remain targeted. |
| Security posture preserved | PASS | Runtime fixes must avoid broad RLS disablement. |
| Constitution completeness | PASS | Constitution v1.0.0 is present and governs this plan. |

## Current Repo Baseline

### Core Files In Scope

```text
src/
├── index.html
├── sign-in.html
├── sign-up.html
├── app.html
├── fonts.css
├── tokens.css
├── base.css
├── layout.css
├── components.css
├── auth.css
├── app.css
├── chat-widget.css
├── blueprint-studio.css
├── voice-to-value.css
├── overrides.css
├── scripts/
│   ├── app.js
│   ├── clerk.js
│   ├── clerk-appearance.js
│   ├── clerk-header.js
│   ├── auth-sign-in.js
│   ├── auth-sign-up.js
│   ├── site-header.js
│   └── web-awesome.js
├── lib/
│   ├── supabase.js
│   └── clerk-supabase-sync.js
└── public/
    ├── scripts/
    │   ├── i18n.js
    │   ├── chat-widget.js
    │   ├── grindctrl-support.js
    │   ├── blueprint-studio.js
    │   └── voice-to-value.js
    ├── logo-dark.svg
    ├── logo-light.svg
    └── shoelace/

supabase/
├── clerk_profiles_workspaces_widget_sites.sql
├── clerk_bootstrap_functions.sql
├── fix_workspace_members_rls_recursion.sql
├── fix_workspace_members_rls_commands_split.sql
├── trial_playground_schema.sql
├── trial_playground_auth_upgrade.sql
└── trial_image_assets_schema.sql
```

### Keep / Revise / Rewrite Baseline

| Area | Keep | Revise | Rewrite |
|------|------|--------|---------|
| Shared CSS cascade | Keep `tokens.css` -> `base.css` -> `layout.css` -> `components.css` -> page CSS order | Revise token usage, spacing rhythm, and component consistency where current files drift | Rewrite only narrow utility patterns that force repeated local overrides |
| Auth shell | Keep split between `sign-in.html`, `sign-up.html`, `auth.css`, and Clerk mount scripts | Revise contrast, brand scale, spacing, composition, and page-shell polish | Rewrite shell sections only if current auth layout cannot be stabilized cleanly |
| Clerk integration | Keep `clerk-appearance.js` as the official integration point | Revise `appearance.variables` and `appearance.elements` to match GRINDCTRL more tightly | Rewrite deep CSS overrides that fight Clerk internals or duplicate appearance config |
| Public header and drawer | Keep `index.html` nav structure, Shoelace drawer, and `site-header.js` direction sync | Revise control priority, spacing, CTA/auth affordances, and RTL polish | Rewrite only the brittle header action cluster if collisions cannot be resolved structurally |
| Widget and mockup | Keep separate runtime surfaces for real widget and demo/mockup | Revise them toward shared containment and alignment rules | Rewrite duplicated input-row logic if current markup/CSS cannot share stable layout behavior |
| Dashboard shell | Keep `app.html` page segmentation and `app.js` screen switching baseline | Revise hierarchy, spacing, responsive shell behavior, and reduce placeholder feel | Rewrite only shell scaffolding that blocks mobile correctness or visual coherence |
| Supabase runtime | Keep singleton dashboard client pattern in `src/lib/supabase.js` and project separation between trial and production widgets | Revise data access paths, error handling, and any failing RPC/RLS assumptions | Rewrite only the failing query or policy path causing recursion or `widget_sites` loading issues |
| Icon strategy | Keep existing icons only where they are already stable and out of scope | Revise in-scope shell/icon usage toward one consistent system | Rewrite fragile product-shell icons away from mixed font-based usage |

## Systematic Fix Strategy

1. Shared foundations first
2. Auth shell and Clerk appearance second
3. Mobile header and drawer third
4. Widget and mockup layout fourth
5. Dashboard shell fifth
6. Runtime and RLS corrections sixth
7. Final responsive, EN, and AR validation last

This order prevents rework. Header, auth, widget, and dashboard polish should consume the same spacing, radius, focus, icon, and contrast decisions rather than each inventing their own local fix.

## Icon Strategy Decision

**Decision**: Migrate in-scope product-shell icons to a lightweight local SVG approach instead of continuing to rely on mixed `Material Symbols` text glyphs for critical UI.

**Why**:

- Current usage is inconsistent across public shell, auth affordances, dashboard actions, and widget controls.
- Font-based icons are more fragile for alignment, rendering consistency, and RTL-sensitive directional swaps.
- A local SVG approach is lighter and more controllable than adding another full icon library dependency.

**Plan**:

- Add a small local SVG icon set for in-scope shell/product UI only.
- Use it first in header, drawer, auth affordances, dashboard shell, and widget composer/send controls.
- Leave low-priority marketing/detail icons on the existing system for now if they are not part of this stabilization scope.
- Do not add a new third-party icon library unless the SVG migration proves insufficient during implementation.

**Likely touchpoints**:

- `src/index.html`
- `src/sign-in.html`
- `src/sign-up.html`
- `src/app.html`
- `src/components.css`
- `src/overrides.css`
- `src/scripts/clerk-header.js`
- `src/public/scripts/grindctrl-support.js`
- `src/public/scripts/chat-widget.js`

## File-Level Implementation Order

### Phase 0: Audit Current Baseline Before Editing

Goal: confirm what is already strong and identify what is actually broken in the current repo, not in memory.

Files to audit first:

1. `src/index.html`
2. `src/sign-in.html`
3. `src/sign-up.html`
4. `src/app.html`
5. `src/tokens.css`
6. `src/layout.css`
7. `src/components.css`
8. `src/auth.css`
9. `src/app.css`
10. `src/chat-widget.css`
11. `src/overrides.css`
12. `src/scripts/site-header.js`
13. `src/scripts/clerk-header.js`
14. `src/scripts/clerk-appearance.js`
15. `src/public/scripts/chat-widget.js`
16. `src/public/scripts/grindctrl-support.js`
17. `src/lib/supabase.js`
18. `src/lib/clerk-supabase-sync.js`
19. relevant `supabase/*.sql` files only if runtime evidence points to policy/RPC issues

Output of this phase:

- keep list
- revise list
- rewrite list
- confirmed runtime problem list

### Phase 1: Shared Foundation Revisions

Goal: remove the need for random pixel nudges by tightening the shared system.

File order:

1. `src/tokens.css`
2. `src/base.css`
3. `src/layout.css`
4. `src/components.css`
5. `src/overrides.css`

Focus:

- contrast tokens and readable dark surfaces
- shared spacing rhythm
- shared border, radius, and control sizing
- shared icon container rules for SVG migration
- shared RTL-safe logical properties

### Phase 2: Auth Shell and Clerk Appearance

Goal: make sign-in and sign-up feel premium, readable, and visually calmer by moving closer to the native Clerk feel inside a restrained GRINDCTRL auth shell.

File order:

1. `src/scripts/clerk-appearance.js`
2. `src/auth.css`
3. `src/sign-in.html`
4. `src/sign-up.html`
5. `src/scripts/auth-sign-in.js`
6. `src/scripts/auth-sign-up.js`

Keep:

- current page split
- Clerk mount architecture

Revise:

- brand lockup scale and composition
- page intro/card balance
- auth-only gray, off-white, and near-white background treatment
- contrast and readability
- Clerk supported appearance values with fewer heavy overrides
- mobile spacing and desktop proportion

Rewrite only if needed:

- fallback markup or shell wrappers that block clean alignment

### Phase 3: Mobile Header, Nav, and Drawer

Goal: fix overlap, priority, and LTR/RTL drawer stability at the shell level.

File order:

1. `src/index.html`
2. `src/components.css`
3. `src/layout.css`
4. `src/overrides.css`
5. `src/scripts/site-header.js`
6. `src/scripts/clerk-header.js`
7. `src/scripts/web-awesome.js` only if a Shoelace import/config change is required

Keep:

- Shoelace drawer base
- language toggle and auth/header split

Revise:

- action cluster sizing and order of importance
- menu trigger placement
- auth CTA footprint on narrow widths
- drawer interior spacing, geometry, and artifact cleanup
- active-state and icon direction behavior in RTL

Rewrite only if needed:

- current header action markup if collisions cannot be solved with CSS and minor structure changes

### Phase 4: Widget and Mockup Layout Stabilization

Goal: share stable containment logic between real widget and demo/mockup.

File order:

1. `src/chat-widget.css`
2. `src/overrides.css`
3. `src/index.html`
4. `src/public/scripts/chat-widget.js`
5. `src/public/scripts/grindctrl-support.js`

Keep:

- separate trial widget and production widget runtimes
- Shadow DOM isolation for production widget

Revise:

- input-row containment model
- send button geometry
- placeholder/input alignment in EN and AR
- quick-action wrapping
- any shared sizing constants that can be mirrored across surfaces

Rewrite only if needed:

- duplicated composer markup/CSS assumptions that prevent consistent behavior

### Phase 5: Dashboard Shell Refinement

Goal: bring the protected dashboard into the same product language as landing and auth without overbuilding, while correcting the visibly broken progress treatment shown in the latest screenshots.

File order:

1. `src/app.css`
2. `src/app.html`
3. `src/components.css` if shared controls need refinement
4. `src/scripts/app.js`

Keep:

- current route/page shell split
- current screen switching baseline

Revise:

- top bar rhythm and density
- sidebar/main-content relationship
- card hierarchy and spacing
- progress, trial, and step-treatment presentation
- mobile adaptation of shell and controls
- placeholder feel in banners, empty states, and setup blocks
- screenshot-backed overlap or emphasis issues in the in-scope dashboard views

Rewrite only if needed:

- shell sections whose structure blocks responsive polish

### Phase 6: Supabase and Runtime Stability

Goal: remove known runtime issues without weakening security.

File order:

1. `src/lib/supabase.js`
2. `src/lib/clerk-supabase-sync.js`
3. `src/scripts/app.js`
4. `src/public/scripts/chat-widget.js`
5. `supabase/fix_workspace_members_rls_recursion.sql`
6. `supabase/fix_workspace_members_rls_commands_split.sql`
7. `supabase/clerk_bootstrap_functions.sql`
8. `supabase/clerk_profiles_workspaces_widget_sites.sql`

Keep:

- singleton dashboard client pattern
- separate Supabase projects for trial widget and production widget

Revise:

- initialization guards
- duplicate client creation warnings if observed in real runtime
- failing workspace or `widget_sites` load path
- RPC and RLS assumptions behind workspace/site fetches

Rewrite only if needed:

- specific RPC or policy definitions causing recursion or inaccessible records

## Validation Matrix

### Required Widths

Every in-scope surface must be checked at:

- `320px`
- `360px`
- `375px`
- `390px`
- `414px`
- `768px`

### Required Languages

Every validation pass must be run in:

- English (`lang="en"`, `dir="ltr"`)
- Arabic (`lang="ar"`, `dir="rtl"`)

### Surface Coverage

| Surface | 320 | 360 | 375 | 390 | 414 | 768 | EN | AR |
|--------|-----|-----|-----|-----|-----|-----|----|----|
| Public landing + mobile header | Required | Required | Required | Required | Required | Required | Required | Required |
| Sign-in | Required | Required | Required | Required | Required | Required | Required | Required |
| Sign-up | Required | Required | Required | Required | Required | Required | Required | Required |
| Mobile drawer | Required | Required | Required | Required | Required | Required | Required | Required |
| Demo/mockup widget | Required | Required | Required | Required | Required | Required | Required | Required |
| Trial playground widget | Required | Required | Required | Required | Required | Required | Required | Required |
| Dashboard shell | Required | Required | Required | Required | Required | Required | Required | Required |

### Validation Checks By Surface

Public landing and header:

- no overlap between brand, toggles, auth affordance, and menu trigger
- no clipped drawer edges or backdrop artifacts
- correct LTR and RTL drawer placement and active-state behavior

Auth:

- readable contrast in titles, subtitles, helper text, fields, and dividers
- brand lockup feels appropriately prominent
- auth shell uses a restrained neutral palette instead of a visually heavy dark block
- Clerk internals stay close to native, not over-restyled or pasted in
- no cramped mobile composition

Widget and mockup:

- input shell contains field and send action at all widths
- no button protrusion
- placeholder alignment follows language direction
- quick actions wrap cleanly

Dashboard:

- top bar, sidebar, and main content remain coherent at tablet and narrow mobile widths
- card rhythm and empty states feel production-ready
- no obvious placeholder/mock composition
- progress bars, step indicators, and trial-state labels remain readable and do not overlap, clip, or fight adjacent controls

Runtime:

- no duplicate-client warnings
- no known `widget_sites` loading failure in app flow
- no policy recursion error during normal dashboard access
- no broad RLS relaxations introduced

## Risks

- Shared CSS changes may improve auth while destabilizing the landing page if not validated phase-by-phase.
- Clerk visual alignment may tempt unsupported deep overrides; those should be removed in favor of supported appearance config.
- Widget and mockup may look similar while relying on different containment assumptions, so partial fixes may regress one surface.
- Icon migration can sprawl if applied to every marketing detail icon; scope must stay focused on product-shell consistency first.
- Supabase fixes may require SQL changes, but only after confirming the actual failing RPC or policy path.

## Definition Of Done For This Plan

- keep, revise, and rewrite decisions are explicit against the current repo
- implementation proceeds in the file order above
- no phase is considered done without width checks at `320`, `360`, `375`, `390`, `414`, and `768`
- no phase is considered done without both EN and AR validation
- no phase is considered done without the relevant Playwright coverage or a documented equivalent automated check where the repo supports it
- icon migration decision is implemented consistently for in-scope shell UI
- auth remains working
- runtime fixes preserve security and avoid broad RLS disablement
