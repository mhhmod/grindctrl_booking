# Validation Scope: Widget Setup Flow

**Feature**: Widget Setup Flow (001)  
**Date**: 2026-04-21  
**Purpose**: Document which breakpoints, EN/AR states, widget surfaces, auth flows, and runtime paths must be checked before each user story is closed.

---

## Breakpoints to Verify

All dashboard screens must be checked at:
- 390px (small phone)
- 480px (phone)
- 540px (large phone)
- 640px (sm/tablet)
- 768px (md)
- 1024px (lg)
- 1280px (xl)
- 1536px (2xl)

## EN/AR States to Verify

All dashboard screens must be checked in:
- English LTR (default)
- Arabic RTL (lang="ar", dir="rtl")

Check for: alignment, spacing, truncation, icon direction, logical CSS properties.

## Widget Surfaces to Verify

- Embeddable widget loads on localhost (development mode)
- Embeddable widget loads on verified domains
- Embeddable widget is blocked on unverified domains
- Widget respects `active_state` and `status`
- Widget renders branding (colors, logo, brand name)
- Widget renders intents as quick action buttons
- Widget handles lead capture in all 5 timing modes
- Widget submits leads to Supabase

## Auth Flows to Verify

- Sign-in → Dashboard loads
- Dashboard shows site selector when multiple sites exist
- Dashboard shows empty state when no sites exist
- Role-based access: admin sees Verify/Reject buttons on domains

## Runtime Paths to Verify

- `npm run build` succeeds with no errors
- No console errors on app boot
- Widget config loads from Supabase by embed key
- Copy-to-clipboard works for embed key and snippet
- Save operations show success/error toast
- Confirm dialogs work for destructive actions

---

## Per-Story Validation Checklist

### User Story 1: Create and Configure Widget Site
- [ ] Create site → appears in selector
- [ ] Embed key is real and copyable
- [ ] Snippet contains real embed key
- [ ] Config form saves and persists after refresh
- [ ] Empty state shown when no sites
- [ ] Build passes

### User Story 2: Manage Domains and Security
- [ ] Add domain → appears in list as Pending
- [ ] Admin can verify/reject domains
- [ ] Remove domain → disappears
- [ ] Regenerate key → new key appears, old key invalid
- [ ] Widget blocked on unverified domains
- [ ] Build passes

### User Story 3: Customize Branding and Intents
- [ ] Branding saves and widget shows new colors/logo
- [ ] Intent CRUD works (add, edit, delete)
- [ ] Widget renders intents with correct action types
- [ ] External link intents open new tab
- [ ] Build passes

### User Story 4: Capture and Review Leads
- [ ] Lead capture settings save
- [ ] Widget shows lead form in correct timing mode
- [ ] Lead form submits to Supabase
- [ ] Leads appear in dashboard Leads panel
- [ ] Session deduplication works
- [ ] Build passes

---

## Cross-Cutting Validation

- [ ] All new labels have EN + AR keys in i18n.js
- [ ] All screens responsive across breakpoints
- [ ] RTL mode works on all dashboard screens
- [ ] No console errors
- [ ] Build succeeds
- [ ] Widget Shadow DOM has no global CSS leakage
