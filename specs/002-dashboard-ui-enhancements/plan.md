# Plan: Dashboard UI Enhancements (shadcn/ui)

**Feature Branch**: `002-dashboard-ui-enhancements`
**Created**: 2026-04-23
**Preset**: shadcn `radix-maia` (RTL enabled)
**App**: `apps/web-next` (Next.js App Router)

## Phase 0: Baseline + Guardrails

### Goals

- Ensure shadcn is initialized and core primitives exist.
- Lock in icon strategy and RTL behavior expectations.

### Tasks

1. Confirm `apps/web-next/components.json` is present and points `tailwind.css` to `app/globals.css`.
2. Confirm `cn()` helper exists at `apps/web-next/lib/utils.ts`.
3. Confirm required shadcn components exist under `apps/web-next/components/ui/`.
4. Decide icon library strategy:
   - Current dashboard uses `lucide-react` directly.
   - shadcn config currently says `iconLibrary: hugeicons`.
   - Choose: (a) keep lucide for now and update `components.json` to `lucide`, or (b) migrate dashboard icons to hugeicons.
5. Confirm RTL activation mechanism for dashboard (Next app): define how Arabic is selected and how `dir="rtl"` is applied.

## Phase 1: Dashboard Shell Migration

### Goals

- Replace bespoke dashboard shell markup with shadcn composition.
- Mobile nav becomes a Sheet; desktop uses Sidebar.
- Preserve routing + active state logic.

### Tasks

1. Update `DashboardShell` to use `Sidebar` + `Sheet` primitives.
2. Add `Separator` and consistent header layout.
3. Ensure keyboard navigation and focus visibility.
4. Ensure desktop layout uses stable min/max widths and content frame.
5. Validate `/dashboard/*` pages render correctly.

## Phase 2: Overview Page Content Upgrade

### Goals

- Convert overview to consistent Card/Badge/Table composition.
- Implement honest progress/readiness presentation.
- Implement robust empty/loading/error states.

### Tasks

1. Convert metric tiles to `Card` composition.
2. Replace “Install readiness” section with a consistent status model:
   - Workspace connected?
   - Site selected?
   - Embed key present?
   - Domains configured?
   - Intents configured?
   - Leads capture configured?
3. Replace ad hoc placeholder blocks with `Alert`, `Skeleton`, and consistent Empty presentation.
4. Ensure mixed-direction strings (domains, emails, keys) render readably in RTL (direction isolation).

## Phase 3: Tables & Lists Standardization

### Goals

- Domains/Intents/Leads share consistent table/list patterns.
- Clear row actions and empty/error states.

### Tasks

1. Use `Table` for leads list (desktop) with responsive stacking (mobile).
2. Use shared patterns for domains/intents manager lists.
3. Add consistent truncation and optional “copy” affordances.
4. Ensure pagination or “recent items” patterns are explicit (no accidental huge lists on mobile).

## Phase 4: Forms & Inputs Standardization

### Goals

- Branding, domains, intents, leads settings use consistent form patterns.
- Validation and pending feedback are predictable.

### Tasks

1. Replace bespoke field layout with shadcn form primitives (where applicable in this repo).
2. Ensure `aria-invalid` and error text conventions.
3. Standardize submit rows and disabled/pending states.
4. Ensure success feedback uses `sonner` toast where appropriate (and inline state where required).

## Phase 5: EN/AR + RTL + Responsive QA

### Goals

- Dashboard is stable across the defined breakpoints in both languages.

### Tasks

1. Verify 390/480/640/768/1024+ widths for:
   - shell layout
   - nav/drawer
   - tables/lists
   - forms
2. Verify RTL:
   - icon+label spacing
   - direction isolation for LTR tokens
   - truncation and wrapping
3. Run tests and fix regressions.

## Verification

- `npm test` in `apps/web-next`.
- `npm run build` in `apps/web-next` (Next build).
- Manual pass:
  - `/dashboard/overview`
  - `/dashboard/install`
  - `/dashboard/branding`
  - `/dashboard/intents`
  - `/dashboard/domains`
  - `/dashboard/leads`
