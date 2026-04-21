# Feature Specification: Refine Existing GRINDCTRL Surfaces

**Feature Branch**: `001-ui-stabilization`  
**Created**: 2026-04-21  
**Status**: Draft  
**Input**: User description: "/speckit.specify Refine the current GRINDCTRL repo state rather than starting from scratch. This is a correction/refinement feature for the existing implementation. We already have auth, Clerk, dashboard, widget, and Supabase-related work in the repo. The goal is to refine the current implementation so it reaches production-ready GRINDCTRL quality. Focus on: auth page composition and contrast, Clerk appearance aligned with GRINDCTRL dark theme, mobile header/nav/drawer correctness, widget and mockup input/send-row layout stability, dashboard shell polish and consistency, icon consistency and robustness, Supabase/runtime stability and no recursive policy/runtime regressions, EN + AR consistency, desktop + mobile quality. Do not treat this as a greenfield feature. Treat the current repo as the baseline and refine it."

## Context

We are refining the current GRINDCTRL repository state, not starting from scratch.

Major auth, Clerk, dashboard, widget, and Supabase-related changes already exist in the repository. This specification covers correction and refinement of that implementation rather than replacement.

The current repository is the baseline. Keep what is strong, revise what is weak, and rewrite only what is broken or too fragile to stabilize cleanly.

## Objective

Bring the GRINDCTRL frontend back to a premium, coherent, production-ready level across:

- Public site
- Sign-in and sign-up
- Protected dashboard
- Widget and demo/mockup
- Desktop and mobile
- English and Arabic

## Clarifications

### Session 2026-04-21

- Q: For the brownfield runtime and Supabase work, should scope allow targeted policy or RLS fixes if needed to resolve known regressions? → A: Frontend/runtime fixes first, plus minimal targeted policy or RLS changes only if required to resolve known regressions.
- Q: How broad should dashboard refinement be in this brownfield pass? → A: Dashboard shell plus first-view content states and cards if needed to remove visible mismatch.
- Q: How broad should public-site refinement be in this brownfield pass? → A: Refine shared public shell elements tied to this work: header, nav, drawer, auth entry points, and nearby composition only.
- Q: When runtime data fails on dashboard or widget-backed surfaces, how should the UI degrade? → A: Keep the shell or frame visible and show an inline error state for the affected content area.
- Q: How far can icon cleanup go in this brownfield pass? → A: Allow targeted replacement with a shared lightweight SVG approach where current icon behavior is fragile or inconsistent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use public and auth surfaces that feel premium and readable (Priority: P1)

As a visitor or returning user, I can use the landing page, sign-in page, and sign-up page on mobile and desktop without low-contrast text, weak branding, awkward spacing, or unstable composition.

**Why this priority**: The public and auth surfaces define first impression, trust, and conversion. If these surfaces feel broken or off-brand, the product loses credibility before users reach the dashboard.

**Independent Test**: Open the public site, sign-in page, and sign-up page on representative mobile and desktop widths and confirm that branding, readability, spacing, and overall polish feel consistent with a premium GRINDCTRL product shell.

**Acceptance Scenarios**:

1. **Given** a user opens the sign-in or sign-up page, **When** the page finishes loading, **Then** text remains readable, the brand lockup feels appropriately prominent, and the layout feels intentionally composed rather than cramped or visually weak.
2. **Given** a user opens the same surfaces on mobile and desktop, **When** content adapts to the viewport, **Then** spacing, hierarchy, and composition remain stable without overlap, clipping, or low-contrast regressions.

---

### User Story 2 - Experience Clerk-auth UI as part of the GRINDCTRL product (Priority: P1)

As a user authenticating with Clerk, I experience fields, buttons, surfaces, borders, radii, dividers, and helper text that feel native to the GRINDCTRL dark interface rather than visually disconnected third-party defaults.

**Why this priority**: Authentication is a critical trust surface. If Clerk internals do not match the rest of the product, the experience feels stitched together and less credible.

**Independent Test**: Load the Clerk-driven sign-in and sign-up flows and confirm the supported appearance configuration produces a dark theme aligned with the GRINDCTRL visual system across key auth states.

**Acceptance Scenarios**:

1. **Given** a user loads a Clerk auth page, **When** Clerk components render, **Then** the resulting controls, text, and surfaces match the surrounding GRINDCTRL shell in color, contrast, spacing, and shape language.
2. **Given** a user moves through the auth flow, **When** they view inputs, buttons, separators, and support text, **Then** those elements feel visually consistent with the product and remain readable in dark mode.

---

### User Story 3 - Use the mobile header and drawer cleanly in English and Arabic (Priority: P1)

