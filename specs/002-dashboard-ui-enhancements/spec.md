# Feature Specification: Dashboard UI Enhancements (shadcn/ui)

**Feature Branch**: `002-dashboard-ui-enhancements`
**Created**: 2026-04-23
**Status**: Draft
**Input**: Create a new spec to enhance the existing Next.js dashboard UI. Standardize on shadcn/ui components and patterns. Cover shell polish, progress treatment, tables/lists, forms/inputs, icon consistency, EN+AR RTL correctness, and responsive behavior.

## Context

This repo contains a Next.js app at `apps/web-next` using Tailwind v4.

The dashboard routes live under `apps/web-next/app/dashboard/*` and currently use bespoke Tailwind markup (e.g. `DashboardShell`, overview cards/lists) plus `lucide-react` icons.

We want a production-grade dashboard experience that matches GRINDCTRL quality, with consistent component composition and predictable states.

## Objective

Enhance the existing dashboard UI (not a new dashboard) to be:

- Visually coherent across all dashboard sections
- Consistent and maintainable via shadcn/ui primitives
- Robust on mobile/tablet/desktop breakpoints
- Correct in English + Arabic (including RTL)
- Clear in loading/empty/error/disabled/success states

## In Scope

- Adopt shadcn/ui as the dashboard UI component baseline for `apps/web-next`.
- Dashboard shell polish: navigation, header, spacing rhythm, typography, card composition, and focus states.
- Progress treatment: replace the current “placeholder”/broken feeling progress presentation with a coherent, honest status model (no fake analytics).
- Tables & lists: consistent density, alignment, truncation, row actions, and empty/loading/error states.
- Forms & inputs: consistent form layout, validation, disabled states, and action rows.
- Icon consistency: standardize icon sizing/placement rules and reduce one-off icon styling.
- EN + AR + RTL QA: directionality, alignment, wrapping/truncation, and mirrored affordances where appropriate.
- Responsive pass: ensure intentional layout at 390/480/640/768/1024+ widths.

## Out of Scope

- Backend/data contract changes (Supabase RPC/schema/RLS) unless strictly required to unbreak a dashboard view.
- New analytics data surfaces or “fake” charts.
- Major information architecture rewrite (keep the current sections: Overview/Install/Branding/Intents/Domains/Leads).

## Constraints & Standards

- Use shadcn/ui patterns and composition rules (Card composition, Table, Sidebar/navigation primitives, forms conventions).
- Keep styling semantic and token-based; avoid one-off colors and typography.
- Maintain accessibility basics: semantic HTML, visible focus, keyboard-safe navigation, labeled inputs.
- No fake data visualization; show honest placeholders when data is unavailable.

## Current Surfaces (Baseline)

- Layout: `apps/web-next/app/dashboard/layout.tsx`
- Shell: `apps/web-next/components/dashboard/dashboard-shell.tsx`
- Overview: `apps/web-next/app/dashboard/overview/page.tsx`, `apps/web-next/components/dashboard/overview-page-content.tsx`
- Other sections: `apps/web-next/app/dashboard/{install,branding,intents,domains,leads}`

## User Scenarios & Testing (mandatory)

### User Story 1: Navigate the dashboard comfortably on mobile and desktop (Priority: P1)

As an authenticated user, I can navigate between dashboard sections using a shell that behaves correctly on mobile (drawer/sheet) and desktop (sidebar), with consistent spacing and readable hierarchy.

**Independent Test**: On widths 390/480/768/1024, open `/dashboard/*`, navigate between sections, and confirm the nav remains usable with no collisions or overflow.

**Acceptance Scenarios**:

1. Given the user is on mobile, when they open navigation, then it appears as a sheet/drawer with clear active state and keyboard focus.
2. Given the user is on desktop, when they use the sidebar, then the active section is obvious and the content frame remains stable.
3. Given the user tabs through interactive elements, then focus states are visible and logical.

### User Story 2: See honest progress and status without fake analytics (Priority: P1)

As a user, I can understand setup/readiness and current status via clear progress treatment that reflects real available data and avoids fabricated metrics.

**Independent Test**: On `/dashboard/overview`, switch sites (if present), and validate that readiness/status components reflect the selected site and available data, with safe placeholders when not available.

**Acceptance Scenarios**:

1. Given there is no workspace or no selected site, when the page renders, then the UI shows an empty state with clear next steps.
2. Given data is loading or errors, when the view is displayed, then loading skeletons and inline error states appear (no blank panels).
3. Given a site exists, when status is shown, then the copy is accurate and scoped to real contracts (domains/intents/leads/install key).

### User Story 3: Use tables and lists that feel consistent and stable (Priority: P1)

As a user, I can scan and act on domains, intents, and leads in tables/lists that have consistent density, truncation, and row actions across the dashboard.

**Independent Test**: Visit `/dashboard/domains`, `/dashboard/intents`, `/dashboard/leads` on mobile/desktop; validate alignment, truncation, and action placement.

**Acceptance Scenarios**:

1. Given a table/list has no rows, when it renders, then an Empty state is shown with appropriate guidance.
2. Given the content is long, when it renders, then it truncates safely (no overflow) and can be accessed via a tooltip/detail affordance if needed.
3. Given a destructive action exists, when it is available, then it is clearly separated/confirmed.

### User Story 4: Use forms and inputs with predictable validation and actions (Priority: P1)

As a user, I can edit dashboard settings (e.g. branding/settings_json-derived fields) using forms with consistent layout, validation messaging, disabled states, and submit feedback.

**Independent Test**: Open `/dashboard/branding` and attempt edits; simulate invalid inputs; verify disabled and success states.

**Acceptance Scenarios**:

1. Given a field is invalid, when validation fails, then the field shows an error message and `aria-invalid` is set.
2. Given a submit is pending, when the user submits, then the primary action is disabled and shows pending feedback.
3. Given submission succeeds/fails, when the response returns, then success or inline error is shown without losing context.

### User Story 5: English and Arabic feel first-class (Priority: P1)

As a user, I can use the dashboard in English and Arabic with correct RTL directionality, alignment, icon placement, and sensible truncation/wrapping.

**Independent Test**: Toggle language to Arabic (repo’s existing mechanism), revisit key dashboard pages, and verify RTL behavior at mobile and desktop widths.

**Acceptance Scenarios**:

1. Given Arabic is active, when the shell renders, then nav, header, and content align correctly and do not visually “fight” RTL.
2. Given mixed-direction content (emails, domains, keys), when rendered in RTL, then it remains readable (use appropriate direction/isolation).
3. Given icon+label controls, when in RTL, then spacing and icon placement remains intentional.

## Non-Functional Requirements

- Performance: avoid excessive client components; keep server components where possible.
- Maintainability: prefer shared shadcn/ui components and minimal bespoke styling.
- Testability: keep existing dashboard tests passing; add/adjust tests only where needed for new states/composition.

## Open Questions

1. Which shadcn preset/style should we standardize on for `apps/web-next` (e.g. `nova`, `vega`, etc.)? → **maia** (selected)
2. What is the dashboard language toggle entry point in the Next app (shared i18n or separate from the Vite site)?
3. Should the mobile nav be a Sheet or a top-level responsive Sidebar pattern?
