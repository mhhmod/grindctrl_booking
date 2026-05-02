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

# Prompt 01 — Current State Audit and Customer Journey Map

## Objective

Audit the current GrindCTRL app and produce a precise end-to-end customer journey map before making changes.

## Hard rule

Do not modify files yet.

## Inspect

apps/web-next/app/page.tsx
apps/web-next/app/dashboard
apps/web-next/components/dashboard
apps/web-next/components/landing
apps/web-next/lib/dashboard
apps/web-next/lib/landing-sandbox
apps/web-next/lib/trial
apps/web-next/lib/adapters
apps/web-next/docs
apps/web-next/.env.example

Also inspect the UI source repos and map useful patterns:
- pacekit/creembase
- Qualiora/shadboard
- Kiranism/next-shadcn-dashboard-starter
- shadcn/ui

## Required output

### 1. Current implemented journey

Table:
Journey step | Current status | Files | Missing | Risk

Steps:
Landing
Guided preview
n8n trial inflow bridge
Sign up/sign in
Dashboard entry
Saved preview handoff
Trial workspace
AI agents
Conversations/messages
Leads/CRM
Widget embed
Integrations
Analytics
Request implementation
Reviewer script

### 2. Dashboard route inventory

Route | Exists? | Current purpose | Should keep | Should add/rename

Expected:
/dashboard/overview
/dashboard/agents
/dashboard/conversations
/dashboard/messages
/dashboard/leads
/dashboard/crm
/dashboard/workflows
/dashboard/widget or /dashboard/install
/dashboard/integrations
/dashboard/analytics
/dashboard/settings
/dashboard/implementation

### 3. UI source map

For every missing UI area, create:
Module | Best source repo | Source page/component pattern | Copy/adapt level | Dependency risk

### 4. Data/backend dependency map

Module | Needs backend now? | Can be UI-only now? | Future Supabase table/RPC | Future n8n workflow

### 5. Risk list

Identify UI-only areas that must not pretend to be live, persistence needs, external-integration expectations, and deployment blockers.

### 6. Implementation phase proposal

List exact phases and whether each is safe now, needs confirmation, or must wait.
