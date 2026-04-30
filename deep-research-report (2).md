# GrindCTRL landing page and dashboard research report

## Strategic recommendation

GrindCTRL should be positioned as an **AI operations platform** for customer support, customer service, lead capture, and operational automation, not as another model vendor. The current `apps/web-next` landing page already points in the right direction: it frames the product as an implementation and automation platform spanning text, voice, image/video, file processing, CRM integration, cloud systems, and dashboards. The right move now is not to widen the message further, but to make it more believable, more outcome-led, and more actionable. fileciteturn4file0L1-L1

That positioning is also how the strongest products in the category behave. Across entity["company","Intercom","customer service platform"], entity["company","Zendesk","customer service software"], entity["company","HubSpot","crm platform"], and entity["company","Salesforce","crm software"], the value proposition is not “we have models.” It is “we unify conversations, knowledge, human handoff, actions, and reporting inside real business workflows.” That is the lane GrindCTRL should own. citeturn0search6turn1search5turn1search4turn2search11

The implication is simple: the landing page should sell **business transformation by workflow**, while the dashboard should act as the **control plane for deployed AI operations**. Multimodality matters, but only insofar as it creates useful actions such as support resolution, lead qualification, CRM updates, meeting booking, extracted reports, or routed escalations. citeturn0search6turn1search5turn2search8

## What the current product already has

The current `apps/web-next` app is not starting from zero. Its README says the Next app is the in-repo dashboard shell, already wired for real entity["company","Clerk","auth platform"] authentication and real entity["company","Supabase","backend platform"] RPC integration, while the public widget loader/runtime remains outside React. In other words, the app is already intended to become the operator dashboard, not an experimental side project. fileciteturn41file0L1-L1

The new landing page is already visually repositioned, but it is still mostly static. It has a strong hero, capability blocks, a three-step implementation narrative, and use-case cards, yet it still lacks the most important conversion device for this category: a **public proof interaction** that lets a visitor try something meaningful before signup. There is currently no visible “first test,” no structured output preview, and no bridge between anonymous curiosity and authenticated deployment. fileciteturn4file0L1-L1

The dashboard skeleton is also genuinely useful now. The sidebar already exposes Overview, Conversations, Install, Branding, Intents, Domains, Leads, Workflows, Integrations, and Settings. Route metadata exists for all of those sections; Overview, Install, and Leads are already bound to workspace/site/domain/intent/lead/analytics adapters; and Conversations, Workflows, and Integrations already have product-language placeholder pages. That means the product has a real shell, but several of the most strategic screens are still concept stubs rather than operating screens. fileciteturn5file0L1-L1 fileciteturn6file0L1-L1 fileciteturn23file0L1-L1 fileciteturn36file0L1-L1 fileciteturn42file0L1-L1 fileciteturn44file0L1-L1 fileciteturn7file0L1-L1 fileciteturn8file0L1-L1

More importantly, the repo already contains the raw material for the product story you want. The older app includes a trial playground, Blueprint Studio, and documented external services, including n8n routing webhooks, Groq prompt contracts, and image-generation tooling. Blueprint Studio already defines production-minded blueprint prompts for `qualify_leads`, `customer_support`, `generate_reports`, `book_meetings`, and `follow_up`, and the widget n8n contract already defines `conversation_start`, `message_sent`, `escalation_trigger`, trial-warning, branding-change, and usage-threshold events, plus the POST-back path for assistant replies. That is not throwaway work. It is a ready-made foundation for the “try it now” surface and the workflow template system you need in the Next app. fileciteturn32file0L1-L1 fileciteturn35file0L1-L1 fileciteturn27file0L1-L1 fileciteturn28file0L1-L1

