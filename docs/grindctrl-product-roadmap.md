# GrindCTRL product roadmap

Date: 2026-09-17
Internal planning document. Not marketing copy, not for publication.

## 1. Purpose and how to read it

This document tracks where the master strategy program actually stands in code today, what is blocking stronger public claims or scale, what has to happen before preview surfaces (analytics, CRM, workflows, channels) can become real, what Phase 6 product expansion needs, and what decisions the owner still has to make.

Read it alongside:

- `docs/grindctrl-current-state-audit.md` (Phase 0 audit, dated 2026-09-13); the baseline inventory this roadmap builds on.
- `C:\Users\HP\Downloads\GrindCTRL_Master_Product_Strategy_and_Implementation_Spec.md`; sections 40 (implementation phases), 43 (priority matrix), 44 (acceptance criteria), 25 (data/analytics architecture), 26 (multi-tenant), 27 (AI provider architecture), 28 (reliability).

Every current-state statement below carries a file path. Where no path is given, the statement is explicitly marked unverified. Effort sizes are S (a few files, one lane), M (a feature slice, needs a plan), L (spans data model + backend + UI, needs its own spec); not day estimates.

## 2. Where the program stands

| Phase | What shipped | Commit(s) | What it deliberately did not claim |
|---|---|---|---|
| 0. Repository and truth audit | `docs/grindctrl-current-state-audit.md`: full inventory of routes, auth, tenancy, data layer, analytics gap, security posture | (audit document, no product commit) | Did not change product behavior, production config, or claims |
| 1. Positioning and homepage architecture | Platform-first homepage, evidence-gated claims, removed fabricated showcase numbers | `2d2688d` feat(site): evidence-gated public claims, platform-first homepage, consent-only analytics | Did not fabricate replacement metrics; landing copy still leans on qualified language, not guarantees |
| 2. Analytics foundation | Consent-gated analytics envelope (opt-in only, no analytics cookie/event before consent) | `2d2688d` (same commit, consent-only analytics half) | Did not build the full cross-surface event taxonomy from spec section 25; did not touch dashboard/reporting data model |
| 3. Conversion assets | `/roi` scenario calculator, case-study governance, honest implementation intake form | `e8abf42` feat(site): ROI scenario calculator, case-study governance, honest implementation intake | Calculator uses editable merchant assumptions, not guaranteed outcomes; intake form tells the merchant "This has not been sent to GrindCTRL or saved to your workspace." (`apps/web-next/lib/dashboard/dashboard-content-copy.ts`) |
| 4. Product pages | `/shopping`, `/conversations`, `/operations`, `/integrations`; corrected AI-provider register | `97816cb` fix(site): list the AI infrastructure GrindCTRL actually runs, not Gemini/Claude; `4497ac7` feat(site): product pages for shopping, conversations, operations and integrations | Deliberately shipped no `/analytics` page; dashboard analytics is preview data (see section 3); no CRM, workflow-history, or AI-agents pages, for the same reason |
| 5. Technical trust | `/security` page, `security.txt`, unpublished privacy policy and terms drafts for owner review | `20bfd58` feat(site): security page describing the controls that actually run; `c2039ef` docs(legal): unpublished privacy policy and terms drafts for owner review | Security page explicitly lists what does not exist (certification, status page, DPA, role-based permissions) instead of implying it does; legal drafts are not live and say so on every page |

Phase 6 (product expansion) has not started. See section 5.

## 3. Now: blocking gaps before stronger public claims or scale

Every item below was checked against the current codebase on 2026-09-17. None were dropped; all are confirmed present in code as described. One of them (workspace roles) is already disclosed publicly on `/security` as a known limitation. Backup and restore status is not mentioned on `/security` at all; it is unverified rather than disclosed (see 3.10).

### 3.1 Workspace roles not enforced

**Why it matters.** Every member of a workspace has the same dashboard capabilities as the owner. Anyone invited to a workspace can view billing, disconnect stores, or change settings meant for owner-only decisions. This blocks any multi-seat or agency/team sales motion and is a real authorization gap, not just a UX gap.

