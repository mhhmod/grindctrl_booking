# Tasks: Refine Current UI Stabilization

**Input**: Design documents from `/specs/001-ui-stabilization/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-runtime-contract.md`, `quickstart.md`

**Tests**: Manual responsive, EN/AR, widget, auth, dashboard, and runtime validation tasks are included for every story because this feature changes shared UI, auth flows, widget behavior, localization, and runtime paths.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently inside this brownfield repo.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when the referenced files are not shared with incomplete tasks
- **[Story]**: User story label from `spec.md` (`[US1]` to `[US6]`)
- Every task includes the exact file path to change or validate

## Path Conventions

- Single-project Vite app rooted at `src/`
- Classic copied scripts live under `src/public/scripts/`
- Manual Supabase migrations live under `supabase/`

## Phase 1: Setup

**Purpose**: Audit the brownfield baseline and lock the validation scope before editing.

- [X] T001 Audit the brownfield baseline against `specs/001-ui-stabilization/plan.md`, `src/index.html`, `src/sign-in.html`, `src/sign-up.html`, `src/app.html`, `src/tokens.css`, `src/layout.css`, `src/components.css`, `src/auth.css`, `src/app.css`, `src/chat-widget.css`, `src/overrides.css`, `src/scripts/site-header.js`, `src/scripts/clerk-header.js`, `src/scripts/clerk-appearance.js`, `src/public/scripts/chat-widget.js`, `src/public/scripts/grindctrl-support.js`, `src/lib/supabase.js`, and `src/lib/clerk-supabase-sync.js`
- [X] T002 Capture the required responsive, EN/AR, contrast, widget, and runtime validation matrix from `specs/001-ui-stabilization/quickstart.md` and `specs/001-ui-stabilization/contracts/ui-runtime-contract.md`
- [X] T003 [P] Inventory fragile in-scope icon usage in `src/index.html`, `src/sign-in.html`, `src/sign-up.html`, `src/app.html`, `src/public/scripts/chat-widget.js`, and `src/public/scripts/grindctrl-support.js`

---

## Phase 2: Foundational

**Purpose**: Shared foundations that block all story work.

**Critical**: Finish this phase before starting user story implementation.

- [X] T004 Update dark-surface contrast, spacing, and focus tokens in `src/tokens.css` and `src/base.css`
- [X] T005 [P] Tighten shared shell, container, and RTL-safe layout rules in `src/layout.css` and `src/overrides.css`
- [X] T006 [P] Normalize shared buttons, cards, inputs, focus states, and icon-container rules in `src/components.css`
- [X] T007 Create the shared in-scope SVG icon set in `src/public/icons/menu.svg`, `src/public/icons/chevron-start.svg`, `src/public/icons/chevron-end.svg`, `src/public/icons/send.svg`, and `src/public/icons/user.svg`
- [X] T008 Validate foundational changes against `package.json`, `src/tokens.css`, `src/layout.css`, `src/components.css`, and `src/overrides.css` with a no-regression build and shared-surface review

**Checkpoint**: Shared dark-mode, spacing, RTL, and icon foundations are ready for story work.

---

## Phase 3: User Story 1 - Use public and auth surfaces that feel premium and readable (Priority: P1)

**Goal**: Restore premium composition, strong readability, and stable responsive behavior across the landing/auth entry surfaces and the auth page shells.

**Independent Test**: Open `src/index.html`, `src/sign-in.html`, and `src/sign-up.html` on representative mobile and desktop widths and confirm the first impression is readable, intentional, on-brand, and stable in English and Arabic.

### Validation for User Story 1

- [X] T009 [P] [US1] Validate the public/auth surface contract in `specs/001-ui-stabilization/contracts/ui-runtime-contract.md` against `src/index.html`, `src/sign-in.html`, and `src/sign-up.html`

### Implementation for User Story 1

