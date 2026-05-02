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

# Single Master Prompt — Full End-to-End Customer Journey V2

Use this only if you want one large Codex/Claude run.

## Objective

Finalize the GrindCTRL review-ready customer journey:

Visitor opens landing
→ runs guided AI preview
→ signs up/logs in
→ dashboard remembers preview
→ user sees AI agents, conversations/messages, leads/CRM, widget embed, workflows, integrations, analytics, implementation request
→ reviewer understands GrindCTRL value end-to-end.

## Required work

1. Audit current journey and missing pages.
2. Map every new UI to one of:
   - pacekit/creembase
   - Qualiora/shadboard
   - Kiranism/next-shadcn-dashboard-starter
   - shadcn/ui

3. Ensure dashboard routes/nav:
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

4. Dashboard overview:
trial workspace
saved preview handoff
next best actions
review checklist

5. AI Agents hub:
Website Support Agent
WhatsApp Agent
Instagram Agent
Facebook/Messenger Agent
Telegram Agent
Voice Lead Agent
File Intake Agent
CRM Follow-up Agent

6. Conversations/messages:
unified inbox preview
channels
statuses
AI suggested reply
lead/contact side panel
handoff preview

7. Leads/CRM:
leads table/cards
CRM pipeline preview
lead scoring/status
CRM-ready summaries

8. Widget/embed:
copyable snippet
install steps
domain verification concept
widget preview

9. Workflows:
workflow catalog
latest preview history from local handoff
future saved history messaging

10. Integrations:
catalog grouped by AI/social/CRM/support/ops/data/automation/cloud
request connection CTA

11. Analytics:
trial funnel preview
operations metrics preview
channel breakdown preview

12. Implementation request:
UI-only request form:
company
email
use case
channels
tools
pain
urgency
notes
selected preview

No network call yet.

13. Docs:
apps/web-next/docs/customer-journey-persistence-plan.md
apps/web-next/docs/n8n-next-workflow-queue.md
apps/web-next/docs/reviewer-trial-script.md

14. Tests:
dashboard nav/routes
preview handoff
AI agents catalog
conversations preview
leads/CRM preview
implementation form validation
widget snippet placeholder safety

15. Validation:
npm run lint
npm run test
npm run build

## Output

Files changed
Routes added/updated
Customer journey implemented
UI source patterns used per page/component
What was copied/adapted
What was not copied
Dependencies added and why
UI-only areas clearly marked
Docs created
Tests added
Lint/test/build result
Security confirmation
Deployment blockers
Ready/not ready for production review