**Evidence.** `apps/web-next/lib/rbac/dashboard-policy.ts`: `resolveDashboardPermissions()` calls `getDefaultDashboardPermissions()` regardless of the `role` argument (owner/admin/member), so every role resolves to the identical full permission set. This is already disclosed at `apps/web-next/components/security/security-copy.ts:186-190` ("Every workspace member currently has the same dashboard capabilities as the owner. Per-role permissions are not enforced yet.").

**Proposed fix.** Define real permission sets per `DashboardWorkspaceRole` (owner/admin/member already exist as a type) in `resolveDashboardPermissions()`, then gate the dashboard nav and the underlying server actions/RPCs that currently only check workspace membership, not role.

**Size.** M; the type and role column already exist; the work is deciding the permission matrix and wiring enforcement through existing server-action checks, not building new infrastructure.

**Owner decision needed.** Yes: what admin and member should and should not be able to do (billing, disconnect, integrations, credits) is a product decision, not an engineering one.

### 3.2 Dashboard RPCs rely on app-layer ownership checks only

**Why it matters.** Several dashboard write and list functions accept `p_clerk_user_id` but never use it to scope the rows they touch; they act on the site, domain or intent id alone. Tenant isolation for these paths therefore rests entirely on the Next.js server checks plus the fact that only the service role may call them. A future caller that skips those checks would be able to change another tenant's records.

**Evidence.** `supabase/dashboard_rpc_functions.sql`: `dashboard_update_widget_site`, `dashboard_delete_widget_site`, `dashboard_regenerate_embed_key`, `dashboard_add_domain`, `dashboard_update_domain_status`, `dashboard_remove_domain`, `dashboard_create_intent`, `dashboard_update_intent`, `dashboard_delete_intent`, `dashboard_list_domains` and `dashboard_list_intents` do not filter by `p_clerk_user_id`. The operative checks are `apps/web-next/lib/dashboard/action-authorization.ts` (`authorizeDashboardAction`) and `apps/web-next/lib/messenger/provisioning.ts` (`requireOwnedSite`), with grants locked to the service role in `supabase/widget_dashboard_grants_lockdown.sql`. By contrast `supabase/dashboard_widget_events_analytics_rpc.sql` does check workspace membership against the supplied id. Three of the functions (`dashboard_delete_widget_site`, `dashboard_regenerate_embed_key`, `dashboard_create_widget_site`) have no caller in `apps/web-next` today.

**Proposed fix.** An additive migration that makes each function verify the target site belongs to a workspace the supplied user is a member of, with identical signatures, plus confirmation that every caller passes the session-derived user id. A separate task for this was already queued on 2026-09-17.

**Size.** S to M.

**Owner decision needed.** No. This is a security correctness task and should be scheduled regardless of other priorities.

### 3.3 No Store Chat retention job

**Why it matters.** Try-on photos and results have a code-enforced retention window and an automated cleanup job. Store Chat visitor records, conversations, and messages do not; they are kept indefinitely with no deletion path. This is an open item in the unpublished privacy policy draft and blocks publishing any retention claim for chat data.

**Evidence.** `.github/workflows/` contains only `tryon-result-cleanup.yml`; no equivalent workflow exists for Store Chat data. Confirmed as open question 1 in `docs/legal/privacy-policy-draft.md`.

**Proposed fix.** Decide a retention window (see section 6), then build a scheduled cleanup job following the same pattern as `apps/web-next/app/api/internal/try-on/cleanup/route.ts` and `.github/workflows/tryon-result-cleanup.yml`, scoped to `widget_visitors`, conversations, and messages older than the window.

**Size.** M; the cleanup-job pattern already exists to copy; the new part is the query scope and making sure internal notes, audit records, and CSAT data are not silently deleted along with conversation content if those need longer retention.

**Owner decision needed.** Yes: the retention window itself is a policy decision the privacy policy draft is blocked on.

### 3.4 No merchant account deletion flow

**Why it matters.** There is no self-service "delete my account" flow. Deletion requests would have to be handled manually by email, with no defined turnaround time. This is an open question in the unpublished privacy policy draft and a gap against typical merchant expectations and regional data-rights obligations.