The configuration model in the Next app is also already coherent. `WidgetSite` and the widget-site adapter are centred on a single `settings_json` surface with top-level groups for branding, widget behaviour, leads, routing, and security; the dashboard RPC migration is shaped around that same unified settings contract. That is the correct control-plane abstraction for v1, because it gives the UI one authoritative settings document while leaving execution to workflows and integrations. fileciteturn21file0L1-L1 fileciteturn43file0L1-L1 fileciteturn19file0L1-L1

One important caution emerged from connector inspection: the product appears to be in the middle of an architectural cutover between older widget/runtime paths and the newer workspace/widget model. That does not block the landing page decision, but it **does** mean Codex and Claude Code should not keep adding features until one canonical runtime/data contract is declared. Otherwise the product risks looking polished at the UI level while remaining split underneath.

## What the category makes non-negotiable

The category is remarkably consistent about what matters. Intercom emphasises a single AI agent that can shift across service and sales roles, hand off safely to humans, and report on performance in one place. Zendesk emphasises AI agents across messaging, email, API, and web forms, with information gathered during handoff so human agents can resolve faster. HubSpot’s conversation workspace ties messages to associated records such as contacts, tickets, deals, companies, prior conversations, comments, attachments, and meeting actions. Salesforce frames the service stack as a unified AI-powered workspace across channels, CRM context, knowledge, handoff, and dashboards. The recurring pattern is obvious: **inbox + context + knowledge + action + measurement**. citeturn0search6turn1search5turn1search4turn2search11turn2search10

That pattern is exactly why GrindCTRL should not try to look like a model playground on the inside. The dashboard should not prioritise “models,” “prompts,” or “labs” as first-class navigation. It should prioritise conversations, leads, sites, routing, workflows, integrations, knowledge, analytics, and team settings. The promise is not that a user can toggle fancy AI; the promise is that a business can **run support, sales intake, and operational triage through one governed system**. citeturn0search6turn1search4turn2search8

The workflow layer should also feel native to operations rather than academic agent-building. entity["company","n8n","workflow automation"] documents workflows as combinations of triggers and actions, and its AI Agent / AI Agent Tool nodes support orchestration by letting a root agent use specialised sub-agents as tools. That maps extremely well to what GrindCTRL needs: one business workflow can listen for a chat, voice note, form, upload, or API event; classify; enrich; decide; and then act on external systems. citeturn0search1turn0search3turn0search2

The provider landscape is already broad enough to support the multimodal promise without GrindCTRL pretending to be a foundation-model company. entity["company","OpenAI","ai company"] supports speech-to-text, text-to-speech, and image generation/editing. entity["company","ElevenLabs","voice ai company"] supports text-to-speech and speech-to-text. entity["company","Google","search and cloud"] documents Gemini image and video understanding. entity["company","Runway","video ai company"] documents text-to-video, image-to-video, and video-to-video paths. That means GrindCTRL’s real moat should be **workflow design, reliability, business integration, and UX clarity**, not synthetic “we do everything ourselves” messaging. citeturn4search5turn9search0turn3search7turn5search6turn5search2turn5search1turn5search0turn5search5

## Landing page blueprint

The landing page should be reorganised around a very simple buyer journey: **understand the outcome, try one real task, sign in to save/deploy, then expand in the dashboard**. The current hero and services blocks are good raw material, but they need a proof layer directly under the fold. fileciteturn4file0L1-L1

The strongest version of the page is not a giant modality poster. It is a focused operations narrative with a visible public sandbox. That sandbox should let an anonymous visitor run one meaningful business interaction, not browse an empty demo. The best three anonymous tests are: a text prompt that turns a business problem into a workflow plan, a short voice note that becomes a transcript plus lead/support extraction, and an image or file upload that becomes a structured summary or extraction result. Those behaviours are already conceptually present in the repo through Blueprint Studio, the voice handoff prompt, and the widget/event contracts. fileciteturn35file0L1-L1 fileciteturn27file0L1-L1

A landing page that fits the current product direction should contain the following sections:

