# GrindCTRL End-to-End Customer Journey Prompt Queue — V2

## Purpose

This ZIP rebuilds the full customer journey queue and includes the new UI source-of-truth rule.

The objective is to make GrindCTRL review-ready:

Visitor opens grindctrl.cloud
→ understands GrindCTRL
→ tries guided AI previews
→ signs up/logs in
→ lands in dashboard with context
→ sees AI agents, conversations, leads, CRM, widget embed, workflows, integrations, analytics
→ can request implementation
→ understands what GrindCTRL can do for a real business.

## Product framing

GrindCTRL is not an LLM company.

GrindCTRL is an AI implementation and operations platform for businesses:
- customer support
- customer service
- lead management
- CRM workflows
- social media AI agents
- website chat widget
- conversations/messages
- files/images/voice/video workflow previews
- implementation requests
- analytics and operations dashboards

## Required UI source priority

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


## Recommended branch

git checkout main
git pull
git checkout -b phase3/customer-journey-end-to-end-ui-source-v2

## Execution order

00_README_CUSTOMER_JOURNEY_QUEUE_V2.md
00_UI_SOURCE_OF_TRUTH_RULE.md
01_CURRENT_STATE_AUDIT_AND_JOURNEY_MAP.md
02_REVIEW_GATE_AND_RELEASE_BASELINE.md
03_DASHBOARD_INFORMATION_ARCHITECTURE.md
04_TRIAL_ONBOARDING_AND_DASHBOARD_HOME.md
05_AI_AGENTS_HUB_UI.md
06_CONVERSATIONS_MESSAGES_UNIFIED_INBOX.md
07_LEADS_AND_CRM_MANAGEMENT_UI.md
08_WIDGET_EMBED_INSTALL_CENTER.md
09_WORKFLOWS_AND_PLAYGROUND_HISTORY.md
10_INTEGRATIONS_AND_CHANNELS_CENTER.md
11_ANALYTICS_AND_REVIEW_METRICS.md
12_REQUEST_IMPLEMENTATION_FLOW.md
13_SUPABASE_PERSISTENCE_PLAN_THEN_OPTIONAL_SCHEMA.md
14_N8N_WORKFLOW_QUEUE_FOR_NEXT_AUTOMATIONS.md
15_END_TO_END_QA_DEPLOY_REVIEW_SCRIPT.md
16_SINGLE_MASTER_PROMPT.md
17_CODEX_OUTPUT_REQUIREMENTS.md

## Dashboard target modules

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

## Best execution

Run one prompt at a time:
1. Audit
2. Implement one module
3. Run lint/test/build
4. Review UI
5. Commit
6. Continue next prompt

Use the master prompt only if you accept one larger run.
