# GRINDCTRL Next Dashboard

This app is the in-repo Next.js dashboard shell for GRINDCTRL. It lives alongside the existing static site and widget runtime and only replaces dashboard UI surfaces as parity is reached.

## Scope

- Real Clerk authentication for dashboard access
- Real Supabase RPC integration against the existing GRINDCTRL backend contracts
- `widget_sites.settings_json` remains the only editable dashboard config surface
- Public widget loader/runtime stays outside this app and is not rewritten into React

## Local Development

1. `npm install`
2. Copy `.env.example` to `.env.local`
3. Fill in Clerk, Supabase, and app URL values
4. `npm run dev`

## Tests

- `npm test`

## Important Contracts

- Workspace/site bootstrap: `get_user_workspace`
- User role lookup: `dashboard_get_user_role`
- Site updates: `dashboard_update_widget_site`
- Domain/intents/leads listing: existing `dashboard_*` RPCs
- Install contract: `https://cdn.grindctrl.com/widget/v1/loader.js`