As a mobile user in either English or Arabic, I can use the header, navigation controls, account or CTA affordances, and drawer without collisions, ambiguous priority, broken geometry, or directional inconsistencies.

**Why this priority**: Header and drawer issues block navigation and are highly visible regressions, especially on constrained mobile widths and in RTL contexts.

**Independent Test**: Open the site on common phone widths in English and Arabic, inspect the header before and after opening the drawer, and confirm there is no overlap, visual artifacting, or direction-related instability.

**Acceptance Scenarios**:

1. **Given** a mobile user views the site header, **When** branding, controls, CTA or auth affordances, and the menu trigger render together, **Then** they remain visually prioritized and separated without overlap or collision.
2. **Given** a mobile user opens the drawer in English or Arabic, **When** the drawer is fully visible, **Then** its spacing, panel geometry, alignment, and directional behavior remain clean and stable.

---

### User Story 4 - Use the widget and mockup without input-row breakage (Priority: P1)

As a user interacting with the real widget or demo/mockup, I can use the message input row in English and Arabic without protruding send buttons, clipping, broken alignment, or unstable quick-action wrapping.

**Why this priority**: The widget is a core product surface. Input-row instability makes the product feel unfinished and directly harms perceived quality.

**Independent Test**: Open the real widget and the demo/mockup on mobile and desktop, switch between English and Arabic, and confirm the input row remains fully contained and visually stable in every case.

**Acceptance Scenarios**:

1. **Given** the widget or mockup is open, **When** the input row renders with placeholder text and send controls, **Then** the row stays fully contained and no control protrudes, clips, or overflows.
2. **Given** the active language changes between English and Arabic, **When** placeholder text and input alignment update, **Then** text direction, alignment, and send-control placement remain correct and usable.
3. **Given** quick actions are present, **When** available width changes, **Then** wrapping remains consistent and does not create broken spacing or unstable layout between the real widget and the mockup.

---

### User Story 5 - Use a dashboard that feels like the same product (Priority: P2)

As an authenticated user, I can use the protected dashboard on desktop and mobile and experience spacing, rhythm, hierarchy, and responsiveness that feel consistent with the landing and auth surfaces rather than like a placeholder or disconnected shell.

**Why this priority**: Once users authenticate, the product must continue the same visual quality and trust level rather than dropping into a less polished environment.

**Independent Test**: Sign in, load the protected dashboard, and review the primary dashboard shell on mobile and desktop for consistency, hierarchy, spacing rhythm, and responsive clarity.

**Acceptance Scenarios**:

1. **Given** an authenticated user opens the dashboard, **When** the main shell and first-view content regions or states render, **Then** the dashboard feels visually consistent with the public and auth experience.
2. **Given** the dashboard is viewed on mobile and desktop, **When** layout adapts to the viewport, **Then** spacing, hierarchy, and responsiveness remain polished without overbuilt placeholder behavior.

---

### User Story 6 - Load the dashboard and widget surfaces without prior Supabase/runtime instability (Priority: P1)

As a user loading protected or widget-driven surfaces, I can use the product without duplicate-client warnings, policy recursion issues, widget site loading failures, or security regressions caused by overly broad permission changes.

**Why this priority**: Stability issues directly degrade the product experience and can undermine confidence in both reliability and security.

**Independent Test**: Load the dashboard and relevant widget-backed surfaces in a representative environment and confirm previously observed Supabase or runtime failures no longer appear while security posture remains intact.

**Acceptance Scenarios**:

1. **Given** a user loads the dashboard or widget-backed surfaces, **When** runtime initialization completes, **Then** the experience proceeds without duplicate-client warnings or known widget site loading failures.
2. **Given** the data layer is accessed during normal product use, **When** authorization rules are evaluated, **Then** the system avoids known policy recursion failures without broadly disabling row-level security.

## Problems To Fix

1. Auth pages
- Contrast and readability regressions
- Weak or undersized brand lockup
- Awkward spacing and composition
- Clerk internals not fully aligned with GRINDCTRL theme
- Desktop and mobile polish still insufficient

2. Clerk appearance
- Use official supported appearance configuration
- Dark mode must fit GRINDCTRL
- Fields, buttons, dividers, text, surfaces, borders, radii, and spacing must feel native

3. Mobile header, nav, and drawer
- Overlap and collision problems
- Weak responsive priority between brand, controls, CTA or auth affordance, and menu trigger
- Drawer geometry, spacing, and artifacts must be fixed
- LTR and RTL must both work

