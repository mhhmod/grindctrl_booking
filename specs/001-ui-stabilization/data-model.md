# Data Model: Refine Current UI Stabilization

## Overview

This feature is primarily a UI and runtime stabilization effort. Most entities already exist in the codebase and database. The plan below identifies the product entities whose shape or behavior constrains the implementation.

## Current Repo Baseline

| Field | Type | Notes |
|------|------|-------|
| surfaces | list | Public site, auth, dashboard, trial widget, production widget |
| styling_layers | list | Shared CSS cascade plus route/module overrides |
| script_types | enum-like | ES modules and classic scripts |
| locales | list | `en`, `ar` |
| themes | list | dark default, light supported |

**Validation rules**:
- Baseline behavior that is already working should be preserved.
- Refinement should prefer existing shared patterns before introducing new abstractions.

## Auth Surface

| Field | Type | Notes |
|------|------|-------|
| page | enum | `sign-in`, `sign-up` |
| shell_state | object | Intro branding, back link, auth card, footer link |
| clerk_mount_id | string | `clerk-sign-in-mount` or `clerk-sign-up-mount` |
| appearance_config | object | `GRINDCTRL_APPEARANCE` variables and elements |
| locale | enum | `en` or `ar` |
| viewport | enum | phone, tablet, desktop |

**Validation rules**:
- Brand lockup must remain readable and prominent.
- Clerk internals must fit the same dark shell visually.
- Auth shell must not clip or feel cramped on small screens.

## Navigation Surface

| Field | Type | Notes |
|------|------|-------|
| header_state | enum | default, constrained, drawer-open |
| direction | enum | `ltr`, `rtl` |
| active_page | enum | home, solutions, book, install, packages |
| drawer_placement | enum | `start`, `end` |
| controls | list | brand, language toggle, theme toggle, CTA/auth, hamburger |

**Validation rules**:
- No overlap at supported phone widths.
- Responsive priority must be explicit when width is constrained.
- Drawer alignment and active-state treatment must mirror correctly in RTL.

## Widget Surface

| Field | Type | Notes |
|------|------|-------|
| variant | enum | `trial-playground`, `production-embed` |
| direction | enum | `ltr`, `rtl` |
| phase | enum | closed, open, loading, error, active |
| composer_state | object | input field, placeholder, send button, utility actions |
| prompt_actions | list | suggested prompts / quick actions |
| locale | enum | `en`, `ar` |

**Validation rules**:
- Composer row remains fully contained.
- Send button never protrudes or clips.
- Quick actions wrap consistently and stay usable.

## Dashboard Shell

| Field | Type | Notes |
|------|------|-------|
| topbar | object | brand, links, user affordance |
| sidebar | object | navigation groups and active state |
| active_screen | enum | dashboard, setup, branding, intents, domains, usage, integrations, settings |
| shell_cards | list | trial banner, stats, setup, snippet, empty states |
| workspace_bundle | object | workspace and sites from Supabase RPC |

**Validation rules**:
- Shell rhythm must match public/auth surfaces.
- Mobile and desktop layout must remain legible and intentional.
- Placeholder content should feel product-grade, not throwaway.

## Icon System

| Field | Type | Notes |
|------|------|-------|
| source | enum | Material Symbols, Shoelace assets, lightweight SVG replacements |
| context | list | header, drawer, dashboard, widget, CTA/buttons |
| direction_sensitive | boolean | Some arrows and directional icons must mirror in RTL |

**Validation rules**:
- In-scope icons must render consistently.
- Direction-sensitive icons must respect language direction.

## Runtime Stability State

| Field | Type | Notes |
|------|------|-------|
| dashboard_supabase_client | object | singleton client from `src/lib/supabase.js` |
| widget_trial_client | object | browser-created client in `chat-widget.js` |
| workspace_access_path | object | Clerk -> RPC bootstrap -> workspace/site reads |
| rls_status | object | Existing tables and targeted policy fixes |
| runtime_warnings | list | duplicate client warnings, recursion, `widget_sites` load errors |

**Validation rules**:
- No duplicate-client warnings on normal page load.
- No recursive policy failures on workspace-related access.
- `widget_sites` and related dashboard data paths must load without weakening RLS.

## State Transitions

### Auth Surface

`loading -> mounted -> interactive -> success/error`

### Navigation Surface

`default -> constrained -> drawer-open -> drawer-closed`

### Widget Surface

`closed -> open -> active -> sending/loading -> success/error`

### Dashboard Shell

`unauthenticated/setup-required -> authenticated-loading -> hydrated -> partial-empty/error`
