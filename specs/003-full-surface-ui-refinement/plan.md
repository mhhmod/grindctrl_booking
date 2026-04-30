# Plan: Full Surface UI Refinement + Widget Interaction Analytics

**Feature Branch**: `003-full-surface-ui-refinement`  
**Created**: 2026-04-24  
**Spec**: `specs/003-full-surface-ui-refinement/spec.md`

**Resolved Gates**: DG-01 -> Next canonical now; DG-02 -> charts on Overview + Install; DG-03 -> 24h/7d/30d windows; DG-04 -> shared dictionary strategy for Next key compatibility + RTL-safe layout; DG-05 -> dashboard+analytics first, then auth/landing, then unified release verification.

## Summary

This plan executes a no-assumptions refinement across landing, auth, dashboard tabs, and widget interaction charting. Work is split into decision gates, shared UI foundation, section-by-section implementation, analytics contracts, and full responsive/RTL/accessibility verification.

## Phase 0: Decision Gates (Required Before UI Cutover)

### Goals

- Resolve ownership and rollout decisions that materially affect implementation.
- Prevent hidden assumptions between static and Next surfaces.

### Tasks

1. Resolve DG-01 (canonical public shell owner): Next, static, or dual-run.
2. Resolve DG-02 (chart placement): Overview, Install, or both.
3. Resolve DG-03 (chart windows): default to `24h`, `7d`, `30d` unless overridden.
4. Resolve DG-04 (Next i18n source): reuse existing dictionary strategy or add Next-local layer.
5. Resolve DG-05 (release order): dashboard-first/auth-first/landing-first/parallel.

### Deliverables

- Decision log in `specs/003-full-surface-ui-refinement/spec.md` under a clarifications section.

## Phase 1: Shared Foundation (Dashboard + Charts)

### Goals

- Stabilize core shell behavior.
- Prepare reusable primitives for chart and section consistency.

### Tasks

1. Fix shell regressions in `apps/web-next/components/dashboard/dashboard-shell.tsx`:
   - remove unsupported tooltip dependency pattern or provide proper provider wiring.
   - enforce single-child `asChild` composition where used.
2. Align shared tokens and typography in `apps/web-next/app/globals.css`.
3. Add/verify shadcn primitives needed for final pass:
   - chart primitives (`chart.tsx` or equivalent)
   - existing `card`, `table`, `alert`, `skeleton`, `tabs`, `badge`, `input`, `label`, `button`.
4. Add shared section wrappers/helpers (if needed) under `apps/web-next/components/dashboard/`.

### Exit Criteria

- Dashboard shell renders all routes without runtime errors.
- Shared primitives are available for all remaining phases.

## Phase 2: Dashboard Tabs Section-by-Section Refinement

### Goals

- Refine every tab and subsection with coherent shadcn composition and state handling.

### Tasks

1. **Overview** (`apps/web-next/components/dashboard/overview-page-content.tsx`)
   - refine metric cards and readiness block.
   - replace analytics placeholder with real chart container(s) and explicit deferred state if backend unavailable.
   - preserve honest contract language.
2. **Install** (`apps/web-next/components/dashboard/install-page-content.tsx`)
   - standardize card/tone composition.
   - keep install verification + domain safety prominence.
   - add chart placement if DG-02 includes Install.
3. **Branding** (`apps/web-next/components/dashboard/branding-form.tsx`)
   - migrate to consistent form field components and validation patterns.
   - unify status messaging and submit rows.
4. **Intents** (`apps/web-next/components/dashboard/intents-manager.tsx`)
   - unify editor/list/action pattern.
   - ensure reorder/delete states are explicit and consistent.
5. **Domains** (`apps/web-next/components/dashboard/domains-manager.tsx`)
   - unify add-domain form + status updates + remove flows.
   - ensure hostname truncation and status badge consistency.
6. **Leads** (`apps/web-next/components/dashboard/leads-dashboard.tsx`)
   - unify settings form and leads list/table composition.
   - preserve loading/error/empty/search states and mobile/desktop list parity.
7. **Site selector** (`apps/web-next/components/dashboard/site-selector.tsx`)
   - ensure consistent appearance and responsive placement across all pages.

### Exit Criteria

- Every tab has complete state coverage and cohesive layout rhythm.

## Phase 3: Widget Interaction Analytics Contracts + Adapters

### Goals

- Add reliable backend read models for charting.
- Keep tenant security and contract clarity.

### Tasks

