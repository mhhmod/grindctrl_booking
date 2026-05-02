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

# Prompt 13 — Supabase Persistence Plan, Then Optional Schema

## Objective

Prepare database persistence for trial previews and implementation requests.

## Important

First produce a plan. Do not apply migrations unless explicitly instructed after review.

## Phase A — Plan only

Inspect:
apps/web-next/lib/adapters
apps/web-next/lib/supabase
apps/web-next/lib/types.ts

Recommend future tables:
trial_previews
implementation_requests
agent_configs
integration_requests

Minimum tables for next real phase:

trial_previews:
id uuid primary key
workspace_id uuid
profile_id uuid
source text
mode text
workflow_slug text
summary text
confidence int
extracted_entities jsonb
decision jsonb
recommended_action text
status text
created_at timestamptz
updated_at timestamptz

implementation_requests:
id uuid primary key
workspace_id uuid
profile_id uuid
company_name text
work_email text
business_type text
primary_use_case text
channels jsonb
tools jsonb
pain text
urgency text
notes text
selected_preview_id uuid nullable
status text
created_at timestamptz
updated_at timestamptz

## Required plan doc

Create/update:
apps/web-next/docs/customer-journey-persistence-plan.md

Include:
table design
RLS policy outline
RPC/API route outline
adapter files needed
migration order
rollback plan
what UI can stay local until migration

## Output

Plan created
Recommended tables
RLS strategy
API/adapter strategy
Do-not-implement-yet list
Confirmation no schema changed
