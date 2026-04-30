# Implementation Plan: Widget Setup Flow

**Branch**: `feat/widget-setup-flow` | **Date**: 2026-04-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-widget-setup-flow/spec.md`

## Summary

Transform the static GRINDCTRL dashboard (`app.html` + `app.js`) into a real, data-backed Widget Setup flow. The dashboard currently has placeholder screens for Widget Setup, Domains, Branding, and Intents. This plan makes them fully functional by:

1. Extending the Supabase schema with JSONB config columns and new tables for intents/leads
2. Building CRUD operations in the dashboard for widget sites, domains, branding, intents, and lead capture
3. Ensuring the embeddable widget (`grindctrl-support.js`) can read real configuration by embed key
4. Preserving premium dark UI, mobile-first responsiveness, EN/AR parity, and runtime safety

## Technical Context

**Language/Version**: Vanilla ES2022 (browser), Vite 5.x build toolchain
**Primary Dependencies**: Clerk (auth), Supabase JS v2 (data), Shoelace/Web Awesome (UI components), Tailwind CSS (CDN + config)
**Storage**: Supabase PostgreSQL with RLS; `widget_sites` extended with JSONB columns
**Testing**: Manual smoke tests across breakpoints; no automated test suite currently in repo
**Target Platform**: Static site deployed to GitHub Pages; dashboard is a protected HTML page
**Project Type**: Web application (static frontend + serverless backend via Supabase)
**Performance Goals**: Dashboard screen transitions <200ms; widget config load <500ms on first paint
**Constraints**: RLS must remain enabled; Clerk-only auth for dashboard; widget must stay public; no framework migration
**Scale/Scope**: Small-to-medium business users; no hard limits in MVP

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Premium dark UI quality preserved across all affected surfaces
  - All new UI uses existing `app.css` tokens and patterns (`--gc-*` variables, `.gc-app-*` classes)
  - No new color palettes or typography scales introduced
- [x] Mobile-first responsive behavior covered for small phone, phone, tablet, and desktop
  - Existing `@media (max-width: 768px)` and `@media (max-width: 480px)` breakpoints in `app.css` handle layout
  - New forms stack vertically; site selector becomes full-width on mobile
- [x] EN/AR copy, RTL/LTR layout, and directional behavior accounted for where applicable
  - All new labels use `data-i18n` attributes; Arabic keys added to `i18n.js`
  - Logical CSS properties (`margin-inline`, `padding-inline`) used throughout
- [x] Readability and contrast verified for primary, secondary, disabled, and error states
  - Uses existing badge variants (`.gc-app-badge--success/warning/danger/info`)
  - Form focus states use existing `--gc-primary` glow pattern
- [x] Widget layout integrity reviewed for constrained/embed contexts if widget code or styles are affected
  - The embeddable widget (`grindctrl-support.js`) only reads public config by embed key
  - No global CSS changes that could leak into Shadow DOM
- [x] Auth, landing, and dashboard visual consistency reviewed if shared UI or auth/app surfaces are affected
  - Dashboard changes are scoped to `app.html` and `app.css`
  - Auth pages (`sign-in.html`, `sign-up.html`) untouched
- [x] Runtime regression checks defined, including build, relevant automated tests, and manual smoke validation
  - Build verification via `npm run build`
  - Manual smoke: sign-in → dashboard → create site → copy snippet → verify widget loads

## Project Structure

### Documentation (this feature)

```text
specs/001-widget-setup-flow/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── widget-config-api.md
│   └── dashboard-data-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app.html                    # Dashboard shell (existing, expanded)
├── app.css                     # Dashboard styles (existing, expanded)
├── scripts/
│   ├── app.js                  # Dashboard logic (existing, major expansion)
│   ├── clerk.js                # Clerk auth (existing, unchanged)
│   ├── web-awesome.js          # Shoelace registry (existing, may add components)
│   └── grindctrl-support.js    # Embeddable widget (existing, add config fetch)
├── lib/
│   ├── clerk-supabase-sync.js  # Data layer (existing, expand with new methods)
│   └── supabase.js             # Supabase client (existing, unchanged)
├── scripts/i18n.js             # EN/AR dictionary (existing, add keys)
└── public/
    └── scripts/                # Static scripts copied to dist

supabase/
├── clerk_profiles_workspaces_widget_sites.sql  # Existing schema
└── widget_setup_extensions.sql                  # New migration (this feature)
```

**Structure Decision**: Single static frontend project. All dashboard logic lives in `src/scripts/app.js` with helper methods in `src/lib/clerk-supabase-sync.js`. Schema changes are manual delta SQL files in `supabase/`. The embeddable widget remains a standalone script in `src/scripts/grindctrl-support.js`.

## Complexity Tracking

No constitution violations. All changes reuse existing patterns and infrastructure.

---

## Phase 0: Research

All clarifications were resolved during `/speckit.clarify`:

1. **Domain verification**: Manual admin approval in dashboard (no automated DNS polling in MVP)
2. **Configuration storage**: JSONB columns on `widget_sites` (`config_json`, `branding_json`, `lead_capture_json`)
3. **Workspace limits**: No hard limits in MVP; pagination deferred
4. **Lead capture timing**: 5 configurable modes (before required, before skippable, during, disabled, after)
5. **Lead deduplication**: Remember per browser session via sessionStorage

See [research.md](research.md) for consolidated findings.

---

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](data-model.md) for full entity definitions, field types, relationships, and validation rules.

### Interface Contracts

See [contracts/](contracts/) for:
- `widget-config-api.md` — How the embeddable widget fetches configuration by embed key
- `dashboard-data-api.md` — Dashboard ↔ Supabase data operations

### Quick Start

See [quickstart.md](quickstart.md) for developer onboarding to run and test the feature.