| Section | What it should do |
|---|---|
| Hero | Promise business outcomes: support resolution, lead capture, and operational automation |
| Public sandbox | Let visitors try one text, one voice, and one file/image workflow before signup |
| Workflow gallery | Show ready templates such as support triage, voice lead capture, file extraction, and meeting booking |
| Modality map | Present inputs and outputs as business actions, not as a generic tech matrix |
| Integration proof | Show that GrindCTRL plugs into websites, CRM systems, Google tools, cloud services, and APIs |
| Governance proof | Show human handoff, auditability, domain controls, and analytics |
| Conversion CTA | Ask the visitor to sign in only when they want to save, export, deploy, or connect systems |

The most important design decision is that the anonymous sandbox should return a **structured business artefact**, not just chat text. For example, a voice test should show the transcript, detected intent, extracted contact fields, recommended workflow, and next action. A file test should show extracted fields, a short report, and the system it would update. A “describe your process” text test should show a workflow blueprint with steps, inputs, outputs, and expected ROI. That feels like a platform, not a chatbot. fileciteturn35file0L1-L1

The full modality matrix should still appear on the page, but as an “input to action” map rather than the hero itself. The right framing is: **Text, Voice, Image, Video, File, Form, and Event all enter one workflow engine; outputs become replies, records, bookings, reports, tasks, and routed actions.** This gives you the breadth you want without making the page read like a synthetic benchmark sheet.

Video should be handled carefully. The page can absolutely show that GrindCTRL supports video understanding and video generation workflows, but video generation should not be the first anonymous conversion test. Provider documentation and pricing structures still make short-form video generation materially more expensive and variable than text, voice, or file flows, so it is better used as a signed-in or premium showcase. citeturn8search7turn8search0turn5search1turn5search0

## Trial model and activation path

The best activation model for GrindCTRL is a **hybrid**. Use a **free anonymous sandbox** for proof-of-value, then a **signed-in day-based trial** for deployment and team evaluation. That matches how the category tends to convert serious buyers. Intercom and Zendesk both use 14-day no-card trials; HubSpot uses a free-forever CRM entry point; and media/creative AI products such as ElevenLabs and Runway use credit-limited free access. The common theme is that people get real value before they commit, but expensive or operationally meaningful actions are gated. citeturn7search0turn6search1turn6search4turn6search0turn8search0

For GrindCTRL specifically, an **hours-based trial is the wrong model**. This is not a casual consumer toy; businesses need time to verify domains, add install snippets, test routing, connect calendars or sheets, review tone, and share the dashboard with collaborators. A 14- to 15-day trial is the right envelope. It is familiar, credible, and long enough for real setup without becoming an unbounded free plan. citeturn7search0turn6search1turn27file0turn7search1

The anonymous sandbox can be stricter, and the repo already contains excellent baseline limits in the legacy playground: 3 turns per session, 5 anonymous sessions per day, 30-second audio, 500-character messages, and 2 image generations. Those caps are almost exactly the kind of anti-abuse footprint a public landing test needs. They allow proof without letting anonymous traffic become infrastructure drain. fileciteturn32file0L1-L1

The signed-in trial should unlock the real product, but with cost controls. The right trial envelope is: one workspace, one live site, one verified domain, one deployed widget, CRM/Sheets/email actions enabled, conversation history enabled, lead capture enabled, workflow templates enabled, analytics enabled, and limited media credits. Video generation should be either heavily capped or upgrade-gated; video understanding is less risky and can be included earlier. White-label should stay off during trial unless it is being used as a sales-led conversion lever.

There is also one strategic business-model decision to make very clearly: do **not** copy HubSpot’s free-forever full CRM posture yet. HubSpot can absorb that because its monetisation stack is far broader. GrindCTRL is earlier-stage, and its high-cost surfaces include workflow execution, media generation, and data sync. The safer model is: free public taste, serious signed-in trial, then paid recurring plans with usage limits and premium capabilities. citeturn6search4turn6search0turn8search0

