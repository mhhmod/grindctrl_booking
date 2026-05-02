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

# Prompt 15 — End-to-End QA, Deploy Gate, and Reviewer Script

## Objective

Confirm the whole customer journey is review-ready and produce the final reviewer script.

## Full journey to test

1. Open grindctrl.cloud or local app
2. Understand hero and positioning
3. Run guided preview
4. See structured result
5. Click Start 14-day trial
6. Sign up/sign in
7. Dashboard opens
8. Saved preview is visible
9. Explore AI Agents
10. Explore Conversations/Messages
11. Explore Leads/CRM
12. Explore Widget/Embed snippet
13. Explore Integrations
14. Explore Analytics
15. Request implementation plan

## Required QA

Devices:
390px mobile
768px tablet
1440px desktop

Themes:
dark
light

Auth:
logged out
sign up
sign in
direct dashboard visit

API:
mock sandbox mode
live sandbox mode if env available
n8n down fallback

Security:
No n8n URL in browser
No token in browser
No real CRM/Sheets/email action unless explicitly enabled
No secrets in source

## Create/update

apps/web-next/docs/reviewer-trial-script.md

Include:
what to test
expected value
preview-only caveats
known local caveats
next roadmap

## Output

QA result
Build result
Security result
Reviewer script path
Deployment blockers
Ready/not ready
UI source compliance result
