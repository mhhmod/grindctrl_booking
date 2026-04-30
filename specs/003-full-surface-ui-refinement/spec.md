# Feature Specification: Full Surface UI Refinement + Widget Interaction Analytics

**Feature Branch**: `003-full-surface-ui-refinement`  
**Created**: 2026-04-24  
**Status**: In Progress  
**Input**: User request to continue with a no-assumptions, spec-kit implementation path covering full refinement across landing, login/auth, dashboard tabs, and production-ready support-widget interaction charts, with shadcn-based coherence.

## Context

This repository currently runs two UI surfaces in parallel:

1. **Static Vite surface (`src/*`)** for public marketing/auth/dashboard legacy pages.
2. **Next.js surface (`apps/web-next`)** for dashboard/auth parity migration.

Current state is mixed:

- Dashboard shell and overview in Next have partial shadcn migration.
- Dashboard tab pages still contain substantial bespoke Tailwind markup.
- Auth and landing in Next are minimal placeholders.
- Static pages remain richer but separate from the Next system.
- Widget runtime emits event telemetry to `widget_events`, but dashboard charting is not implemented.

## Objective

Deliver one coherent, production-grade UI strategy and implementation path that:

- Refines every requested section (landing, login/auth, dashboard tabs).
- Standardizes dashboard composition on shadcn primitives.
- Adds reliable widget interaction charts using real backend contracts only.
- Preserves EN/AR and RTL quality across mobile/tablet/desktop.
- Avoids fake analytics and avoids assumptions about unavailable data.

## No-Assumption Decision Gates

These must be explicitly resolved during implementation kickoff, not implied:

1. **DG-01 Canonical public shell owner**
   - Option A: Next becomes canonical for landing/auth now.
   - Option B: Static remains canonical public shell; Next only handles auth/dashboard.
   - Option C: dual-run with parity and phased cutover.

2. **DG-02 Chart placement**
   - Overview only, Install only, or both (recommended: both with different emphasis).

3. **DG-03 Metrics window defaults**
   - Recommended defaults: 24h, 7d, 30d.

4. **DG-04 i18n authority in Next**
   - Reuse existing dictionary strategy or introduce Next-local translation layer.

5. **DG-05 Release order**
   - Dashboard-first, auth-first, landing-first, or parallel.

## Clarifications

### Session 2026-04-24

- Q: Which surface is canonical for landing/auth in this phase? -> A: **Next canonical now**.
- Q: Where should widget interaction charts be shown? -> A: **Overview and Install**.
- Q: Which chart windows should be supported by default? -> A: **24h, 7d, 30d**.
- Q: Which i18n authority should Next follow (DG-04)? -> A: **Reuse the existing shared dictionary strategy; keep Next copy key-compatible and RTL-safe for Arabic rollout.**
- Q: What is the release order (DG-05)? -> A: **Dashboard shell + analytics first, then auth/landing polish, followed by one verification/deploy pass.**

## Surface Inventory (Current)

### Next landing/auth (`apps/web-next`)

- `app/page.tsx`
  - Header nav/actions
  - Hero copy/CTAs
  - Install contract preview panel
  - Capability cards
  - Footer links
- `app/sign-in/[[...sign-in]]/page.tsx`
  - Env-missing fallback state
  - Clerk mount shell
- `app/sign-up/[[...sign-up]]/page.tsx`
  - Env-missing fallback state
  - Clerk mount shell

### Next dashboard (`apps/web-next/app/dashboard/*`)

- Shell: `components/dashboard/dashboard-shell.tsx`
  - Sidebar header, nav, account footer
  - Page header/title/description
- Overview: `components/dashboard/overview-page-content.tsx`
  - 4 metric cards
  - setup/readiness card
  - analytics availability placeholder
  - recent leads table
  - current scope list
- Install: `components/dashboard/install-page-content.tsx`
  - embed key card
  - canonical contract card
  - install verification card
  - domain safety card
  - development behavior list
  - standard/CSP snippet cards