## Dashboard scope and workflow operating model

The current sidebar reflects implementation slices more than business value. Users do not naturally think in terms of separate top-level items for Install, Branding, and Domains. They think in terms of **Inbox, Leads, Sites, Routing, Workflows, Integrations, Analytics, and Settings**. Because the market leaders organise around the conversation workspace and associated business context, GrindCTRL should do the same. fileciteturn5file0L1-L1 citeturn1search4turn2search11turn7search4

The most practical dashboard information architecture for v1 is this:

| Recommended area | What it should contain |
|---|---|
| Overview | Workspace health, usage, conversion, resolution, and deployment status |
| Inbox | Real conversation stream, filters, AI summaries, handoff, replay, and audit trail |
| Leads | Captured leads, scoring, qualification state, sync status, booking status |
| Sites | Install snippet, domains, branding, launcher/widget settings, verification |
| Routing | Intents, handoff rules, availability, escalation logic, channel rules |
| Workflows | Templates, builder, runs, logs, retries, approvals, version history |
| Integrations | CRM, Google tools, email, webhooks, storage, telephony, sync diagnostics |
| Knowledge | Connected documents, FAQs, indexed status, freshness, grounding controls |
| Analytics | Funnel, resolution, response quality, automation rate, lead conversion |
| Settings | Team, roles, API keys, limits, billing, audit controls |

That recommended structure does **not** require throwing away the current implementation. It mainly requires regrouping existing routes and renaming them in customer language. “Conversations” should become “Inbox.” “Intents” should become “Routing.” “Install + Branding + Domains” should become “Sites.” “Overview” can remain. “Leads,” “Workflows,” “Integrations,” and “Settings” already map cleanly. The single major addition that should be made now is **Knowledge**, because knowledge-grounded support is a category expectation and the Supabase project already has the beginnings of that model through connector-visible `knowledge_sources`. fileciteturn6file0L1-L1 citeturn0search6turn2search10

For CRM management, the right strategic choice is **not** to build a native full CRM. That would drag the product into a category owned by HubSpot and Salesforce. GrindCTRL should instead own the AI-native layer: capture, qualify, summarise, enrich, recommend next action, sync to external CRM, and keep an internal timeline of workflow state. In practical terms, “CRM management” in GrindCTRL should mean lead state, sync state, activity timeline, outcome suggestions, meeting status, and external record links—not a full contact/company/deal database clone. citeturn1search4turn2search11

The workflow system should then be built around a small set of opinionated templates rather than an empty canvas first. The exact workflow name **“Voice Lead Capture - Groq to Google Sheets”** did not surface in the selected repo scan, so it should be treated as a required product template rather than an artefact already codified in the codebase. The closest internal foundations are the Blueprint Studio voice-handoff prompt and the n8n `conversation_start` / `message_sent` contracts, which already describe the right data flow. fileciteturn35file0L1-L1 fileciteturn27file0L1-L1

The first workflow templates to ship should be these:

| Workflow template | Trigger and input | Output and action |
|---|---|---|
| Voice lead capture | Voice note or live voice transcript | Transcript, extracted lead fields, score, Google Sheets row, CRM sync, booking CTA |
| Support answer and escalation | Chat message, voice transcript, or uploaded file | AI answer, confidence score, summary, ticket/escalation when needed |
| Form lead qualification | Form submit or widget lead prompt | Lead score, routing, sales reply draft, CRM update, meeting suggestion |
| File intake automation | PDF, document, invoice, contract, spreadsheet | Extracted fields, summary, report, spreadsheet row, approval task |
| Image inspection workflow | Product photo, screenshot, damage photo, visual asset | Description, inspection result, issue flag, CRM note, support/sales task |
| Video intelligence workflow | Uploaded video or call recording | Transcript, summary, timestamped report, clip suggestions, next-step task |
| Scheduled ops digest | Scheduled event or API trigger | Daily/weekly summary, dashboard update, email/slack-style notification, task batch |