**Evidence.** No matches for an account-deletion route, action, or UI control anywhere in `apps/web-next/app`, `apps/web-next/lib`, or `apps/web-next/components` (searched for delete-account patterns; none found). Confirmed as open question 2 in `docs/legal/privacy-policy-draft.md`.

**Proposed fix.** Short term: a documented manual process (who handles the email, what gets deleted, what turnaround is promised) does not require code and can close the open question immediately. Longer term: a self-service flow that triggers the same shop-redact path Shopify's mandatory webhook already exercises (`apps/web-next/lib/shopify/privacy.ts`), extended to cover the merchant's own Clerk/workspace records.

**Size.** S for a documented manual process; L for a full self-service flow (touches Clerk, workspace membership, billing records that must be retained per section 7 of the terms draft, and Shopify shop-redact).

**Owner decision needed.** Yes: manual-for-now versus building self-service now is a resourcing decision, and the terms/privacy drafts are blocked on knowing which.

### 3.5 CRM pipeline, workflow history, agents catalog, and dashboard analytics are preview data

**Why it matters.** These four dashboard surfaces render fabricated or static data rather than real tenant activity. They must never be the source for a public claim, and merchants who rely on them for real decisions are working from fiction.

**Evidence.**
- CRM: `apps/web-next/lib/dashboard/lead-preview-data.ts` defines fictitious lead records and pipeline stages; `apps/web-next/app/dashboard/leads/page.tsx` redirects to `/dashboard/messenger` rather than rendering a CRM view.
- Workflows: `apps/web-next/lib/dashboard/workflow-catalog.ts` marks its own entries `'Active preview'`, `'Ready to connect'`, or `'Planned'`; no entry is live, and the "history" view echoes only the visitor's own local browser storage, not real execution history.
- Agents: `apps/web-next/lib/dashboard/agent-catalog.ts` (rendered at `apps/web-next/app/dashboard/agents/page.tsx`) is a static in-repo list with no execution engine behind it.
- Analytics: `apps/web-next/lib/dashboard/analytics-preview-data.ts` defines hardcoded trial-funnel, operations, and channel-breakdown metrics with no backing query.

**Proposed fix.** Covered in section 4 (Next); this is the "turn preview surfaces real" work, not a quick fix.

**Size.** L for all four (see section 4).

**Owner decision needed.** No immediate decision needed to keep these as preview/hidden; a decision is needed on sequencing which one gets built first (see section 4).

### 3.6 No structured intent classifier

**Why it matters.** Store Chat routes to human handoff using a keyword regex, not a structured intent-classification model. This is materially weaker than "AI understands what the shopper wants" language would imply, and undersells accuracy limits if not disclosed.

**Evidence.** `apps/web-next/lib/messenger/ai.ts`: `detectExplicitHandoffRequest()` is a keyword/regex check, not a classifier. `apps/web-next/lib/messenger/triage.ts` performs photo-attachment triage into five fixed categories via a single vision-model call, which is narrower than general intent detection.

**Proposed fix.** Not urgent to fix; it is urgent to keep public copy honest about it. If a structured classifier is wanted, it is Phase 6-adjacent work (see spec section 27 capability contract: classification is a listed capability, not yet implemented as its own path).

**Size.** M if scoped narrowly (classify into the existing routing-intent set already in `apps/web-next/lib/adapters/intents.ts`); L if it aims for general open-ended intent detection.

**Owner decision needed.** No: only a copy-accuracy issue today, not a build decision, unless the owner wants to prioritize building it.

### 3.7 No AI-draft/human-approve reply mode

**Why it matters.** Staff either write a reply from scratch or let the AI answer alone. There is no middle mode where the AI drafts and a human approves before sending. Some merchants expect this as a trust/control feature.

**Evidence.** `apps/web-next/lib/messenger/conversations.ts` guarded status transitions (`requestHandoff` / `claimAiTurn` / `assignConversation` / `takeOverConversation`) implement AI-owns-turn or human-owns-turn, with no draft-then-approve state in between.

**Proposed fix.** Add a conversation state (e.g. `ai_drafted`) that surfaces the AI's proposed reply to staff for edit/send/discard rather than sending directly, reusing the existing status-transition guard pattern.