- Branding: `components/dashboard/branding-form.tsx`
  - main form section
  - summary section
  - authority boundary section
- Intents: `components/dashboard/intents-manager.tsx`
  - create/edit form
  - intents list with actions
  - summary section
  - action guidance section
- Domains: `components/dashboard/domains-manager.tsx`
  - add domain form
  - domain list with status actions
  - install safety section
  - status guidance section
- Leads: `components/dashboard/leads-dashboard.tsx`
  - lead settings form
  - summary section
  - captured leads search/list/table
  - loading/error/empty variants

### Static public/auth surfaces (`src/*`)

- `src/index.html`
  - `data-page="home"`: Exception Desk live demo
  - `data-page="solutions"`: hero, 3-step flow, catches, integrations, CTA
  - `data-page="book"`: hero, prep card, calendar card, reassurance
  - `data-page="install"`: hero, snippets, live preview, white-label, plans, CTA
  - shared top nav/drawer/footer
- `src/sign-in.html`, `src/sign-up.html`
  - intro section
  - Clerk mount card
  - footer action row

### Widget telemetry/runtime

- Runtime file: `src/public/scripts/grindctrl-support-runtime.js`
- Current tracked events:
  - `widget_heartbeat`
  - `widget_open`
  - `widget_close`
  - `conversation_start`
  - `message_sent`
  - `intent_click`
  - `lead_capture_skipped`
  - `lead_captured`
  - `escalation_trigger`
- Existing install verification RPC: `public.dashboard_get_install_verification`

## In Scope

1. Full visual and structural refinement of all in-scope sections listed above.
2. shadcn-first composition for Next dashboard tabs and shared primitives.
3. Production charting for widget interaction deltas and trends using real data.
4. Mobile/tablet/desktop behavior and EN/AR RTL correctness.
5. Complete UI state coverage where relevant (loading, empty, error, disabled, success).
6. Accessibility baseline across interactive controls.

## Out of Scope

- Framework rewrite of static pages into Next unless DG-01 selects that path.
- New fabricated KPI sources not backed by `widget_events`, `widget_messages`, or `widget_leads`.
- Non-essential backend rewrites outside chart/read-model requirements.
- Widget runtime API version breaking changes (`/widget/v1/*`).

## User Stories

### User Story 1 (P1): Unified shell quality across all dashboard tabs

As an authenticated user, I can move across Overview, Install, Branding, Intents, Domains, and Leads with consistent layout, spacing, hierarchy, and interaction behavior.

### User Story 2 (P1): Auth surfaces feel intentional and production-grade

As a returning/new user, I can use sign-in and sign-up with clean composition, readable hierarchy, and first-class Clerk integration on all supported breakpoints.

### User Story 3 (P1): Landing sections are coherent and maintainable

As a visitor, I get a consistent design language and responsive behavior across all landing sections, without visual drift between pages.

### User Story 4 (P1): Widget interaction charts show real differences over time

As an operator, I can see interaction deltas (open/close/messages/intents/leads/escalations/heartbeats) across selectable time windows and understand changes without synthetic data.

### User Story 5 (P1): EN/AR and RTL are first-class across all refined surfaces

As an Arabic or English user, I can use every refined section without directionality regressions, clipping, broken icon placement, or mixed-direction readability issues.

## Functional Requirements