- [X] T010 [P] [US1] Refine public auth-entry composition, shell contrast, and nearby first-impression balance in `src/index.html`
- [X] T011 [US1] Tighten premium auth-shell spacing, contrast, and composition in `src/auth.css`
- [X] T012 [P] [US1] Update sign-in brand lockup, intro balance, and shell markup in `src/sign-in.html`
- [X] T013 [P] [US1] Update sign-up brand lockup, intro balance, and shell markup in `src/sign-up.html`
- [X] T014 [US1] Sync revised auth/public shell copy and parity-sensitive labels in `src/public/scripts/i18n.js`
- [X] T015 [US1] Validate `src/index.html`, `src/sign-in.html`, and `src/sign-up.html` at `320`, `360`, `375`, `390`, `414`, and `768` in EN/AR for readability, contrast, and composition

**Checkpoint**: User Story 1 is independently functional and visually stable.

---

## Phase 4: User Story 2 - Experience Clerk-auth UI as part of the GRINDCTRL product (Priority: P1)

**Goal**: Make Clerk-rendered auth controls feel native to the GRINDCTRL dark shell using supported appearance configuration only.

**Independent Test**: Load the Clerk sign-in and sign-up flows and confirm fields, buttons, separators, helper text, and edge states match the surrounding GRINDCTRL auth shell.

### Validation for User Story 2

- [X] T016 [P] [US2] Validate the Clerk integration contract in `specs/001-ui-stabilization/contracts/ui-runtime-contract.md` against `src/scripts/clerk-appearance.js`, `src/scripts/auth-sign-in.js`, and `src/scripts/auth-sign-up.js`

### Implementation for User Story 2

- [X] T017 [US2] Recalibrate `GRINDCTRL_APPEARANCE` variables and elements in `src/scripts/clerk-appearance.js`
- [X] T018 [P] [US2] Align Clerk sign-in mount behavior with the refined auth shell in `src/scripts/auth-sign-in.js`
- [X] T019 [P] [US2] Align Clerk sign-up mount behavior with the refined auth shell in `src/scripts/auth-sign-up.js`
- [X] T020 [US2] Add minimal Clerk container-state integration styles in `src/auth.css`
- [X] T021 [US2] Validate Clerk loading, validation, error, and alternate-step states in `src/sign-in.html`, `src/sign-up.html`, `src/scripts/clerk-appearance.js`, and browser runtime

**Checkpoint**: User Story 2 is independently functional and visually aligned with User Story 1.

---

## Phase 5: User Story 3 - Use the mobile header and drawer cleanly in English and Arabic (Priority: P1)

**Goal**: Remove header collisions and make the mobile drawer geometry, control priority, and RTL/LTR behavior stable.

**Independent Test**: Open the landing page on phone widths in English and Arabic, then verify the closed header and open drawer both remain clean, legible, and directionally correct.

### Validation for User Story 3

- [X] T022 [P] [US3] Validate the navigation contract in `specs/001-ui-stabilization/contracts/ui-runtime-contract.md` against `src/index.html`, `src/scripts/site-header.js`, and `src/scripts/clerk-header.js`

### Implementation for User Story 3

- [X] T023 [US3] Rework mobile header action priority, auth affordance footprint, and drawer trigger markup in `src/index.html`
- [X] T024 [US3] Refine mobile header, drawer, and RTL-safe spacing rules in `src/components.css` and `src/overrides.css`
- [X] T025 [P] [US3] Update drawer placement, focus handling, and direction sync in `src/scripts/site-header.js`
- [X] T026 [P] [US3] Align signed-in account/auth affordance behavior with the refined mobile header in `src/scripts/clerk-header.js`
- [X] T027 [US3] Validate `src/index.html`, `src/components.css`, `src/overrides.css`, `src/scripts/site-header.js`, and `src/scripts/clerk-header.js` at `320`, `360`, `375`, `390`, `414`, and `768` in EN/AR with no collisions or drawer artifacts

**Checkpoint**: User Story 3 is independently functional on constrained mobile widths.

---

## Phase 6: User Story 4 - Use the widget and mockup without input-row breakage (Priority: P1)

**Goal**: Keep the real widget and demo/mockup composer fully contained, directionally correct, and stable under narrow-width stress.

**Independent Test**: Open the demo/mockup and the real widget on mobile and desktop, switch EN/AR, and confirm the composer row, quick actions, and send control never break containment.

### Validation for User Story 4