**Size.** M; one new state in an existing state machine, plus UI to show/edit a draft before send.

**Owner decision needed.** Yes: this is a product-direction choice (trust model for AI replies), not purely technical.

### 3.8 WhatsApp/Instagram channels not built; Telegram planned

**Why it matters.** Only the storefront web chat channel is live. Presenting WhatsApp or Instagram as available, or even "coming soon," would be an unsupported claim.

**Evidence.** `apps/web-next/lib/product-truth/public-integrations.ts`: WhatsApp and Instagram are both `state: 'evidence-required'` with `evidenceRef: null` and the note "No repository evidence currently supports presenting this as ready for setup or use." Telegram is `state: 'planned'`, evidence pointing only to the internal catalogue, not code.

**Proposed fix.** No fix needed to be truthful today (the register already withholds the claim correctly). Building any of these channels is new integration work with no existing code to build on beyond the storefront widget pattern.

**Size.** L per channel (new provider integration, webhook handling, identity mapping into the existing conversation model).

**Owner decision needed.** Yes: which channel to build first is a market/demand decision, not evident from the repository.

### 3.9 No status page, no DPA, no certification

**Why it matters.** Blocks enterprise or larger-merchant sales conversations that expect these as baseline trust artifacts, and blocks the uptime/SLA language the terms of service draft explicitly avoids committing to.

**Evidence.** `apps/web-next/components/security/security-copy.ts:166-180` states all three directly: "No third-party security certification or audit report exists today," "There is no public uptime or incident status page yet," "A standard DPA for merchants is not available yet." Confirmed again in `docs/legal/terms-of-service-draft.md` section 8 (no SLA) and `docs/legal/privacy-policy-draft.md` open question 7 (DPA tied to controller/processor role decision).

**Proposed fix.** Status page: S, a static or lightweight hosted status page once there is meaningful uptime history to show. DPA: needs the controller/processor role decision (section 6) resolved first, then a lawyer-drafted template. Certification: not worth pursuing until there is enough paying-customer volume to justify the cost and process.

**Size.** S (status page) / M (DPA, mostly legal/process work, not code) / L (formal certification, largely non-engineering effort).

**Owner decision needed.** Yes: sequencing and whether DPA/status page are worth building before there is customer demand asking for them.

### 3.10 Authenticated end-to-end journeys and backup/restore evidence unverified live

**Why it matters.** Local source and tests can prove implementation properties but cannot prove that a real merchant can go through Clerk sign-in, Shopify install/claim, and a live storefront journey without breaking, or that a database restore actually works if needed.

**Evidence.** `docs/grindctrl-current-state-audit.md` lines 182-189 list both explicitly as requiring live or owner-supplied evidence. No backup/PITR or restore-test content exists anywhere in `apps/web-next/components/security/security-copy.ts` or `apps/web-next/app/security/page.tsx`; the security page is silent on backups rather than making a claim, which is consistent with "unverified," not "false."

**Proposed fix.** Run and record one full authenticated journey (Clerk sign-up, Shopify OAuth install, claim, live storefront try-on and chat) and one backup restore drill, then document the result as a dated evidence entry the same way the audit records other checkpoints.

**Size.** M for the journey walkthrough (mostly time and access, not new code); S-M for a restore drill depending on current backup tooling, which itself needs to be located and confirmed (Supabase project backup settings were not queried live for this document).

**Owner decision needed.** No decision needed to run this; needs scheduling and, for the restore drill, agreement that a drill in a non-production branch is safe to run (see the Supabase safety rule: destructive operations always need explicit approval, so any restore drill must target a branch or copy, never the production database, without that approval).

### 3.11 Try-On phase 1.5 item 4: scheduled reconciliation status

**Why it matters.** The master strategy memory note flagged this as needing a code check before being called done.

**Evidence.** `supabase/20260909_tryon_reconciliation_schedule.sql` exists and schedules `reconcile_tryon_entitlements()` daily at 03:17 UTC via `pg_cron`, with a documented rollback. The migration file is real and complete in source. Whether this migration was actually applied to the live production Supabase database (i.e., whether `pg_cron` is actually enabled and the job actually running in production) was not independently re-verified against the live database for this document and remains unverified beyond the source-level check.

