# Quick Start: Widget Setup Flow

**Feature**: Widget Setup Flow  
**Date**: 2026-04-21

## Prerequisites

- Node.js 18+ and npm
- Supabase project with existing `profiles`, `workspaces`, `workspace_members`, `widget_sites`, `widget_domains` tables
- Clerk publishable key configured in `.env` (`VITE_CLERK_PUBLISHABLE_KEY`)
- Supabase URL and anon key configured

## Setup

### 1. Apply Database Migration

Run the delta migration in `supabase/widget_setup_extensions.sql` via Supabase MCP or SQL Editor:

```sql
-- This adds JSONB columns to widget_sites and creates widget_intents + widget_leads tables
\i supabase/widget_setup_extensions.sql
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Dev Server

```bash
npm run dev
```

### 4. Open Dashboard

Navigate to `http://localhost:5173/app.html` (or the Vite dev server URL).

Sign in with Clerk, then:

1. **Create a widget site**: Widget Setup → "Create Widget Site" → enter name
2. **Copy embed snippet**: Dashboard → "Install on Your Site" → click Copy
3. **Add a domain**: Domains → enter domain → click Add
4. **Verify domain**: As workspace admin, click "Verify" on the pending domain
5. **Configure branding**: Branding → set colors, name, logo
6. **Add intents**: Intents → "Add Intent" → fill label, icon, action
7. **Enable lead capture**: Widget Setup → Lead Capture → enable, choose timing mode, select fields

## Testing the Embeddable Widget

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head><title>Widget Test</title></head>
<body>
  <h1>My Site</h1>
  <script src="https://cdn.grindctrl.com/grindctrl-support.js"></script>
  <script>
    GrindctrlSupport.init({
      embedKey: 'YOUR_EMBED_KEY_HERE',
      domain: window.location.hostname
    });
  </script>
</body>
</html>
```

Open this file via `localhost` to test. The widget should:
- Load configuration from Supabase
- Show custom branding and intents
- Display lead capture form based on configured timing mode

## Common Issues

| Issue | Solution |
|-------|----------|
| Widget not loading on localhost | Ensure `localhost` is in allowed domains, or check browser console for CORS/errors |
| Dashboard shows "Auth not configured" | Check `.env` for `VITE_CLERK_PUBLISHABLE_KEY` |
| Domains not appearing | Verify RLS policies allow reading `widget_domains` for workspace members |
| Lead form not showing | Check `lead_capture_json.enabled` is `true` and timing_mode is not `disabled` |

## Build for Production

```bash
npm run build
```

Deploy `dist/` to GitHub Pages (via existing GitHub Actions workflow).

## Rollback

To rollback the database changes:

```sql
-- Remove new columns
alter table public.widget_sites drop column if exists config_json;
alter table public.widget_sites drop column if exists branding_json;
alter table public.widget_sites drop column if exists lead_capture_json;

-- Drop new tables
drop table if exists public.widget_intents cascade;
drop table if exists public.widget_leads cascade;

-- Drop new indexes
drop index if exists idx_widget_sites_embed_key;
drop index if exists idx_widget_intents_site_order;
drop index if exists idx_widget_leads_workspace;
drop index if exists idx_widget_leads_site;
```
