# Customer Journey Audit (Prompt 01)

## 1) Current implemented journey

| Journey step | Current status | Files | Missing | Risk |
| --- | --- | --- | --- | --- |
| Landing | Implemented with positioning + guided sandbox entry | `app/page.tsx`, `components/landing/try-grindctrl-sandbox.tsx` | None for preview mode | Messaging drift if dashboard labels diverge |
| Guided preview | Implemented (workflow / voice / file preview) | `components/landing/try-grindctrl-sandbox.tsx`, `lib/landing-sandbox/*` | None for UI preview | Live-mode dependency on backend availability |
| n8n trial inflow bridge | Partial, behind sandbox service contracts | `app/api/landing-sandbox/route.ts`, `lib/landing-sandbox/service.ts` | Full production persistence flow | n8n outage fallback must stay explicit |
| Sign up/sign in | Implemented with Clerk routes | `app/sign-in/*`, `app/sign-up/*` | None for review | Local env misconfiguration blocks auth tests |
| Dashboard entry | Implemented redirect to `/dashboard/overview` | `app/dashboard/page.tsx`, `app/dashboard/layout.tsx` | None | Header pathname alias consistency |
| Saved preview handoff | Implemented localStorage handoff + sanitization | `lib/trial/landing-preview-handoff.ts`, `components/dashboard/trial-preview-handoff-card.tsx` | DB persistence phase | Local-only data can be lost per browser |
| Trial workspace | Implemented reviewer-oriented overview cards | `app/dashboard/overview/page.tsx`, `components/dashboard/trial-workspace-*.tsx` | Workspace sync for persistent checklist state | Reviewer may assume persistence exists |
| AI agents | Implemented preview catalog + detail | `app/dashboard/agents/page.tsx`, `components/dashboard/agent-*.tsx`, `lib/dashboard/agent-catalog.ts` | Live config wiring | Must not imply channel is connected |
| Conversations/messages | Implemented unified preview inbox UI | `app/dashboard/conversations/page.tsx`, `app/dashboard/messages/page.tsx`, `components/dashboard/conversation-inbox-preview.tsx` | Live read/write contracts | No send action now (intentional) |
| Leads/CRM | Implemented preview leads table + CRM pipeline | `app/dashboard/leads/page.tsx`, `app/dashboard/crm/page.tsx`, `components/dashboard/leads-preview-table.tsx`, `components/dashboard/crm-pipeline-preview.tsx` | Real persistence and CRM sync | Must keep “preview-only” language visible |
| Widget embed | Implemented install center preview + copy snippet | `app/dashboard/install/page.tsx` | Runtime domain verification workflow wiring | Placeholder key misuse if misunderstood |
| Integrations | Implemented grouped integration catalog + filter | `app/dashboard/integrations/page.tsx`, `lib/dashboard/integration-catalog.ts` | Credentials flow and connector setup | Users may expect one-click auth today |
| Analytics | Implemented sample analytics dashboard | `app/dashboard/analytics/page.tsx`, `components/dashboard/analytics-preview.tsx`, `lib/dashboard/analytics-preview-data.ts` | Real telemetry pipeline binding | Sample data can be mistaken for live |
| Request implementation | Implemented UI-only validated form | `app/dashboard/implementation/page.tsx`, `components/dashboard/implementation-request-form.tsx` | API + notification + persistence | Must not claim request was sent |
| Reviewer script | Implemented and updated for QA gate | `docs/reviewer-trial-script.md` | CI/browser automation extension | Manual QA variability |

## 2) Dashboard route inventory

| Route | Exists? | Current purpose | Should keep | Should add/rename |
| --- | --- | --- | --- | --- |
| `/dashboard/overview` | Yes | Trial home and handoff | Keep | No |
| `/dashboard/agents` | Yes | AI agents hub preview | Keep | No |
| `/dashboard/conversations` | Yes | Unified inbox preview | Keep | No |
| `/dashboard/messages` | Yes | Message-centric preview | Keep | No |
| `/dashboard/leads` | Yes | Leads preview table | Keep | No |
| `/dashboard/crm` | Yes | CRM pipeline preview | Keep | No |
| `/dashboard/workflows` | Yes | Workflow catalog + history | Keep | No |
| `/dashboard/install` | Yes | Widget/embed install center | Keep | No |
| `/dashboard/integrations` | Yes | Integration catalog | Keep | No |
| `/dashboard/analytics` | Yes | Preview metrics | Keep | No |
| `/dashboard/settings` | Yes | Placeholder settings panel | Keep | Optional deeper settings later |
| `/dashboard/implementation` | Yes | UI-only request form | Keep | No |