4. Widget and mockup layout
- Input row containment bugs
- Send button protrusion or overflow
- English and Arabic placeholder and input alignment issues
- Quick-action wrapping inconsistencies
- Real widget and mockup should share stable layout logic

5. Dashboard shell
- Still needs polish and consistency with landing and auth
- Spacing, rhythm, hierarchy, and responsive behavior need refinement
- Reduce placeholder or mock feel without overbuilding

6. Icon strategy
- Icons still need a more robust, consistent system
- Remove fragile or inconsistent icon behavior
- If needed, move to a lightweight SVG icon approach

7. Supabase and runtime stability
- No duplicate-client warnings
- No policy recursion
- No widget_sites load failures
- Preserve security
- Do not broadly disable RLS

## Edge Cases

- Very small phone widths must keep auth composition, header controls, drawer actions, and widget send rows fully usable without overlap or horizontal scrolling.
- Arabic RTL mode must preserve layout direction, icon direction where relevant, text alignment, and drawer or header action placement without introducing mirrored spacing bugs.
- Clerk-driven auth states such as validation, error, loading, and alternate auth steps must remain readable and visually aligned with the surrounding dark shell.
- Widget and mockup composer rows must remain stable when placeholder text is long, when quick actions wrap to multiple lines, and when the host container is narrower than a typical phone viewport.
- Dashboard entry must fail safely if runtime data is temporarily unavailable, avoiding broken shell layout, recursive policy failures, or misleading empty states.
- If runtime data fails on dashboard or widget-backed surfaces, the shell or frame must remain visible while the affected content area shows an explicit inline error state.
- Runtime and data-access corrections must not solve loading failures by weakening security boundaries or broadly disabling row-level protections.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST treat the current repository state as the baseline for this effort and MUST focus on refinement, correction, and selective rewrite rather than broad replacement of working surfaces.
- **FR-002**: The system MUST preserve GRINDCTRL visual identity while improving premium dark-mode presentation, readability, contrast, composition, and responsiveness.
- **FR-003**: The system MUST keep sign-in and sign-up surfaces visually polished, readable, responsive, and clearly on-brand across supported mobile and desktop breakpoints.
- **FR-004**: The system MUST ensure the brand lockup and auth-page composition feel intentional and appropriately prominent rather than visually weak or cramped.
- **FR-005**: The system MUST style Clerk-driven auth experiences using officially supported appearance configuration.
- **FR-006**: The system MUST ensure Clerk fields, buttons, dividers, text, surfaces, borders, radii, and spacing feel native to the GRINDCTRL dark product shell.
- **FR-007**: The system MUST keep the mobile header free from overlap and collision at common supported device widths.
- **FR-008**: The system MUST establish clear responsive priority between brand, controls, CTA or auth affordances, and menu trigger in constrained mobile layouts.
- **FR-009**: The system MUST keep the mobile drawer visually clean and stable in both left-to-right and right-to-left presentation.
- **FR-010**: The system MUST keep widget and mockup input rows fully contained so send controls never clip, protrude, or overflow in English or Arabic.
- **FR-011**: The system MUST align widget and mockup placeholder text, input text, and action placement with the active reading direction.
- **FR-012**: The system MUST ensure quick actions wrap consistently across the real widget and the demo or mockup surfaces.
- **FR-013**: The system MUST refine the protected dashboard shell so it feels like the same product as the landing and auth surfaces.
- **FR-014**: The system MUST improve dashboard spacing, rhythm, hierarchy, and responsive behavior without introducing unnecessary complexity or overbuilt placeholder UI.
- **FR-015**: The system MUST use a consistent, robust icon strategy across in-scope surfaces and MUST remove fragile or inconsistent icon behavior.
- **FR-016**: The system MUST eliminate previously observed duplicate-client warnings, policy recursion issues, and widget site loading failures in the in-scope runtime paths.
- **FR-017**: The system MUST preserve security posture while addressing runtime and data-access issues and MUST NOT broadly disable row-level security.
- **FR-018**: The system MUST support both English and Arabic across all in-scope surfaces, including responsive behavior and direction-sensitive layout.
- **FR-019**: The system MUST avoid introducing new low-contrast regressions or broken mobile layout regressions while applying these refinements.
- **FR-020**: The system MUST result in a maintainable implementation that keeps working auth flows intact.
- **FR-021**: The system MUST limit Supabase-side changes to minimal targeted policy or row-level security corrections required to resolve known runtime regressions and MUST NOT expand this effort into broad schema or policy refactoring.
- **FR-022**: The system MUST keep dashboard refinement focused on the authenticated shell and first-view content states or cards required to remove visible mismatch, and MUST NOT expand this pass into a broad redesign of most authenticated screens.
- **FR-023**: The system MUST limit public-site refinement to shared shell elements tied to this work, including header, navigation, drawer, auth entry points, and nearby composition, and MUST NOT expand this pass into a broad landing-page redesign.
- **FR-024**: The system MUST preserve the dashboard shell or widget frame during transient runtime failures and MUST show an explicit inline error state for the affected content area instead of collapsing the full screen into a blank, misleading, or placeholder state.
- **FR-025**: The system MAY replace fragile or inconsistent in-scope icons with a shared lightweight SVG approach where needed for robustness and consistency, but MUST NOT expand this pass into a repo-wide icon-system migration.

