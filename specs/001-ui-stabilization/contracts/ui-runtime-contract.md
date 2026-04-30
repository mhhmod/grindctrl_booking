# UI and Runtime Contract: Refine Current UI Stabilization

## Purpose

This feature does not introduce a new public HTTP API. The relevant contract is the expected behavior of the in-scope UI surfaces and their runtime integration points.

## Surface Contract

### Public and Auth Surfaces

- Shared tokens and shared component styles remain the first source of truth for spacing, color, radius, and typography.
- Sign-in and sign-up retain their existing routes and Clerk mount points.
- Clerk styling remains within official `appearance` configuration plus light shell-level CSS.
- English and Arabic continue to be supported through the current i18n mechanism.

### Navigation Contract

- Header continues to expose brand, nav links, utility controls, CTA/auth affordance, and hamburger trigger.
- Drawer continues to use Shoelace and mirrors placement using `dir`.
- Active page indication must remain visible in both top navigation and drawer navigation.

### Widget Contract

- Trial widget remains a classic public script with global/browser-based initialization.
- Production embed remains Shadow DOM-isolated and initialized through `GrindctrlSupport.init(...)`.
- Both widget variants must honor the active document language and reading direction for placeholders, text alignment, and action placement.
- Both widget variants must preserve contained composer geometry under narrow widths.

### Dashboard Contract

- `app.html` remains the protected dashboard entry route.
- Dashboard hydration continues to depend on Clerk auth plus Supabase RPC/data access.
- The current screen-switching model using `data-screen` and `data-nav` remains intact.

## Runtime Integration Contract

### Clerk

- Auth pages must mount Clerk into the existing page containers.
- Working sign-in/sign-up flows must remain intact.
- Appearance customization must not rely on unsupported internal DOM contracts.

### Supabase

- Dashboard client remains a singleton-style client created from environment variables in `src/lib/supabase.js`.
- Trial widget client remains isolated to the trial widget project.
- Production widget continues to call its own project endpoints and edge functions.
- Any RLS fix must preserve exposed-table security and avoid blanket permission broadening.

## Verification Contract

The feature is complete when all of the following are true:

- `npm run build` succeeds.
- In-scope responsive checks pass at phone, tablet, and desktop widths.
- English and Arabic direction-sensitive layouts remain stable.
- Auth, dashboard, and widget flows show no known high-severity readability, containment, or runtime regressions.