**Proposed fix.** Confirm live application via `supabase migrations list` or an equivalent query against the production project, then mark this closed with that evidence.

**Size.** S; verification only, no code change expected if the migration was applied as written.

**Owner decision needed.** No.

### 3.12 Shopify privacy requests are fulfilled manually

**Why it matters.** Shopify requires shop-redact, customer-redact and customer-data requests to be completed. The automated fulfillment code exists, but production has it switched off, so each request depends on the team acting on an alert email.

**Evidence.** `apps/web-next/lib/shopify/privacy.ts` records every request and only sends a manual-handling alert unless `SHOPIFY_PRIVACY_PROCESSING_ENABLED` is exactly `true`; `supabase/20260909_shopify_privacy_requests.sql` documents the flag as default off. On 2026-09-17 the production container had the flag unset and SMTP configured, and `/security` states that fulfillment is manual today.

**Proposed fix.** Either run a documented manual procedure with a tracked deadline for every recorded request, or enable the flag after a dry run on a test store confirms the deletion and export scope is correct.

**Size.** S for the manual procedure; M for a verified switch to automation.

**Owner decision needed.** Yes: enabling automation deletes shopper data without a human in the loop.

## 4. Next: turning preview surfaces real

The spec (section 25) requires one event system across storefront, try-on, conversations, leads, workflows, orders, reporting, integrations, and billing, with a defined attribution methodology, before any outcome metric is published. None of the four preview surfaces in section 3.5 should be rebuilt before this contract exists, or each one will invent its own ad hoc event shape.

### 4.1 Event and attribution contract (prerequisite for everything else in this section)

**What exists today to build on.** `apps/web-next/lib/adapters/widgetEvents.ts` and `supabase/dashboard_widget_events_analytics_rpc.sql` already implement a real, tenant-scoped event pipeline for the widget funnel (`widget_open`, `conversation_start`, `message_sent`, `lead_captured`, `escalation_trigger`, etc.); this is the closest existing thing to the spec's event envelope and should be extended, not replaced. `apps/web-next/lib/try-on/service.ts` and related try-on code already track job-level state (started, succeeded, failed, cost-known/unknown) that could map to `tryon.*` namespace events.

**What is missing.** The full envelope fields from spec section 25.1 (product/variant ID, source, channel, flow ID, workflow ID, consent state, experiment ID) are not uniformly present across the existing widget-events and try-on tracking. No `lead.*`, `workflow.*`, `order.*`, or `billing.*` namespaces exist yet. No attribution rule (direct/assisted/influenced, time window, last-touch vs multi-touch) is defined anywhere in code or docs.

**Before publishing outcome metrics**, per spec section 25.3: define direct/assisted/influenced attribution, the time window, the touch rule, and known-vs-anonymous shopper handling, and surface the methodology in the UI wherever a metric derived from it is shown.

**Size.** L; this is a data-model and cross-cutting instrumentation project, not a page.

### 4.2 Analytics and reporting on real events

**Prerequisite.** 4.1.

**What exists today.** `apps/web-next/lib/dashboard/overview-data.ts` (`getTryOnOverview` / `computeOverview`) already computes real try-on volume, success rate, and cost from actual job data; this is real reporting, just not labeled "Analytics." `apps/web-next/lib/adapters/widgetEvents.ts` already computes a real funnel.

**What is missing.** A dashboard analytics view built on these two real sources plus the extended event contract, replacing `apps/web-next/lib/dashboard/analytics-preview-data.ts` entirely rather than layering real data next to it.

**Size.** M once 4.1 lands (the two real data sources already exist; the work is a new UI view and retiring the preview-data file).

### 4.3 CRM pipeline

**Prerequisite.** 4.1 for `lead.*` events.

**What exists today.** `apps/web-next/lib/adapters/intents.ts` (real, RPC-backed routing intents) and the existing conversation/lead linkage implied by Store Chat's order-lookup and handoff code are real primitives a CRM pipeline could sit on top of. `apps/web-next/app/dashboard/leads/actions.ts` exists but currently backs a redirect page, not a pipeline UI.