### Key Entities *(include if feature involves data)*

- **Current Repo Baseline**: The already-implemented product state that this effort evaluates for keep, revise, or rewrite decisions.
- **Auth Surface**: The sign-in and sign-up experience, including GRINDCTRL shell and Clerk-rendered internals.
- **Navigation Surface**: The mobile header, navigation priorities, and drawer behavior in English and Arabic.
- **Widget Surface**: The production widget message-composer and related interface states.
- **Mockup Surface**: The demo or mock widget UI used to represent the product experience.
- **Dashboard Shell**: The protected application structure and its primary layout, spacing, and hierarchy.
- **Icon System**: The shared icon approach used across in-scope UI surfaces.
- **Runtime Stability State**: The observable condition in which known Supabase and client-side failures no longer occur during normal use.

## Deliverables

- Keep, revise, and rewrite decisions for the current implementation
- Implementation phases
- Acceptance checks
- Risks
- Manual steps only if unavoidable

## Acceptance Criteria

- Sign-in and sign-up are visually polished, readable, responsive, and on-brand
- Clerk appearance matches the GRINDCTRL dark product shell
- Mobile header has no overlap at common device widths
- Drawer is visually clean and stable in left-to-right and right-to-left modes
- Widget input row never clips or protrudes in English or Arabic
- Dashboard feels like the same product as landing and auth
- Icons are consistent and robust
- Dashboard loads without previous Supabase or runtime errors
- Transient runtime failures preserve shell or frame with an inline error state
- No low-contrast regressions
- No broken mobile layout regressions
- No EN/AR parity regressions across the refined in-scope surfaces

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In review across in-scope public, auth, dashboard, widget, and mockup surfaces, all critical paths show no unresolved high-severity visual regressions affecting readability, containment, or responsive stability.
- **SC-002**: Sign-in and sign-up validation on supported mobile and desktop breakpoints confirms readable contrast, stable composition, and clearly on-brand presentation in 100% of reviewed states.
- **SC-003**: Mobile header and drawer validation on representative phone widths confirms no overlap or collision in 100% of reviewed English and Arabic states.
- **SC-004**: Widget and mockup validation confirms the input row and send control remain fully contained in 100% of reviewed English and Arabic states.
- **SC-005**: Dashboard review confirms spacing, hierarchy, and shell consistency align with the landing and auth experience across reviewed mobile and desktop states.
- **SC-006**: Runtime validation confirms previously observed duplicate-client warnings, policy recursion issues, and widget site loading failures are absent from normal in-scope usage paths.
- **SC-007**: In reviewed transient runtime-failure scenarios, the affected dashboard or widget-backed surface preserves its shell or frame and presents an explicit inline error state in 100% of tested cases.
- **SC-008**: Stakeholder review concludes the refined UI is premium, coherent, and production-ready without requiring a full redesign from zero.

## Risks And Considerations

- Existing changes may include both strong and weak implementation choices, so refinement must avoid regressing working behavior while correcting problem areas.
- Third-party auth rendering constraints may limit how far visual integration can go without leaving supported configuration paths.
- Shared widget and mockup behavior may have diverged, increasing the risk of partial fixes unless layout logic is stabilized consistently.
- Runtime and Supabase issues may span both client initialization and data-policy design, requiring careful fixes that preserve security.
- Responsive and RTL corrections may expose latent spacing or icon-direction issues in adjacent surfaces.

## Assumptions

- The current repo contains the intended product surfaces and is the correct baseline for this refinement effort.
- Working authentication behavior should remain intact while visual and structural quality is improved.
- English and Arabic remain the supported languages for all in-scope surfaces.
- The scope is refinement of existing public, auth, dashboard, widget, and mockup surfaces rather than creation of a new product architecture.
- Manual steps should be minimized and only used where unavoidable.
- Existing auth, dashboard, widget, and Supabase integrations are functionally close enough to production intent that targeted refinement is the correct delivery approach.