- [X] T028 [P] [US4] Validate the widget contract in `specs/001-ui-stabilization/contracts/ui-runtime-contract.md` against `src/chat-widget.css`, `src/public/scripts/chat-widget.js`, and `src/public/scripts/grindctrl-support.js`

### Implementation for User Story 4

- [X] T029 [US4] Refine trial widget and demo/mockup composer containment rules in `src/chat-widget.css`
- [X] T030 [US4] Update demo/mockup widget markup and in-page layout hooks in `src/index.html`
- [X] T031 [P] [US4] Stabilize trial widget directionality, send-row sizing, and quick-action wrapping in `src/public/scripts/chat-widget.js`
- [X] T032 [P] [US4] Mirror the shared composer contract and contained send-row behavior in `src/public/scripts/grindctrl-support.js`
- [X] T033 [US4] Validate `src/index.html`, `src/chat-widget.css`, `src/public/scripts/chat-widget.js`, and `src/public/scripts/grindctrl-support.js` across EN/AR and narrow-width composer stress cases

**Checkpoint**: User Story 4 is independently functional across both widget variants.

---

## Phase 7: User Story 6 - Load the dashboard and widget surfaces without prior Supabase/runtime instability (Priority: P1)

**Goal**: Remove known Supabase and runtime regressions without weakening security or collapsing the UI shell during transient failures.

**Independent Test**: Load the dashboard and widget-backed flows, confirm there are no duplicate-client warnings or known `widget_sites`/policy recursion failures, and verify transient failures keep the shell/frame visible with inline error feedback.

### Validation for User Story 6

- [X] T034 [P] [US6] Validate the runtime integration contract in `specs/001-ui-stabilization/contracts/ui-runtime-contract.md` against `src/lib/supabase.js`, `src/lib/clerk-supabase-sync.js`, `src/scripts/app.js`, `src/public/scripts/chat-widget.js`, and `src/public/scripts/grindctrl-support.js`

### Implementation for User Story 6

- [X] T035 [US6] Harden singleton creation, init guards, and project separation in `src/lib/supabase.js` and `src/lib/clerk-supabase-sync.js`
- [X] T036 [US6] Add dashboard runtime loading and inline error-state orchestration in `src/scripts/app.js`, `src/app.css`, and `src/public/scripts/i18n.js`
- [X] T037 [P] [US6] Add widget runtime error handling and non-breaking fallback states in `src/public/scripts/chat-widget.js`, `src/public/scripts/grindctrl-support.js`, `src/chat-widget.css`, and `src/public/scripts/i18n.js`
- [X] T038 [US6] Update the confirmed failing RLS or RPC path in `supabase/fix_workspace_members_rls_recursion.sql`, `supabase/fix_workspace_members_rls_commands_split.sql`, `supabase/clerk_bootstrap_functions.sql`, or `supabase/fix_widget_sites_runtime_access.sql` only after reproducing the active issue
- [X] T039 [US6] Validate `src/app.html`, `src/scripts/app.js`, `src/lib/supabase.js`, `src/public/scripts/chat-widget.js`, `src/public/scripts/grindctrl-support.js`, and any touched `supabase/*.sql` path with no duplicate-client, recursion, or `widget_sites` regressions

**Checkpoint**: User Story 6 is independently functional without known runtime regressions.

---

## Phase 8: User Story 5 - Use a dashboard that feels like the same product (Priority: P2)

**Goal**: Bring the protected dashboard shell and first-view cards into the same premium product language as the public/auth experience without overbuilding the app.

**Independent Test**: Sign in, load `src/app.html`, and confirm the shell, first-view cards, and responsive rhythm feel cohesive with the rest of the product on mobile, tablet, and desktop.

### Validation for User Story 5

- [X] T040 [P] [US5] Validate the dashboard contract in `specs/001-ui-stabilization/contracts/ui-runtime-contract.md` against `src/app.html`, `src/app.css`, and `src/scripts/app.js`

### Implementation for User Story 5