**What is missing.** A real lead-scoring rule, a real pipeline-stage data model (the preview file's `CrmPipelineStage` type is a reasonable starting shape but backed by nothing), and a decision on whether external CRM sync (HubSpot, already `setup-required` in `apps/web-next/lib/product-truth/public-integrations.ts`) is in scope for v1 or a later phase.

**Size.** L.

### 4.4 Workflow execution with retries and history

**Prerequisite.** 4.1 for `workflow.*` events; spec section 28 reliability patterns (timeout, retry, idempotency, dead-letter, human escalation) must be designed in, not retrofitted.

**What exists today.** `apps/web-next/docs/n8n-next-workflow-queue.md` documents a real workflow-queue pattern already used for n8n integration; this is the closest existing execution primitive and should be the base rather than inventing a second execution model. `apps/web-next/lib/dashboard/workflow-catalog.ts` defines the intended catalogue shape (ids, statuses) even though no entry currently executes.

**What is missing.** An actual execution engine with retry/backoff, a dead-letter path, and durable history storage (the current "history" view only reads the visitor's own localStorage, see `apps/web-next/components/dashboard/workflow-preview-history.tsx`, which reads `window.localStorage`; there is no server-side execution record at all today).

**Size.** L.

### 4.5 Channel integrations (WhatsApp, Instagram, Telegram)

**Prerequisite.** None technical, but see section 3.8; needs an owner decision on which channel first.

**What exists today.** The Shopify storefront webhook/App Proxy pattern (`apps/grindctrl-tryon`) and the conversation model in `apps/web-next/lib/messenger/conversations.ts` are the identity- and message-handling patterns a new channel would extend, not duplicate.

**What is missing.** Provider-specific auth/webhook handling and an identity-mapping layer from each channel's user identity into the existing conversation/visitor model.

**Size.** L per channel.

## 5. Later: Phase 6 product expansion

The spec (section 40, Phase 6) lists these as roadmap items, explicitly not immediate marketing claims (spec line: "These are product roadmap items, not immediate marketing claims").

### 5.1 Size intelligence

**Data needed.** Shopper body/fit signals (self-reported measurements or inferred from try-on photos) and a per-product size chart, neither of which the product collects or stores today.

**What exists to build on.** The try-on pipeline (`apps/web-next/lib/try-on/image-runner.ts`, `apps/web-next/lib/try-on/service.ts`) already processes a shopper photo per session, but explicitly does not persist it (`apps/web-next/lib/try-on/persistence.ts` only ever writes the generated result, never the source photo); size intelligence that needs to reason across sessions would require deliberately deciding to retain photo-derived data, which the product currently and intentionally does not do.

**Privacy/consent implications.** This is the single highest-sensitivity item in Phase 6. It would reverse the current "photo not stored" privacy posture that is publicly stated (`docs/legal/privacy-policy-draft.md` section 7, `apps/web-next/components/security/security-copy.ts`). Needs explicit new consent language, a new retention policy, and likely a legal review beyond the current draft's scope before any code is written, not after.

**Must be true before marketing.** A defined consent flow, a defined retention/deletion policy for whatever body-derived data is kept, and a measured accuracy claim; not a vendor-model claim repeated as GrindCTRL's own accuracy.

### 5.2 Saved shopper looks

**Data needed.** A durable per-shopper (not per-session) identity and a store of past try-on results tied to it.

**What exists to build on.** `apps/web-next/lib/try-on/persistence.ts` already has a result-storage pattern (Supabase Storage + signed URLs); saved looks would extend retention for opted-in shoppers rather than building new storage infrastructure. The 30-minute auto-delete behavior would need to become conditional on explicit shopper opt-in to save.

**Privacy/consent implications.** Requires shopper-account-level consent (today there is no shopper account concept at all outside Shopify customer identity used for order lookup) and a defined retention/deletion path per saved look.

**Must be true before marketing.** A real opt-in flow and a working deletion path, not just a "coming soon" save button.

### 5.3 Complete-look styling

**Data needed.** A product-relationship graph (which items pair with which) and either merchant-curated pairings or a recommendation model.

**What exists to build on.** Nothing specific in the current try-on or catalog code; this is closer to a new capability than an extension. `apps/web-next/lib/try-on/entitlement.ts` and the plan/credit system would need to define how a multi-item styling session consumes credits differently from a single try-on.

**Privacy/consent implications.** Low incremental risk beyond existing try-on photo handling, provided it reuses the same non-persistent photo pattern.

**Must be true before marketing.** Real merchant catalog coverage (a styling feature with thin catalog data reads as broken, not as a feature) and a credit-cost model merchants understand.

### 5.4 Personalized product recommendations

**Data needed.** Cross-session shopper behavior signals, which requires the event/attribution contract from section 4.1 to exist first; recommendations built on an undefined event model would have no reliable signal to learn from.

**What exists to build on.** `apps/web-next/lib/adapters/widgetEvents.ts` is the closest existing behavioral signal source, but it is currently funnel-shaped (aggregate counts), not per-shopper session history suitable for personalization.

**Privacy/consent implications.** Requires the same anonymous-session-to-identified-customer linkage rules the spec's event principles call for (section 25.1), and a decision on whether recommendation personalization is in scope for anonymous (non-consented) shoppers at all.

**Must be true before marketing.** The attribution/event contract in place, plus a defined boundary on what "personalized" means without needing PII beyond what is already lawfully collected.

### 5.5 Intent-based remarketing

**Data needed.** The identified-customer linkage and consent state from the event contract, plus a lawful basis and channel to remarket through (email is the only channel with any code today, and even that is currently off in production; see `TRYON_EMAIL_LIVE_SEND_ENABLED` gating `apps/web-next/app/api/campaigns/tryon-email/send/route.ts`).

**What exists to build on.** `apps/web-next/app/api/campaigns/tryon-email/send/route.ts` is a real but currently-disabled send path, gated by an environment flag that is unset in production per verified production facts. This is meaningfully further along than most Phase 6 items; the gap is enabling and trusting it, not building it from scratch.

**Privacy/consent implications.** Remarketing based on try-on or chat behavior is exactly the kind of processing the unpublished privacy policy's legal-basis open question (open question 5) has not resolved. Should not be enabled in production before that is resolved.

**Must be true before marketing.** The email send path enabled with monitoring, a defined consent/opt-out mechanism, and the legal-basis question resolved.

### 5.6 Deeper attribution

**Data needed.** The full event contract from section 4.1, extended to `order.*` events with real order-value data from Shopify, not just conversation/lead events.

**What exists to build on.** Order lookup already exists and is real (`apps/web-next/lib/messenger/orders.ts`), but it is read-only lookup for shopper-facing chat, not an attribution pipeline; the Shopify Admin API access it uses could be extended to pull order value for attribution, but that is new work, not a repurposing of existing code.

**Privacy/consent implications.** Attribution that ties a specific shopper's chat/try-on session to a specific order value raises the same identified-customer linkage question as 5.4.

**Must be true before marketing.** Section 4.1's methodology disclosure requirement (spec 25.3: "surface methodology in the UI"); deeper attribution makes this more important, not less, since a wrong or opaque attribution rule looks like inflated results.

### 5.7 Cross-store analytics

**Data needed.** Aggregation across tenant boundaries, which directly conflicts with the multi-tenant isolation requirement in spec section 26 ("no tenant data should leak into ... analytics exports") unless deliberately designed as an opt-in, anonymized benchmark product.

**What exists to build on.** Nothing: every existing analytics and reporting path (`apps/web-next/lib/adapters/widgetEvents.ts`, `apps/web-next/lib/dashboard/overview-data.ts`) is explicitly tenant-scoped by design, which is correct and should not be casually loosened.

**Privacy/consent implications.** Highest-risk item in this list for tenant trust. Any cross-store aggregation needs an explicit merchant opt-in, anonymization or aggregation thresholds that prevent re-identifying a single merchant's numbers, and a clear boundary the multi-tenant isolation rule (section 26) is never silently violated for an internal benchmark feature.

**Must be true before marketing.** Explicit per-merchant opt-in, a documented anonymization method, and confirmation from a security review that no single-tenant data is derivable from the aggregate.

## 6. Decisions needed from the owner

1. Workspace role permissions: what should admin and member roles be able to do versus owner (section 3.1).
2. Store Chat data retention window, to unblock building the missing cleanup job and finalizing the privacy policy (section 3.3; privacy policy draft open question 1).
3. Merchant account deletion: manual-by-email process now (with what turnaround time) versus building self-service deletion (section 3.4; privacy policy draft open question 2).
4. AI-draft/human-approve reply mode: whether to build it and what the trust model should be (section 3.7).
5. Which channel to build next: WhatsApp, Instagram, or keep Telegram as the next planned target (section 3.8).
6. Governing law and dispute forum for the Terms of Service and Privacy Policy: confirm Egypt, or add EU/US carve-outs (terms draft open question 3; privacy draft open question 3).
7. International data transfers: whether to invest in mapping sub-processor (OpenRouter, Groq, Supabase, Clerk, Upstash, Sentry, PostHog) server locations and transfer mechanisms now, or defer until a merchant/shopper in a jurisdiction that requires it (privacy draft open question 4).
8. Legal basis for shopper data processing if GrindCTRL knowingly serves EU or other regulated shoppers, since the product does not currently check shopper location (privacy draft open question 5).
9. Children's use: minimum age policy and whether an age gate or a "not directed at children" statement is sufficient (privacy draft open question 6; terms draft open question 5).
10. Merchant data controller/processor role split: confirm the drafted position (processor for shopper data, controller for merchant account data), since it determines whether a formal DPA is owed to merchants (privacy draft open question 7; ties to section 3.9).
11. Whether to independently review OpenRouter's and Groq's data retention and training-use terms before making any claim about what happens to shopper photos or chat content after it leaves GrindCTRL's servers (privacy draft open question 8).
12. Whether to add a cookie consent banner beyond the existing analytics opt-in control (privacy draft open question 10).
13. Refund policy for paid plans/packs beyond the existing automatic failed-generation credit refund, and how a merchant requests one (terms draft open question 1).
14. Liability cap for the Terms of Service (terms draft open question 2).
15. Minimum age or business-registration requirement to sign up, not currently enforced in the product (terms draft open question 4).
16. Whether "Done-for-you" plan scope should be formalized as a separately scoped statement of work in the Terms, or stay general as currently drafted (terms draft open question 7).
17. Whether to approve the three commercial statements currently hidden on the pricing page pending approval: same-day activation after manual payment (and accepted payment methods), a fixed 365-day top-up credit validity (actual value is per-pack configured today), and month-to-month terms with no contract (terms draft open question 9).
18. Sequencing for section 4 (analytics, CRM, workflows, channels): which preview surface becomes real first, since the event/attribution contract in section 4.1 is a shared prerequisite and only has capacity to be built once before the others branch off it.
19. Whether to schedule a live authenticated end-to-end journey check and a backup/restore drill, and if so, whether the restore drill runs against a Supabase branch/copy rather than production (section 3.10).
20. Whether to keep fulfilling Shopify privacy requests manually or enable automated fulfillment after a test-store dry run (section 3.12).

## 7. Rules that carry forward

- **Truth register gating.** No public page, metric, or integration claim ships without a matching entry in the product-truth register (`apps/web-next/lib/product-truth/`) and a real evidence path. This is how the fabricated homepage numbers found in the Phase 0 audit got removed and must not silently reappear.
- **No fabricated proof.** No invented testimonials, logos, metrics, customer names, or benchmark numbers, ever, including as placeholder or example content in production-facing surfaces.
- **Consent-first analytics.** No analytics event or cookie fires before explicit visitor opt-in. Error monitoring (Sentry) is the only telemetry that runs unconditionally, and it strips auth tokens from URLs first.
- **EN/AR parity.** Every public and dashboard surface ships with both locales and correct RTL behavior; a surface without Arabic support is not done.
- **Mobile parity.** Mobile must retain the same core capability as desktop; responsive work adapts presentation, it does not remove functionality.
- **Workflow agents on Sonnet.** Any workflow-orchestration `agent()` call uses `model: 'sonnet'`, never Opus.
- **GitHub account.** This repository uses the `mhhmod` GitHub account only; never `digitivia1-spec`.