All v1 workflows should write to the same normalised output envelope, regardless of modality. That envelope should include: `status`, `summary`, `confidence`, `extracted_entities`, `recommended_action`, `executed_actions`, `human_handoff_required`, `external_refs`, and `audit_trail`. If GrindCTRL enforces that single output contract, the dashboard becomes easier to design, integrations become easier to debug, and analytics become much more reliable.

## Build order for Codex and Claude Code

The first implementation decision should be architectural, not cosmetic: **freeze one canonical runtime/data path**. The dashboard, the widget runtime, the edge functions, and the workflow contracts need one authoritative site/conversation/message/settings model before more surface work is added. This matters more than pixel polishing because the current product already looks credible enough to ship a demo, but long-term reliability depends on avoiding split contracts. fileciteturn41file0L1-L1 fileciteturn19file0L1-L1 fileciteturn43file0L1-L1

After that, the highest-value build order is straightforward:

1. **Port the public sandbox into `apps/web-next`.**  
   Codex should build the landing-page “Try GrindCTRL” surface in Next. Claude Code should wire the backend path using the existing blueprint prompt patterns, widget message contracts, and anti-abuse limits. The anonymous output should be structured, saved nowhere permanent, and side-effect-free by default. fileciteturn35file0L1-L1 fileciteturn27file0L1-L1 fileciteturn32file0L1-L1

2. **Turn Conversations into a real inbox.**  
   Codex should replace the placeholder with searchable conversation lists, detail view, AI summary, filters, status, assignee, and handoff controls. Claude Code should implement the query layer, audit events, and any missing RPCs or edge functions. The goal is not “logs”; it is a real operational inbox. fileciteturn44file0L1-L1

3. **Merge Install, Branding, and Domains into a Sites control area.**  
   Codex should simplify dashboard navigation so the sidebar feels product-led, not implementation-led. Claude Code should keep the existing install contract, domain verification, and settings model intact while exposing them through one coherent screen with tabs. fileciteturn36file0L1-L1 fileciteturn43file0L1-L1

4. **Ship workflow templates before a fully empty builder.**  
   The first three templates should be Voice Lead Capture, Support Answer + Escalation, and File Intake Automation. Codex should implement the template UI, run history, and output cards; Claude Code should own execution contracts, integrations, retries, and logging. This gives immediate customer value without forcing users to design from a blank canvas.

5. **Add CRM sync and booking state inside Leads, not as a separate native CRM.**  
   Codex should expand Leads into qualification, owner, stage, sync status, and meeting status. Claude Code should manage provider mappings, sync logs, and external record references. This matches buyer expectations while keeping GrindCTRL focused on orchestration rather than CRM replacement. fileciteturn42file0L1-L1 citeturn1search4turn2search11

6. **Add a Knowledge section and wire it into support workflows.**  
   Knowledge is missing from the current nav, but it is essential if the support promise is meant to be credible. Codex should build the source/index/status UI. Claude Code should implement ingestion state, freshness, and grounding controls. This is one of the biggest gaps between a flashy demo and a deployable platform.

7. **Lock the activation model and pricing behaviour before public launch.**  
   Codex should implement the anonymous sandbox gate, signup prompt, and trial messaging. Claude Code should enforce trial limits, usage tracking, and expiry logic consistently across widget runtime, dashboard, and workflows. The public experience should feel generous, but the back end should remain tightly budgeted. fileciteturn27file0L1-L1 citeturn7search0turn6search1turn8search0

If this sequence is followed, GrindCTRL can ship a landing page that genuinely demonstrates power, a dashboard that feels like a real operator console, and a workflow system that is commercially useful on day one. The most important product decision is not whether the platform can eventually support every permutation of text, voice, image, video, file, and API input. It can. The real decision is to make **support, service, leads, and operational routing** the product core first, and let multimodality serve that core instead of distracting from it.