- [X] T041 [US5] Refine dashboard shell structure, first-view card composition, and product-grade empty-state scaffolding in `src/app.html`
- [X] T042 [US5] Tighten dashboard shell rhythm, responsive layout, and visual hierarchy in `src/app.css`
- [X] T043 [US5] Align dashboard shell controls and in-scope icon usage with the shared SVG system in `src/app.html`, `src/app.css`, and `src/public/icons/user.svg`
- [X] T044 [US5] Validate `src/app.html`, `src/app.css`, and `src/scripts/app.js` at mobile, tablet, and desktop widths in EN/AR for shell consistency and first-view polish

**Checkpoint**: User Story 5 is independently functional and visually cohesive.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and release-ready cleanup across all stories.

- [X] T045 Run the production build from `package.json` and verify output assumptions in `vite.config.js`
- [X] T046 Run the full manual QA matrix from `specs/001-ui-stabilization/quickstart.md` against `src/index.html`, `src/sign-in.html`, `src/sign-up.html`, `src/app.html`, `src/public/scripts/chat-widget.js`, and `src/public/scripts/grindctrl-support.js`
- [X] T047 Run final console and runtime smoke checks from `specs/001-ui-stabilization/contracts/ui-runtime-contract.md` against `src/lib/supabase.js`, `src/lib/clerk-supabase-sync.js`, `src/scripts/app.js`, `src/public/scripts/chat-widget.js`, and `src/public/scripts/grindctrl-support.js`
- [X] T048 Update validation notes and any unavoidable manual migration follow-up in `specs/001-ui-stabilization/quickstart.md`

---

## Phase 10: Auth And Dashboard Direction Correction

**Purpose**: Apply the revised UI direction after screenshot review without discarding the completed stabilization history.

**Critical**: This phase supersedes the earlier auth visual direction where the new request conflicts with it.

### Validation for Revised Direction

- [X] T049 Validate the revised auth/dashboard visual target from the latest screenshot review against `specs/001-ui-stabilization/spec.md`, `src/sign-in.html`, `src/sign-up.html`, `src/auth.css`, `src/scripts/clerk-appearance.js`, `src/app.html`, and `src/app.css`

### Implementation for Revised Direction

- [X] T050 [US1] Rework auth-only shell palette, surface layering, and background treatment toward restrained gray/off-white/near-white styling in `src/auth.css`
- [X] T051 [P] [US1] Rebalance the sign-in shell markup and copy emphasis to feel calmer and more harmonious with native Clerk in `src/sign-in.html`
- [X] T052 [P] [US1] Rebalance the sign-up shell markup and copy emphasis to feel calmer and more harmonious with native Clerk in `src/sign-up.html`
- [X] T053 [US2] Reduce Clerk appearance overrides so controls stay closer to the native Clerk look while fitting the surrounding auth shell in `src/scripts/clerk-appearance.js`
- [X] T054 [US5] Redesign the dashboard progress, trial-status, and step-treatment UI in `src/app.html` and `src/app.css`
- [X] T055 [US5] Apply screenshot-audit fixes for in-scope dashboard overlap, density, and emphasis issues in `src/app.html`, `src/app.css`, and `src/scripts/app.js`
- [X] T056 [US1] Validate `src/sign-in.html`, `src/sign-up.html`, `src/auth.css`, and `src/scripts/clerk-appearance.js` at `320`, `360`, `375`, `390`, `414`, and `768` in EN/AR for neutral auth palette, readability, and native-like Clerk harmony
- [X] T057 [US5] Validate `src/app.html`, `src/app.css`, and `src/scripts/app.js` at mobile, tablet, and desktop widths in EN/AR for progress readability, step stability, and screenshot-backed dashboard polish
- [X] T058 Run targeted automated regression coverage for the revised auth/dashboard direction in `e2e/stabilization.spec.ts`, `e2e/stabilization-matrix.spec.ts`, and `package.json`

**Checkpoint**: The revised auth and dashboard direction is independently functional and visually aligned with the latest screenshots.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: No dependencies
- Phase 2: Depends on Phase 1 and blocks all user stories
- Phase 3 (US1): Depends on Phase 2
- Phase 4 (US2): Depends on Phase 2 and should follow the auth-shell refinements from US1
- Phase 5 (US3): Depends on Phase 2
- Phase 6 (US4): Depends on Phase 2
- Phase 7 (US6): Depends on Phase 2
- Phase 8 (US5): Depends on Phase 2 and should land after the P1 stories if shared dashboard files are still moving
- Phase 9: Depends on all desired user stories being complete
- Phase 10: Depends on the completed stabilization pass and supersedes conflicting earlier auth/dashboard visual choices

