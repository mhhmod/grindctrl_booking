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

# Prompt 08 — Widget Embed and Install Center

## Objective

Make dashboard clearly show the website chat widget/code snippet capability.

## UI source requirements

Use:
- Shadboard Settings forms/cards for install settings.
- Kiranism settings/infobar/card patterns.
- Creembase admin settings/install patterns if available.
- shadcn/ui primitives.

## Route

Use existing /dashboard/install or label it Widget / Embed.

## Required UI

Widget install card:
copyable script snippet
install steps
domain verification concept
widget preview
supported pages concept
status badges

Snippet example with placeholder only:
<script
  src="https://grindctrl.cloud/scripts/grindctrl-support.js"
  data-site-key="gc_your_site_key_here"
  async
></script>

If actual runtime path differs in repo, inspect and use the correct one.

## Copy behavior

Add copy button with local confirmation.

## Preview

Small widget launcher/chat panel preview:
brand
greeting
support/lead/file quick actions
powered by GrindCTRL optional

## Inspect

apps/web-next/app/dashboard/install/page.tsx
apps/web-next/lib/adapters/install.ts
apps/web-next/components/dashboard/*

## Tests

install page renders snippet
copy button exists
placeholder key not real secret
no NEXT_PUBLIC secret added

## Output

Files changed
Snippet behavior
Widget preview behavior
UI source patterns used
Tests
Lint/test/build result