1. Add migration SQL in `supabase/` for chart read RPCs:
   - `dashboard_widget_events_timeseries(...)`
   - `dashboard_widget_events_breakdown(...)`
   - optional `dashboard_widget_funnel_summary(...)`
2. Keep security-definer + workspace/site scope checks consistent with existing dashboard RPC patterns.
3. Add Next adapters under `apps/web-next/lib/adapters/`:
   - `widgetEvents.ts` (new)
4. Extend types in `apps/web-next/lib/types.ts` for chart payloads.
5. Add tests for adapter/transforms in `apps/web-next/lib/adapters/*.test.ts`.

### Exit Criteria

- Chart data contracts return stable, typed data for chosen windows.

## Phase 4: Chart UI Implementation (Production States)

### Goals

- Render interaction differences clearly and safely.

### Tasks

1. Add chart modules in `apps/web-next/components/dashboard/` (new files if needed):
   - interaction timeseries chart
   - event mix chart
   - optional funnel summary strip
2. Integrate selected chart modules into Overview and/or Install per DG-02.
3. Implement all states:
   - loading skeleton
   - empty (no events)
   - error (RPC failure)
   - success
4. Ensure legends, axis labels, and event names are localizable and RTL-safe.

### Exit Criteria

- Charts render with real data and no fabricated metrics.

## Phase 5: Auth Surface Refinement

### Goals

- Bring login/signup to production quality in canonical surface.

### Tasks

1. If Next owns auth (DG-01):
   - refine `apps/web-next/app/sign-in/[[...sign-in]]/page.tsx`
   - refine `apps/web-next/app/sign-up/[[...sign-up]]/page.tsx`
   - keep Clerk native feel, improve shell hierarchy and fallback state quality.
2. If static owns auth (DG-01):
   - refine `src/sign-in.html`, `src/sign-up.html`, `src/auth.css`.
3. If dual-run:
   - maintain parity checklist for both auth implementations.

### Exit Criteria

- Auth passes responsive and visual quality checks with Clerk integration intact.

## Phase 6: Landing Surface Refinement

### Goals

- Refine every landing section in the selected canonical surface.

### Tasks

1. If Next owns landing:
   - expand/refine `apps/web-next/app/page.tsx` into full section architecture.
2. If static owns landing:
   - refine section-by-section in `src/index.html` + related CSS/script files.
3. For active surface, complete section review for:
   - top nav/drawer/header behavior
   - hero and primary CTA hierarchy
   - each body section listed in spec inventory
   - footer and final CTA consistency

### Exit Criteria

- All listed landing sections are production-ready and responsive.

## Phase 7: Responsive + RTL + Accessibility Pass

### Goals

- Prevent regressions across breakpoints and direction modes.

### Tasks

1. Run responsive pass at 390/480/640/768/1024/1280+ on:
   - landing sections
   - auth screens
   - dashboard tabs
   - chart modules
2. Run RTL pass in Arabic:
   - alignment, icon order, truncation, mixed LTR token rendering.
3. Run accessibility checks:
   - tab order
   - visible focus
   - labels and status text exposure.

### Exit Criteria

- No blocking overflow, clipping, directionality, or focus regressions.

## Phase 8: Verification + Release

### Goals

- Validate build/test/runtime and ship safely.

### Tasks

1. Next app verification:
   - `npm test` (inside `apps/web-next`)
   - `npm run build` (inside `apps/web-next`)
2. Root static verification (if static modified):
   - `npm run build` (repo root)
3. Manual smoke:
   - `/dashboard/overview`
   - `/dashboard/install`
   - `/dashboard/branding`
   - `/dashboard/intents`
   - `/dashboard/domains`
   - `/dashboard/leads`
   - auth entry routes
   - active landing routes
4. Validate chart windows and event deltas against known event activity.
5. Deploy and re-verify production URLs.

## Risks And Mitigations

- **Dual-surface drift**: mitigate via DG-01 early lock and parity checklist.
- **Sparse event data**: mitigate with strong empty-state design and window switching.
- **Contract mismatch**: mitigate with typed adapters + adapter tests + explicit error states.
- **UI inconsistency**: mitigate with shared primitives and strict section-by-section completion criteria.

## Definition Of Done

1. Section inventory from spec is fully covered.
2. Charts are live, accurate, and state-complete.
3. Responsive + RTL + accessibility passes are complete.
4. Build/tests pass for affected surfaces.
5. Production smoke checks pass after deploy.
