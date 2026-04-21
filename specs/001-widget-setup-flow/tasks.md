# Tasks: Widget Setup Flow

**Input**: Design documents from `/specs/001-widget-setup-flow/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Manual smoke tests across breakpoints, EN/AR states, widget behavior, and runtime regression checks are included as validation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, schema changes, and validation scope capture

- [x] T001 Create database migration `supabase/widget_setup_extensions.sql` with JSONB columns, new tables, indexes, and RLS policies
- [x] T002 [P] Apply database migration via Supabase MCP or SQL Editor and verify columns/tables exist
- [x] T003 [P] Add i18n keys to `src/scripts/i18n.js` for all new dashboard labels, placeholders, and status messages (EN + AR)
- [x] T004 [P] Register any new Shoelace components needed in `src/scripts/web-awesome.js` (e.g., wa-dialog, wa-select, wa-color-picker)
- [x] T005 Capture validation scope: document which breakpoints, EN/AR states, widget surfaces, auth flows, and runtime paths must be checked before each story is closed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data layer and shared UI utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 [P] Extend `src/lib/clerk-supabase-sync.js` with CRUD helpers for widget sites (create, list, update, delete, regenerate embed key)
- [x] T007 [P] Extend `src/lib/clerk-supabase-sync.js` with CRUD helpers for widget domains (list by site, add, remove, update status)
- [x] T008 [P] Extend `src/lib/clerk-supabase-sync.js` with CRUD helpers for widget intents (list by site, create, update, delete, reorder)
- [x] T009 [P] Extend `src/lib/clerk-supabase-sync.js` with lead operations (list by workspace/site, submit from widget)
- [x] T010 [P] Add shared dashboard utility functions in `src/scripts/app.js` (or new `src/lib/dashboard-utils.js`): loading states, empty states, inline error display, copy-to-clipboard wrapper, confirmation dialogs
- [x] T011 Add site selector UI to `src/app.html` (dropdown or sidebar list) for switching between widget sites
- [x] T012 Add site selector styles to `src/app.css` (responsive, RTL-aware)
- [x] T013 Wire site selector in `src/scripts/app.js` to load selected site config into global state

**Checkpoint**: Foundation ready — data layer can create/list/update/delete sites, domains, intents, and leads; site selector loads config; shared UI utilities work. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Create and Configure a Widget Site (Priority: P1) 🎯 MVP

**Goal**: A business owner can create a widget site, see it in a list, select it, view the real embed key and install snippet, and configure basic widget behavior.

**Independent Test**: Sign in → navigate to Widget Setup → create a site → see it in list → select it → embed key and snippet are real and copyable → change launcher position/label/greeting → save → refresh → changes persist.

### Validation for User Story 1

- [ ] T014 [P] [US1] Manually verify Widget Setup screen in mobile (390px), tablet (768px), and desktop (1280px)
- [ ] T015 [P] [US1] Manually verify Widget Setup screen in Arabic RTL mode (dir="rtl", lang="ar")
- [x] T016 [P] [US1] Run `npm run build` and confirm no build errors after US1 changes
- [ ] T017 [US1] Smoke test: sign-in → create site → copy snippet → verify widget loads with embed key on localhost

### Implementation for User Story 1

- [x] T018 [P] [US1] Build empty state UI in `src/app.html` for "no widget sites" with "Create Widget Site" CTA
- [x] T019 [P] [US1] Build widget site list UI in `src/app.html` (cards or rows showing name, status, creation date)
- [x] T020 [US1] Wire "Create Widget Site" flow in `src/scripts/app.js`: show name input, call `createWidgetSite`, refresh list, auto-select new site
- [x] T021 [P] [US1] Build embed key display + copy button in `src/app.html` (inside Widget Setup screen)
- [x] T022 [P] [US1] Build install snippet box in `src/app.html` with real embed key and copy button
- [x] T023 [US1] Wire embed key copy and snippet copy in `src/scripts/app.js` with success feedback
- [x] T024 [P] [US1] Build widget configuration form in `src/app.html`: launcher position select, launcher label input, greeting textarea, support mode select, active/inactive toggle
- [x] T025 [US1] Wire config form save in `src/scripts/app.js`: read form values, update `widget_sites.config_json`, show success/error toast
- [x] T026 [US1] Update `src/scripts/app.js` `populateDashboard` to use real site data for install snippet card (remove hardcoded values)
- [x] T027 [US1] Add loading skeletons and empty states to Widget Setup screen in `src/app.html` and `src/app.css`
- [x] T028 [US1] Verify no widget, auth/dashboard, or runtime regressions in affected flows

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. A user can create a site, copy the real snippet, and configure the widget.

---

## Phase 4: User Story 2 - Manage Domains and Security (Priority: P1)

**Goal**: A business can add domains to a widget site, see verification status, verify/reject as admin, remove domains, and regenerate the embed key.

**Independent Test**: Select a site → go to Domains screen → add `example.com` → see it as pending → as admin click Verify → status changes to verified → click Regenerate Embed Key → confirm → new key appears in snippet → remove domain → it disappears.

### Validation for User Story 2

- [ ] T029 [P] [US2] Manually verify Domains screen in mobile, tablet, and desktop breakpoints
- [ ] T030 [P] [US2] Manually verify Domains screen in Arabic RTL mode
- [x] T031 [P] [US2] Run `npm run build` and confirm no build errors after US2 changes
- [ ] T032 [US2] Smoke test: add domain → verify as admin → regenerate key → verify old key no longer works

### Implementation for User Story 2

- [x] T033 [P] [US2] Build domain list UI in `src/app.html` (domain name + status badge + actions per row)
- [x] T034 [P] [US2] Build "Add Domain" form in `src/app.html` (input + add button, with localhost hint)
- [x] T035 [US2] Wire domain CRUD in `src/scripts/app.js`: list domains for selected site, add domain, remove domain
- [x] T036 [US2] Add admin-only "Verify" and "Reject" buttons to domain items in `src/app.html`
- [x] T037 [US2] Wire domain status update in `src/scripts/app.js`: check user role, call update domain status, refresh list
- [x] T038 [US2] Add "Regenerate Embed Key" button with confirmation dialog in `src/app.html`
- [x] T039 [US2] Wire embed key regeneration in `src/scripts/app.js`: show warning, call RPC or update, refresh all embed key displays
- [x] T040 [US2] Add visual distinction between public embed key and admin dashboard access in `src/app.html`
- [x] T041 [US2] Update `src/scripts/grindctrl-support.js` to validate domain against `widget_domains` list (allow localhost always)
- [x] T042 [US2] Add loading/error/empty states to Domains screen in `src/app.html` and `src/app.css`
- [x] T043 [US2] Verify no widget, auth/dashboard, or runtime regressions in affected flows

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Domains can be managed and the embed key can be rotated securely.

---

## Phase 5: User Story 3 - Customize Branding and Intents (Priority: P2)

**Goal**: A business can set brand name, colors, and logo in the Branding screen, and manage quick intent buttons in the Intents screen.

**Independent Test**: Select a site → go to Branding → change name to "Acme", primary color to red, add logo URL → save → go to Intents → add "Talk to Sales" intent → save → widget preview shows new brand and intent button.

### Validation for User Story 3

- [ ] T044 [P] [US3] Manually verify Branding and Intents screens in mobile, tablet, and desktop
- [ ] T045 [P] [US3] Manually verify Branding and Intents screens in Arabic RTL mode
- [x] T046 [P] [US3] Run `npm run build` and confirm no build errors after US3 changes
- [ ] T047 [US3] Smoke test: change branding + add intent → open widget on localhost → verify visual changes and intent button appear

### Implementation for User Story 3

- [x] T048 [P] [US3] Build Branding form in `src/app.html`: brand name input, primary color picker, accent color picker, logo URL input
- [x] T049 [US3] Wire branding save in `src/scripts/app.js`: read form values, update `widget_sites.branding_json`, show preview
- [x] T050 [P] [US3] Build intent list UI in `src/app.html` (label, icon, action type badge, edit/remove per row)
- [x] T051 [P] [US3] Build "Add/Edit Intent" form in `src/app.html` (label, icon select, action type, message text, sort order)
- [x] T052 [US3] Wire intent CRUD in `src/scripts/app.js`: list intents for site, create intent, update intent, delete intent, reorder
- [x] T053 [US3] Update `src/scripts/grindctrl-support.js` to read and apply branding_json (colors, logo, brand name)
- [x] T054 [US3] Update `src/scripts/grindctrl-support.js` to read and render widget_intents as quick action buttons
- [x] T055 [P] [US3] Add intent action handlers in `src/scripts/grindctrl-support.js` (send_message, escalate, external_link)
- [x] T056 [US3] Add loading/error/empty states to Branding and Intents screens in `src/app.html` and `src/app.css`
- [x] T057 [US3] Verify no widget, auth/dashboard, or runtime regressions in affected flows

**Checkpoint**: User Stories 1, 2, and 3 are all independently functional. The widget is visually branded and has working quick intents.

---

## Phase 6: User Story 4 - Capture and Review Leads (Priority: P2)

**Goal**: A business can enable lead capture, configure timing mode and fields, and view captured leads in the dashboard.

**Independent Test**: Select a site → go to Widget Setup → enable lead capture, choose "Before skippable", select name + email fields → save → open widget on localhost → see lead form before chat → fill and submit → go to Leads panel in dashboard → see the submitted lead.

### Validation for User Story 4

- [ ] T058 [P] [US4] Manually verify lead capture flow in widget on mobile and desktop
- [ ] T059 [P] [US4] Manually verify Leads panel in dashboard in EN and AR
- [x] T060 [P] [US4] Run `npm run build` and confirm no build errors after US4 changes
- [ ] T061 [US4] Smoke test: submit lead from widget → verify it appears in dashboard Leads panel within 5 seconds

### Implementation for User Story 4

- [x] T062 [P] [US4] Build Lead Capture config form in `src/app.html`: enable toggle, timing mode select, field checkboxes (name/email/phone/company), prompt text textarea
- [x] T063 [US4] Wire lead capture save in `src/scripts/app.js`: read form values, update `widget_sites.lead_capture_json`
- [x] T064 [P] [US4] Build Leads panel UI in `src/app.html` (table or card list with name, email, phone, company, source domain, timestamp)
- [x] T065 [US4] Wire leads list in `src/scripts/app.js`: fetch `widget_leads` for workspace/site, render list, show empty state
- [x] T066 [US4] Update `src/scripts/grindctrl-support.js` to conditionally show lead capture form based on `lead_capture_json`
- [x] T067 [US4] Implement lead form rendering in `src/scripts/grindctrl-support.js` (dynamic fields from `fields_enabled`)
- [x] T068 [US4] Implement lead form submission in `src/scripts/grindctrl-support.js` (insert into `widget_leads`, respect `deduplicate_session` via sessionStorage)
- [x] T069 [US4] Implement all 5 timing modes in `src/scripts/grindctrl-support.js` (before_required, before_skippable, during, disabled, after)
- [x] T070 [US4] Add RLS policy for `widget_leads` allowing public insert (from widget) and authenticated read (from dashboard)
- [x] T071 [US4] Add loading/error/empty states to Lead Capture and Leads panel in `src/app.html` and `src/app.css`
- [x] T072 [US4] Verify no widget, auth/dashboard, or runtime regressions in affected flows

**Checkpoint**: All four user stories are independently functional. Lead capture works end-to-end from widget to dashboard.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final quality gates

- [x] T073 [P] Update `specs/001-widget-setup-flow/quickstart.md` with any deviations discovered during implementation
- [x] T074 [P] Update AGENTS.md plan reference if implementation revealed new architectural patterns
- [ ] T075 [P] Run full responsive pass: test all dashboard screens at 390px, 480px, 540px, 640px, 768px, 1024px, 1280px, 1536px
- [ ] T076 [P] Run RTL pass: test all dashboard screens in Arabic mode for alignment, spacing, truncation, icon direction
- [ ] T077 [P] Run widget safety pass: verify embeddable widget still works in narrow containers, no global CSS leakage
- [ ] T078 [P] Run auth/dashboard parity pass: verify sign-in, sign-up, and dashboard still visually consistent
- [x] T079 [P] Run runtime regression pass: verify `npm run build` succeeds, no console errors on app boot, widget loads on active sites
- [x] T080 [P] Audit all copy for i18n coverage: ensure every new label, button, placeholder, and error message has EN and AR keys in `src/scripts/i18n.js`
- [x] T081 [P] Verify all success/error/loading/empty states are implemented and visually consistent across all screens
- [ ] T082 [P] Verify embed key and snippet copy actions work on first attempt in Chrome, Firefox, Safari, Edge
- [x] T083 Final `npm run build` and preview (`npm run preview`) to confirm production build quality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001–T002) — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion
  - Can proceed in parallel if staffed, or sequentially in priority order
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories.
- **User Story 2 (P1)**: Can start after Foundational (Phase 2). Integrates with US1 (uses same site selector and embed key display) but domain management is independently testable.
- **User Story 3 (P2)**: Can start after Foundational (Phase 2). Branding and intents are independently testable; widget rendering depends on `grindctrl-support.js` changes.
- **User Story 4 (P2)**: Can start after Foundational (Phase 2). Lead capture is independently testable; depends on widget being able to load config (which US1 enables).

### Within Each User Story

- UI markup in `src/app.html` before wiring in `src/scripts/app.js`
- Data layer methods in `src/lib/clerk-supabase-sync.js` before dashboard wiring
- Dashboard wiring before widget script updates
- Story complete before moving to next priority

### Parallel Opportunities

- T006–T009 (data layer helpers) can all be written in parallel
- T018–T019, T021–T022, T024 (US1 UI markup) can be built in parallel
- T048, T050–T051 (US3 UI markup) can be built in parallel
- T062, T064 (US4 UI markup) can be built in parallel
- All validation/smoke test tasks (T014–T017, T029–T032, etc.) can be run in parallel after implementation
- All Polish phase tasks (T073–T083) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all UI markup tasks together:
Task: "Build empty state UI in src/app.html"
Task: "Build widget site list UI in src/app.html"
Task: "Build embed key display + copy button in src/app.html"
Task: "Build install snippet box in src/app.html"
Task: "Build widget configuration form in src/app.html"

# Then wire them together:
Task: "Wire 'Create Widget Site' flow in src/scripts/app.js"
Task: "Wire config form save in src/scripts/app.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T013)
3. Complete Phase 3: User Story 1 (T014–T028)
4. **STOP and VALIDATE**: Test User Story 1 independently — sign in, create site, copy snippet, configure widget
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (site creation + config)
   - Developer B: User Story 2 (domains + security)
   - Developer C: User Story 3 (branding + intents)
   - Developer D: User Story 4 (lead capture)
3. Stories complete and integrate independently
4. Team converges on Polish phase together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify responsive, EN/AR, widget, auth/dashboard, and runtime checks before closing each story
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