- **FR-001**: Every listed dashboard section MUST be reviewed and refined; no tab may remain in mixed-quality state.
- **FR-002**: Next dashboard tab UIs MUST use shadcn primitives for cards, tables, alerts, forms, and navigation where equivalents exist.
- **FR-003**: Dashboard shell MUST preserve stable nav behavior on mobile and desktop and avoid runtime composition errors.
- **FR-004**: Each dashboard tab MUST include loading, empty, error, disabled, and success states where applicable.
- **FR-005**: Form inputs MUST expose labels, validation feedback, and `aria-invalid` behavior for invalid states.
- **FR-006**: Destructive row actions MUST include clear separation and confirmation affordance.
- **FR-007**: Widget interaction charting MUST only use real backend data paths.
- **FR-008**: Chart cards MUST include explicit zero-data states and error messaging.
- **FR-009**: Chart views MUST support at least three windows (24h, 7d, 30d).
- **FR-010**: Chart logic MUST distinguish event categories by event name (not synthetic grouping only).
- **FR-011**: Chart labels and legends MUST remain readable in both LTR and RTL.
- **FR-012**: Landing sections in selected canonical surface (DG-01) MUST be polished section-by-section.
- **FR-013**: Auth pages in selected canonical surface (DG-01) MUST match the same visual quality bar.
- **FR-014**: If both static and Next surfaces stay active, parity-critical sections MUST not diverge in messaging hierarchy and CTA semantics.
- **FR-015**: No chart or KPI may claim conversation analytics that are unavailable from contracts.
- **FR-016**: Install verification (`last_heartbeat_at`, `last_seen_origin`, `last_seen_domain`) MUST remain visible and accurate.
- **FR-017**: New event-read RPCs MUST enforce workspace/site access boundaries.
- **FR-018**: Domain, intent, and lead views MUST preserve current backend authority boundaries (`settings_json`, dashboard RPCs).
- **FR-019**: UI refinements MUST avoid introducing horizontal overflow at 390px and 480px widths.
- **FR-020**: UI refinements MUST include keyboard-visible focus states for primary controls.
- **FR-021**: All new chart and dashboard copy MUST be localizable.
- **FR-022**: Runtime telemetry naming used by charts MUST match emitted `event_name` values exactly.
- **FR-023**: Overview analytics placeholders MUST be replaced by real chart modules or explicit deferred modules (not ambiguous text).
- **FR-024**: Refinement MUST keep widget runtime isolated and avoid assumptions that host-page CSS can style the widget.

## Data And Contract Requirements For Charts

Minimum contract additions required:

1. **Timeseries RPC** (new)
   - Inputs: `p_clerk_user_id`, `p_site_id`, `p_window`, optional timezone.
   - Output per bucket: timestamp + counts by event type.

2. **Event mix RPC** (new)
   - Inputs: same scope/time filters.
   - Output: totals by event name in window.

3. **Funnel summary RPC** (optional but recommended)
   - Output counters for:
     - opens
     - conversation starts
     - messages sent
     - leads captured
     - escalations triggered

4. **Guardrails**
   - Count unknown event names under `other`.
   - Never drop failed query silently; render explicit error state.

## Non-Functional Requirements

- **NFR-001**: Keep server components where practical; avoid unnecessary client-only expansion.
- **NFR-002**: Preserve responsive quality at 390/480/640/768/1024/1280+.
- **NFR-003**: Preserve accessibility basics (semantic regions, labels, focus visibility, keyboard safety).
- **NFR-004**: Maintain testability with route-level and component-level coverage where logic changes.

## Acceptance Criteria

1. Every dashboard tab shows coherent section composition and complete state handling.
2. Widget interaction charts render real data and show meaningful event differences by time window.
3. Install verification remains accurate and integrated with chart views.
4. Auth + landing (chosen canonical surface) pass mobile/tablet/desktop and RTL checks.
5. No known runtime shell regressions (`TooltipProvider`/`asChild` child shape) remain.
6. No fake analytics language remains in production dashboard copy.

## Risks

- Dual-surface architecture can create parity drift unless DG-01 is resolved early.
- Event volume may be low for some sites; chart UX must handle sparse datasets gracefully.
- Existing custom Tailwind blocks may conflict with shadcn spacing rhythm if migrated partially.

## Deliverables

- Approved UI architecture choice (DG-01).
- Implemented refinements per section inventory.
- Production chart module(s) + supporting RPC/data adapter layer.
- Responsive/RTL/accessibility QA report.
- Deployment and smoke validation evidence.