Legacy aliases kept:

- `/dashboard/inbox` -> `/dashboard/conversations`
- `/dashboard/sites` -> `/dashboard/install`
- `/dashboard/branding` -> `/dashboard/install`
- `/dashboard/domains` -> `/dashboard/install`
- `/dashboard/routing` -> `/dashboard/agents`
- `/dashboard/intents` -> `/dashboard/agents`

## 3) UI source map

| Module | Best source repo | Source page/component pattern | Copy/adapt level | Dependency risk |
| --- | --- | --- | --- | --- |
| Dashboard shell/nav | Kiranism | `src/app/dashboard/layout.tsx` shell + sidebar rhythm | Composition adapted | Low (already in-repo primitives) |
| Overview metrics/cards | Kiranism + Shadboard | Kiranism overview cards + Shadboard `dashboard-card.tsx` structure | Visual pattern adapted | Low |
| Agents hub | Shadboard + Kiranism | Shadboard card/status pattern, Kiranism overview card density | Composition adapted | Low |
| Conversations/messages | Kiranism + Shadboard | Kiranism messenger split layout + Shadboard chat sidebar/card rhythm | Composition adapted | Low |
| Leads/CRM | Kiranism + Shadboard | Kiranism table/kanban style + Shadboard CRM dashboards | Composition adapted | Low |
| Install center | Shadboard + Kiranism | Shadboard settings/install cards + Kiranism settings spacing | Composition adapted | Low |
| Workflows | Shadboard + Kiranism | Shadboard card grids + Kiranism board/catalog rhythm | Composition adapted | Low |
| Integrations | Shadboard | Pricing/settings-style grid filters | Composition adapted | Low |
| Analytics | Kiranism + Shadboard | Kiranism analytics card groups + Recharts sections from both | Composition adapted | Low |
| Implementation form | Kiranism + Shadboard + Creembase | Kiranism form spacing + Shadboard settings-form wrappers + Creembase admin card rhythm | Composition adapted | Low |

## 4) Data/backend dependency map

| Module | Needs backend now? | Can be UI-only now? | Future Supabase table/RPC | Future n8n workflow |
| --- | --- | --- | --- | --- |
| Overview handoff | No | Yes | `trial_previews`, `dashboard_get_latest_trial_preview` | Trial Preview Persist |
| Agents hub | No | Yes | `agent_configs`, `dashboard_upsert_agent_config` | Social/agent intake queue |
| Conversations/messages | No | Yes | `widget_conversations`, `widget_messages` read RPCs | Website widget conversation preview |
| Leads | No | Yes | `widget_leads`, lead enrichment RPCs | Lead capture to CRM/Sheets |
| CRM pipeline | No | Yes | `crm_pipeline_events` or derived views | Lead capture to CRM/Sheets |
| Install center | No (snippet only) | Yes | existing widget site/domain tables | Widget setup verification workflows |
| Integrations | No | Yes | `integration_requests` | Integration request intake |
| Analytics preview | No | Yes | aggregated event views / materialized metrics | telemetry enrich + reporting workflow |
| Implementation request | No (phase now) | Yes | `implementation_requests`, `dashboard_create_implementation_request` | Implementation Request Intake |

## 5) Risk list

1. Preview-only pages can be misread as live if badge/copy not explicit.
2. localStorage handoff is browser-local and expires; reviewers may expect cross-device continuity.
3. Integrations catalog may imply immediate OAuth; actual path is request-first.
4. Without persistence, implementation requests are not saved beyond UI state.
5. Legacy routes still exist; inconsistent deep-link expectations can confuse reviewers.
6. Mobile overflow risk remains for wide tables/snippets if not regression-tested per breakpoint.

## 6) Implementation phase proposal

| Phase | Scope | Status |
| --- | --- | --- |
| Phase 1 | IA + routes + nav + placeholder utility pages | Safe now |
| Phase 2 | Customer journey module UIs (agents/inbox/leads/crm/install/workflows/integrations/analytics/implementation) | Safe now |
| Phase 3 | Persistence plan documentation + API contracts | Safe now |
| Phase 4 | Supabase schema + RPC migrations for previews/requests | Needs confirmation |
| Phase 5 | n8n automation implementation and connector credentials flows | Must wait for integration approvals |
| Phase 6 | End-to-end reviewer QA + deployment gate | Safe now |
