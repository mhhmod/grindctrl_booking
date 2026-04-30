# Tasks: Full Surface UI Refinement + Widget Interaction Analytics

**Input**: `specs/003-full-surface-ui-refinement/spec.md`, `specs/003-full-surface-ui-refinement/plan.md`  
**Prerequisites**: Decision gates (DG-01..DG-05) resolved in spec clarifications.

## Format: `[ID] [P?] [Story] Description`

- **[P]** = can be done in parallel (different files, no blocking dependency)
- **[Story]** = US1..US5 from the spec

---

## Phase 1: Gate + Foundation

- [x] T001 [US1] Record DG-01..DG-05 outcomes in `specs/003-full-surface-ui-refinement/spec.md`
- [x] T002 [US1] Stabilize shell runtime composition in `apps/web-next/components/dashboard/dashboard-shell.tsx` (tooltip/asChild child-shape correctness)
- [x] T003 [P] [US1] Align shared token usage and typography in `apps/web-next/app/globals.css`
- [x] T004 [P] [US1] Add missing shadcn chart primitive(s) in `apps/web-next/components/ui/` (if not present)

---

## Phase 2: Dashboard Tabs (US1)

- [x] T005 [US1] Refine overview card composition and state handling in `apps/web-next/components/dashboard/overview-page-content.tsx`
- [x] T006 [US1] Refine install layout consistency and state hierarchy in `apps/web-next/components/dashboard/install-page-content.tsx`
- [x] T007 [US1] Refine branding form composition/validation semantics in `apps/web-next/components/dashboard/branding-form.tsx`
- [x] T008 [US1] Refine intents manager form/list/action consistency in `apps/web-next/components/dashboard/intents-manager.tsx`
- [x] T009 [US1] Refine domains manager add/update/remove flow composition in `apps/web-next/components/dashboard/domains-manager.tsx`
- [x] T010 [US1] Refine leads dashboard settings/list/search/table composition in `apps/web-next/components/dashboard/leads-dashboard.tsx`
- [x] T011 [P] [US1] Standardize site-selector behavior and layout in `apps/web-next/components/dashboard/site-selector.tsx`

---

## Phase 3: Analytics Contracts + Adapters (US4)

- [x] T012 [US4] Add migration SQL for `dashboard_widget_events_timeseries` in `supabase/` (new file)
- [x] T013 [US4] Add migration SQL for `dashboard_widget_events_breakdown` in `supabase/` (new file)
- [x] T014 [P] [US4] Add optional `dashboard_widget_funnel_summary` SQL in `supabase/` (new file)
- [x] T015 [US4] Add typed adapter module `apps/web-next/lib/adapters/widgetEvents.ts`
- [x] T016 [P] [US4] Extend chart DTOs in `apps/web-next/lib/types.ts`
- [x] T017 [P] [US4] Add adapter tests for transforms/error handling in `apps/web-next/lib/adapters/widgetEvents.test.ts`

---

## Phase 4: Chart UI Integration (US4)

- [x] T018 [US4] Implement interaction timeseries chart component in `apps/web-next/components/dashboard/` (new file)
- [x] T019 [US4] Implement event-mix chart component in `apps/web-next/components/dashboard/` (new file)
- [x] T020 [P] [US4] Implement funnel summary module in `apps/web-next/components/dashboard/` (new file, optional)
- [x] T021 [US4] Integrate chart module(s) into `apps/web-next/components/dashboard/overview-page-content.tsx`
- [x] T022 [US4] Integrate chart module(s) into `apps/web-next/components/dashboard/install-page-content.tsx` when DG-02 includes install
- [x] T023 [US4] Implement loading/empty/error/success states for all chart cards in integrated files

---

## Phase 5: Auth Refinement (US2)

- [x] T024 [US2] If DG-01=Next: refine sign-in shell in `apps/web-next/app/sign-in/[[...sign-in]]/page.tsx`
- [x] T025 [US2] If DG-01=Next: refine sign-up shell in `apps/web-next/app/sign-up/[[...sign-up]]/page.tsx`
- [x] T026 [US2] If DG-01=static: refine `src/sign-in.html` + `src/auth.css` (N/A with DG-01=Next)
- [x] T027 [US2] If DG-01=static: refine `src/sign-up.html` + `src/auth.css` (N/A with DG-01=Next)
- [x] T028 [US2] Add/adjust auth tests for fallback and render states in active auth surface

---

## Phase 6: Landing Refinement (US3)

- [x] T029 [US3] If DG-01=Next: refine section architecture in `apps/web-next/app/page.tsx`
- [x] T030 [US3] If DG-01=static: refine home sections in `src/index.html` and related CSS (N/A with DG-01=Next)
- [x] T031 [US3] If DG-01=static: refine solutions sections in `src/index.html` and related CSS (N/A with DG-01=Next)
- [x] T032 [US3] If DG-01=static: refine book sections in `src/index.html` and related CSS (N/A with DG-01=Next)
- [x] T033 [US3] If DG-01=static: refine install sections in `src/index.html` and related CSS (N/A with DG-01=Next)
- [x] T034 [US3] Refine shared navigation/drawer/footer consistency in active landing surface

---

## Phase 7: EN/AR + RTL + Responsive + A11y (US5)

- [ ] T035 [US5] Verify and fix mobile layout issues at 390/480 for dashboard tabs
- [ ] T036 [US5] Verify and fix tablet/desktop layout issues at 640/768/1024/1280+ for dashboard tabs
- [ ] T037 [US5] Verify and fix mobile/tablet/desktop issues for active landing/auth surfaces
- [ ] T038 [US5] RTL pass for dashboard + charts (label order, icon order, truncation, mixed-direction strings)
- [ ] T039 [US5] RTL pass for active landing/auth surfaces
- [ ] T040 [US5] Accessibility pass for keyboard focus, labels, and semantic grouping across updated screens

---

## Phase 8: Verification + Release

- [x] T041 [US1] Run `npm test` in `apps/web-next`
- [x] T042 [US1] Run `npm run build` in `apps/web-next`
- [ ] T043 [US3] If static touched: run root `npm run build`
- [ ] T044 [US4] Manual chart validation: 24h/7d/30d windows, zero-data and error states
- [ ] T045 [US1] Manual dashboard smoke on `/dashboard/{overview,install,branding,intents,domains,leads}`
- [ ] T046 [US2] Manual auth smoke in active auth surface
- [ ] T047 [US3] Manual landing smoke in active landing surface
- [ ] T048 [US1] Production deploy verification and regression check

---

## Execution Notes

- Complete Phase 1 before any heavy UI migration.
- Complete Phase 3 before integrating chart UI in Phase 4.
- If DG-01 keeps dual surfaces active, complete parity checks before release.
- Do not mark chart tasks complete until data is verified against real `widget_events` records.
