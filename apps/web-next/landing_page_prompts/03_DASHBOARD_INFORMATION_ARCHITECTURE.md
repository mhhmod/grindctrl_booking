You are working in:

mhhmod/grindctrl_booking

Use only:

apps/web-next

# UI Source-of-Truth Rule

For any new UI, page, section, component, dashboard module, card, table, form, drawer, modal, command menu, chat view, inbox view, Kanban/pipeline, analytics chart, pricing/trial card, settings panel, install snippet card, onboarding screen, or visual element:

Use these sources first, in this priority order:

1. pacekit/creembase
   https://github.com/pacekit/creembase

2. Qualiora/shadboard
   https://github.com/Qualiora/shadboard

3. Kiranism/next-shadcn-dashboard-starter
   https://github.com/Kiranism/next-shadcn-dashboard-starter

4. shadcn/ui official components

Do not design new UI patterns from scratch unless the needed pattern does not exist in any of the above sources.

Before creating or modifying UI:
- Inspect the relevant source repo/page/component first.
- Identify the closest matching source pattern.
- Copy/adapt the composition into apps/web-next.
- Keep the GrindCTRL brand, copy, routes, and data contracts.
- Do not replace GrindCTRL architecture with a source repo architecture.
- Do not copy unrelated auth, billing, database, or deployment systems.
- Do not import secrets or environment assumptions from source repos.
- Do not add dependencies unless required by the copied/adapted component and justified.
- Do not create custom low-level primitives when shadcn/ui already has them.

Allowed:
- Copy/adapt visual composition.
- Copy/adapt shadcn/Radix/Tailwind component patterns.
- Copy/adapt dashboard layouts, cards, forms, tables, chat/inbox, settings, Kanban, pricing/trial, analytics, install-snippet patterns, and onboarding patterns.

Not allowed:
- Rebuilding GrindCTRL around another repo.
- Replacing Clerk/Supabase/n8n decisions.
- Changing routing architecture unnecessarily.
- Adding billing/payment/auth systems from templates.
- Adding unused dependencies.
- Creating custom low-level primitives when shadcn/ui already has them.

Every UI implementation output must include:
1. Which source repo/page/component was used.
2. What was copied/adapted.
3. What was intentionally not copied.
4. Whether any dependency was added.
5. Why the UI was not built from scratch.


Global hard rules:
- Do not touch n8n workflow JSON files unless the prompt explicitly asks for a workflow plan only.
- Do not change Supabase schema/migrations unless the prompt explicitly says planning only.
- Do not change Clerk provider/auth config.
- Do not touch the root Vite app.
- Do not change GitHub Actions or deployment scripts.
- Do not implement billing/payment.
- Do not pretend preview data is live.
- Do not claim CRM/Sheets/email/social messages were actually sent.
- Do not expose secrets.
- Keep production decisions: Clerk auth, Supabase GrindCTRL (v1), n8n workflows, Hostinger/VPS direction.

Validation from apps/web-next:
npm run lint
npm run test
npm run build

# Prompt 03 — Dashboard Information Architecture

## Objective

Create a clear dashboard structure for the full GrindCTRL trial/customer journey.

## Required nav modules

Overview
AI Agents
Conversations
Messages
Leads
CRM
Workflows
Widget / Embed
Integrations
Analytics
Settings
Implementation

## UI source requirements

Use:
- Kiranism dashboard shell/nav/layout patterns first.
- Shadboard dashboard/sidebar/card grouping second.
- Creembase app/admin patterns if stronger.
- shadcn/ui for primitives.

Before editing, report which repo pattern is used.

## Task

Modify nav/config/route metadata as needed.

Likely files:
apps/web-next/lib/dashboard/nav-config.ts
apps/web-next/lib/dashboard/route-meta.ts
apps/web-next/lib/rbac/dashboard-policy.ts
apps/web-next/components/dashboard/dashboard-shell.tsx

Add placeholder pages only if missing:
apps/web-next/app/dashboard/agents/page.tsx
apps/web-next/app/dashboard/messages/page.tsx
apps/web-next/app/dashboard/crm/page.tsx
apps/web-next/app/dashboard/analytics/page.tsx
apps/web-next/app/dashboard/implementation/page.tsx

## Placeholder rule

Each placeholder must be useful, not empty. Show:
- what it manages
- inputs
- outputs/value
- preview-ready now
- requires connection later

## Tests

Update nav and route-meta tests.

## Output

Routes added/updated
Nav structure
RBAC keys added
Placeholder pages added
UI source patterns used
Tests updated
Build result