### User Story Dependency Graph

- `Setup -> Foundational -> US1`
- `Foundational -> US3`
- `Foundational -> US4`
- `Foundational -> US6`
- `US1 -> US2`
- `US1 + US2 + US3 + US4 + US6 -> US5`
- `US1 + US2 + US3 + US4 + US5 + US6 -> Polish`
- `Polish -> Direction Correction`

### Within Each User Story

- Run the contract/validation task first to anchor the acceptance target
- Apply markup/CSS/JS changes next in the listed order
- Finish with the story-specific validation task before moving on

### Parallel Opportunities

- `T003` can run while `T001-T002` are being completed
- `T005-T007` can run in parallel after `T004`
- `US1`: `T010`, `T012`, and `T013` can run in parallel after `T011` direction is set
- `US2`: `T018` and `T019` can run in parallel after `T017`
- `US3`: `T025` and `T026` can run in parallel after `T023-T024`
- `US4`: `T031` and `T032` can run in parallel after `T029-T030`
- `US6`: `T036` and `T037` can run in parallel after `T035`
- `Phase 10`: `T051` and `T052` can run in parallel after `T050`

---

## Parallel Example: User Story 1

```text
T010 [US1] Refine public auth-entry composition in src/index.html
T012 [US1] Update sign-in shell markup in src/sign-in.html
T013 [US1] Update sign-up shell markup in src/sign-up.html
```

## Parallel Example: User Story 2

```text
T018 [US2] Align Clerk sign-in mount behavior in src/scripts/auth-sign-in.js
T019 [US2] Align Clerk sign-up mount behavior in src/scripts/auth-sign-up.js
```

## Parallel Example: User Story 3

```text
T025 [US3] Update drawer placement and direction sync in src/scripts/site-header.js
T026 [US3] Align signed-in account/auth affordance behavior in src/scripts/clerk-header.js
```

## Parallel Example: User Story 4

```text
T031 [US4] Stabilize trial widget behavior in src/public/scripts/chat-widget.js
T032 [US4] Mirror composer contract in src/public/scripts/grindctrl-support.js
```

## Parallel Example: User Story 6

```text
T036 [US6] Add dashboard runtime loading and inline error-state orchestration in src/scripts/app.js, src/app.css, and src/public/scripts/i18n.js
T037 [US6] Add widget runtime error handling and fallback states in src/public/scripts/chat-widget.js, src/public/scripts/grindctrl-support.js, src/chat-widget.css, and src/public/scripts/i18n.js
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1
2. Complete Phase 2
3. Complete Phase 3 (US1)
4. Validate US1 independently before expanding scope

### Incremental Delivery

1. Finish Setup and Foundational work
2. Deliver US1 and validate auth/public premium quality
3. Deliver US2 and lock Clerk visual parity
4. Deliver US3 and lock mobile header/drawer behavior
5. Deliver US4 and lock widget/mockup layout stability
6. Deliver US6 and remove runtime regressions without weakening security
7. Deliver US5 and finish dashboard shell polish
8. Run Phase 9 release checks

### Parallel Team Strategy

1. One engineer handles shared foundations in `src/tokens.css`, `src/layout.css`, `src/components.css`, and `src/public/icons/*`
2. One engineer handles auth work across `src/sign-in.html`, `src/sign-up.html`, `src/auth.css`, and `src/scripts/clerk-appearance.js`
3. One engineer handles shell/widget/runtime work across `src/index.html`, `src/public/scripts/chat-widget.js`, `src/public/scripts/grindctrl-support.js`, `src/lib/supabase.js`, and `src/scripts/app.js`

---

## Notes

- Keep the current repo architecture; do not convert classic scripts under `src/public/scripts/` into modules
- Do not mix the trial and production Supabase projects while completing `US6`
- Do not broaden RLS; only apply the targeted migration task if runtime evidence proves it is necessary
- Every story closes with responsive, EN/AR, and runtime-safe validation before moving forward
