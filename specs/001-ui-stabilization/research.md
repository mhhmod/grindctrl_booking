# Research: Refine Current UI Stabilization

## Decision 1: Treat the current implementation as a refinement baseline

**Decision**: Keep the current page architecture, CSS cascade, Clerk integration, widget split, and dashboard structure as the base. Refine shared foundations and selectively rewrite only unstable subareas.

**Rationale**: The spec explicitly rejects a restart. The repo already has coherent foundations in `tokens.css`, `components.css`, `auth.css`, `app.css`, `site-header.js`, and `clerk-appearance.js`. Replacing whole surfaces would add risk and erase working behavior.

**Alternatives considered**:
- Full redesign from scratch: rejected because it violates FR-001 and increases regression risk.
- Pure page-local patching: rejected because the spec requires consistent quality across multiple surfaces and shared regressions should be fixed at the system layer.

## Decision 2: Fix visual drift through shared foundations first

**Decision**: Prioritize corrections in shared tokens, shared components, responsive shell rules, and common icon treatment before page-specific overrides.

**Rationale**: The repo already uses a layered cascade: `fonts.css` -> `tokens.css` -> `base.css` -> `layout.css` -> `components.css` -> page/module CSS. Shared fixes are the smallest maintainable way to restore consistency across public, auth, dashboard, and widget surfaces.

**Alternatives considered**:
- Inline style overrides in each page: rejected because they increase drift and maintenance cost.
- Tailwind-only patching in markup: rejected because this project already has a design-system CSS layer that should remain the source of truth.

## Decision 3: Keep Clerk theming inside supported appearance APIs

**Decision**: Continue using `GRINDCTRL_APPEARANCE` in `src/scripts/clerk-appearance.js` plus minimal container-level CSS in `src/auth.css`.

**Rationale**: The current code already follows Clerk's supported `appearance.variables` and `appearance.elements` model. The remaining work is visual calibration and responsive composition, not an unsupported deep override strategy.

**Alternatives considered**:
- Heavy DOM-targeted Clerk CSS overrides: rejected because it is brittle and can break with vendor updates.
- Replacing Clerk-hosted UI with custom auth forms: rejected because it would expand scope and risk working auth behavior.

## Decision 4: Stabilize mobile header and drawer through explicit priority rules

**Decision**: Rework header spacing and responsive priority around the existing `site-header.js` drawer coordination instead of replacing the nav system.

**Rationale**: The logic for drawer placement, active nav state, and RTL placement already exists. The remaining issues are layout geometry, collision handling, and visible state treatment across widths.

**Alternatives considered**:
- New header component architecture: rejected because current JS is small and sufficient.
- Independent LTR and RTL implementations: rejected because the repo already uses logical properties and direction toggling.

## Decision 5: Align trial widget and production widget around a shared composer contract

**Decision**: Fix input-row containment, directionality, and quick-action wrapping by defining the same layout contract for `src/chat-widget.css` and the Shadow DOM styles inside `src/public/scripts/grindctrl-support.js`.

**Rationale**: The spec calls out divergence between the real widget and the mockup. Both expose the same user-facing composer pattern, so stability depends on matching containment rules, minimum sizes, direction handling, and action wrapping behavior.

**Alternatives considered**:
- Fix only the landing-page trial widget: rejected because the production widget would remain inconsistent.
- Full style sharing across light DOM and Shadow DOM: rejected because the production widget cannot rely on global CSS and needs a mirrored contract rather than direct stylesheet reuse.

## Decision 6: Dashboard work should improve shell quality, not overbuild product depth

**Decision**: Refine spacing, hierarchy, card rhythm, and responsive navigation in `src/app.html` and `src/app.css` while keeping the current screen model and content structure.

**Rationale**: The dashboard already has the right structural sections and data hooks. The spec asks for it to feel like the same product, not a brand-new application. The most valuable changes are shell polish, icon cleanup, and responsive stability.

**Alternatives considered**:
- New dashboard information architecture: rejected because the scope is stabilization.
- Leaving placeholders untouched: rejected because current placeholder feel is a stated problem.

## Decision 7: Replace fragile icon usage with a consistent lightweight strategy

**Decision**: Audit current Material Symbols usage and move unstable cases toward a small consistent SVG or tightly scoped icon abstraction only where symbol rendering is causing visual inconsistency.

**Rationale**: The repo already includes Material Symbols and Shoelace assets, but the spec explicitly calls out fragile icon behavior. A selective replacement is lower risk than a global icon-system rewrite.

**Alternatives considered**:
- Keep all icon usage as-is: rejected because icon fragility is an explicit problem.
- Replace every icon in the app immediately: rejected because it creates large diff volume with limited value.

## Decision 8: Runtime stabilization should focus on targeted Supabase client and RLS corrections

**Decision**: Keep the existing split between the dashboard Supabase client (`src/lib/supabase.js`), trial widget client creation in `src/public/scripts/chat-widget.js`, and existing manual SQL migrations in `supabase/`. Address duplicate-client warnings, `widget_sites` load failures, and policy recursion through minimal client initialization cleanup and existing RLS fix patterns.

**Rationale**: The codebase already contains explicit migrations for `workspace_members` recursion and dashboard bootstrap functions. The right next step is to verify the active client/runtime path and close any remaining gaps without weakening RLS or mixing project credentials.

**Alternatives considered**:
- Disable RLS temporarily: rejected because it violates FR-017.
- Consolidate the two Supabase projects: rejected because the repo intentionally separates trial and production contexts.

## Decision 9: Validation must combine build checks with manual responsive and RTL QA

**Decision**: Use `npm run build` as the minimum implementation gate, then validate with targeted manual checks derived from `VISUAL-QA.md` and the feature acceptance criteria across 390px, 480px, 768px, and desktop widths in English and Arabic.

**Rationale**: This repo is highly visual, includes classic scripts and Shadow DOM behavior, and does not yet expose exhaustive automated coverage for these scenarios. Manual QA is necessary for auth, drawer, widget, and RTL details.

**Alternatives considered**:
- Build-only verification: rejected because it cannot catch layout and directionality regressions.
- Large new automated test investment inside this feature: rejected because stabilization should first restore UI quality with minimal scope growth.
