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

# Prompt 12 — Request Implementation Flow

## Objective

Create the customer journey endpoint: when a user wants GrindCTRL connected to real tools, they can submit a request.

## UI source requirements

Use:
- Kiranism forms/settings patterns.
- Shadboard Settings/Auth forms.
- Creembase form/admin request patterns if available.
- shadcn/ui primitives.

## Route

/dashboard/implementation

## Required UI

Implementation request form fields:
Company name
Work email
Business type
Primary use case
Channels needed
Tools to connect
Current process/pain
Urgency
Notes
Selected preview summary if available

Primary use cases:
Customer support
Customer service
Lead management
CRM automation
Social media AI agents
Website chat widget
Voice lead capture
File/document intake
Custom operations workflow

Channels:
Website
WhatsApp
Instagram
Facebook/Messenger
Telegram
Email
Voice
CRM
Google Sheets
Other

Tools:
HubSpot
Salesforce
Pipedrive
Google Sheets
Google Calendar
Gmail
Slack
Supabase
n8n
Other

## Behavior for this phase

UI-only submission:
validate fields
show success:
Implementation request prepared. The next phase will connect this to workspace storage and team notification.

Do not pretend it was sent to team.

## Future TODO

Future: POST to /api/implementation-request → n8n → Supabase + notification.

## Likely files

apps/web-next/app/dashboard/implementation/page.tsx
apps/web-next/components/dashboard/implementation-request-form.tsx
apps/web-next/lib/dashboard/implementation-options.ts

## Tests

form renders
required fields validate
success state appears
selected preview summary loads if available
no network call happens

## Output

Files changed
Form fields
Validation behavior
Success behavior
UI source patterns used
Tests
Lint/test/build result
