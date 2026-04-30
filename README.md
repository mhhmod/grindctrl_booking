# GRINDCTRL Booking / Widget Site

Vite-built static site. Production domain: `https://grindctrl.cloud`.

## Development

```bash
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview production build locally
```

## Clerk Authentication

This repo includes Clerk authentication for the protected dashboard (`/app.html`). The landing page and embeddable widget remain fully public.

### Auth Routes

| Route | Description |
|-------|-------------|
| `/` | Public landing page (no auth required) |
| `/sign-in.html` | Sign-in page (Clerk mounted UI) |
| `/sign-up.html` | Sign-up page (Clerk mounted UI) |
| `/app.html` | Protected dashboard (redirects to sign-in if not authenticated) |

### Local Dev

1. Copy `.env.example` to `.env` and fill in your keys
2. Run `npm run dev`
3. Visit `http://localhost:5173` for the landing page
4. Visit `http://localhost:5173/sign-in.html` for sign-in
5. Visit `http://localhost:5173/app.html` — will redirect to sign-in if not authenticated

### Graceful Degradation

If env vars are missing:
- The public landing page works normally
- Auth pages show a "not configured" message with a link back home
- No crashes or console errors on public pages

### Production Deployment

Set environment variables at build time. Vite reads them from `.env` or CI/CD secrets.

## Supabase Data Layer

Clerk is the **only** identity provider. Supabase provides database, storage, and edge functions. Supabase Auth is **not** used for app users.

### Schema (Clerk-bridged tables)

| Table | Purpose |
|-------|---------|
| `profiles` | Mirrors Clerk user data, keyed by `clerk_user_id` |
| `workspaces` | One default workspace per user (auto-created on first sign-in) |
| `workspace_members` | Many-to-many with roles (`owner`, `admin`, `member`) |
| `widget_sites` | Per-workspace widget configurations with unique `embed_key` |
| `widget_domains` | Per-site domain verification tracking |

All tables have RLS enabled with policies scoped to the authenticated Clerk user via application-level filtering.

### Sync Flow

On every signed-in dashboard load (`/app.html`):
1. Read Clerk user
2. Upsert `profiles` by `clerk_user_id` (idempotent)
3. Create default workspace if none exists (auto-creates `workspace_members` entry as `owner`)
4. Fetch widget sites for the workspace
5. Attach state to `window.__gcApp` for use by dashboard UI

### Required Environment Variables

```
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Supabase (production project)
VITE_SUPABASE_URL=https://egvdxshlbcqndrcnzcdn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Only the **anon/public** Supabase key is used in browser code. No service role key is exposed.

### What Was Configured Automatically

- 5 new tables created via MCP: `profiles`, `workspaces`, `workspace_members`, `widget_sites`, `widget_domains`
- RLS enabled on all 5 tables with workspace-scoped policies
- `updated_at` triggers on `profiles`, `workspaces`, `widget_sites`
- Auto-membership trigger: creating a workspace automatically inserts an `owner` row in `workspace_members`
- Migration SQL saved to `supabase/clerk_profiles_workspaces_widget_sites.sql`
- Client-side sync layer in `src/lib/clerk-supabase-sync.js`
- Supabase JS client in `src/lib/supabase.js`

### Remaining Manual Steps

None required for basic operation. The schema, RLS, sync flow, and app wiring are all complete.

**Optional future improvements:**
- For strict RLS enforcement via Supabase JWT: implement a server-side edge function that exchanges Clerk session tokens for short-lived Supabase JWTs with a custom `app.clerk_user_id` claim. This is only needed if you want Supabase to enforce row-level security at the database level for browser requests. Currently, filtering is done at the application layer (WHERE clauses), which is sufficient for the current threat model.

## Playwright Tests

### Running locally

```bash
npm run build                        # must build first (tests run against vite preview)
npm test                             # run all tests
npm run test:ui                      # open Playwright UI mode (interactive)
npm run test:update-snapshots        # regenerate screenshot baselines
```

### CI behavior

The GitHub Actions workflow (`.github/workflows/static.yml`) runs on every push to `main` and every PR targeting `main`:

1. **test** job — installs deps, builds, installs Chromium, runs `npx playwright test`
2. **deploy** job — only runs if `test` passes AND the push is on `main` (not a PR)

If tests fail, the `test` job uploads a `playwright-report` artifact (retained 7 days) and the `deploy` job is skipped entirely.

### Updating snapshots

If you intentionally change UI layout, colors, or typography:

1. Run `npm run test:update-snapshots` locally
2. Review the changed files in `e2e/__screenshots__/`
3. Commit the updated baselines
4. Push — CI will use the new baselines

## Architecture

| Path | Role |
|------|------|
| `src/index.html` | Landing page (public) |
| `src/sign-in.html` | Sign-in page (Clerk auth) |
| `src/sign-up.html` | Sign-up page (Clerk auth) |
| `src/app.html` | Protected dashboard (auth required) |
| `src/tokens.css` | Design tokens |
| `src/base.css` | Resets, typography |
| `src/layout.css` | Shell, container, grid |
| `src/components.css` | UI components, nav, Shoelace overrides |
| `src/auth.css` | Auth page shared styles |
| `src/app.css` | Dashboard styles |
| `src/overrides.css` | Page-level overrides |
| `src/lib/supabase.js` | Supabase client (anon key only) |
| `src/lib/clerk-supabase-sync.js` | Clerk → Supabase sync flow |
| `src/scripts/clerk.js` | Shared Clerk init + auth guard |
| `src/scripts/clerk-header.js` | Public nav auth integration |
| `src/scripts/app.js` | Dashboard entry point + sync |
| `src/scripts/auth-sign-in.js` | Sign-in page entry |
| `src/scripts/auth-sign-up.js` | Sign-up page entry |
| `src/public/scripts/` | Classic scripts (i18n, widgets) |
| `supabase/` | Versioned migration SQL files |
| `e2e/` | Playwright test suite |
