# GrindCTRL current-state and product-truth audit

Date: 2026-09-13  
Repository baseline: `3e284fa` plus the existing dirty worktree  
Strategy input: `C:\Users\HP\Downloads\GrindCTRL_Master_Product_Strategy_and_Implementation_Spec.md`  
Status: Phase 0 audit; no product behavior, production configuration, or external state changed

## Executive verdict

GrindCTRL already contains substantial implementations for Shopify storefront try-on, storefront chat, merchant configuration, Clerk/workspace/shop identity, tenant-scoped data access, entitlements, provider execution, operational safeguards, and EN/AR interfaces.

It does **not yet establish the master strategy's complete connected AI commerce platform as production truth**. The most important gaps are:

1. the public story remains substantially try-on-led rather than showing one connected journey;
2. the repository has no structured, evidence-backed public claim register;
3. leads, CRM, workflows, analytics, and managed-service delivery contain preview, local-only, document-only, or incomplete paths;
4. strategy-level journey attribution is not implemented as one verified event model;
5. several production conclusions still require authenticated accounts, live operations evidence, bounded provider testing, or operator deployment authority.

The release stance therefore remains evidence-gated. Local source and tests can prove implementation properties, but cannot prove deployed identity, customer outcomes, provider quality, commercial approval, or production operation.

## Baseline and evidence hierarchy

Use evidence in this order:

1. current source and tests;
2. dated repository checkpoints and audit documents;
3. current CI or live read-only evidence explicitly recorded in those documents;
4. live authenticated verification;
5. product-owner approval for commercial claims and operational policy.

The April widget setup plan is historical architecture context. The current implementation includes a separate Next.js application and is materially beyond that plan. The active production history is better represented by:

- `docs/superpowers/checkpoints/2026-09-05-production-risk-closure.md`
- `docs/superpowers/checkpoints/2026-09-09-gate-closure-queue.md`
- `docs/superpowers/specs/2026-09-07-unified-pricing-audit.md`

## Surface and architecture inventory

| Surface | Current repository truth | Qualification |
| --- | --- | --- |
| Legacy public/static surface | Vite application under `src/`, built to `dist`; separate GitHub Pages workflow | Still present; do not assume it shares the Next application's runtime or design system |
| Current application | Next 15 / React 19 under `apps/web-next`, with server components/actions, API routes, Clerk and Supabase | Primary application surface |
| Public routes | Landing, pricing, try-on, assistant, authentication, onboarding and claim routes | The strategy's full platform/product/security route map does not exist yet |
| Merchant dashboard | Overview, try-on, Store Chat/messenger, inbox, sites, install, branding, domains, routing/intents, agents, integrations, workflows, CRM, analytics and implementation request | Route presence does not prove production completeness |
| Shopify | Embedded app, OAuth/session/claim flows, app proxy, webhook receiver, try-on and messenger theme blocks | Live installation and customer journeys still need authenticated evidence |
| Storefront experiences | Try-on and messenger embeds plus versioned widget runtime | Multiple generations exist; a support/version matrix is needed |
| Design systems | Next shadcn/Radix/Tailwind-variable components; legacy CSS/Shoelace system | Changes must respect the boundary instead of forcing one system across both |
| Localization | EN/AR locale handling, RTL patterns and narrow-header work exist | Some dashboard/settings and empty-state copy remains incomplete or English-led |
| Data layer | Supabase migrations, RPC adapters, service-role server paths, RLS and ownership checks | Applied live schema and grants must be verified separately when not already recorded |
| Delivery | Static GitHub Pages workflow plus Next container/CI/deployment workflows | Staged, CI-verified and deployed states must remain distinct |

## Strategy-to-current-state matrix

| Strategy area | Verified in current source | Partial, preview, mock or document-only | Missing or live-unknown |
| --- | --- | --- | --- |
| Platform positioning | Managed AI language appears in landing copy | Hero and strongest visual remain try-on-led; operations appear later | One connected platform-first journey above/near the fold |
| AI shopping / try-on | Upload, validation, generation, result, error, retry, credit and cart-return paths | Mock mode exists and must remain visibly distinguished | Live category quality, latency, capacity, theme compatibility and provider economics |
| Customer conversations | Persisted storefront conversations/messages, AI replies, handoff, knowledge, canned replies and guarded order lookup | Storefront messenger is not proof of every publicly shown social channel | Authenticated cross-channel operation and verified customer outcomes |
| Leads and CRM | Lead adapters and conversation-linked records exist | CRM pipeline contains preview data; `/dashboard/leads` redirects to messenger | Verified scoring, external CRM synchronization, ownership lifecycle and attribution |
| Commerce operations | Routing/intents, order-related actions and audit events exist | Workflow catalogue/history includes preview or specification-led behavior | Durable generalized execution, retries/dead letters, approvals and verified external workflows |
| Reporting and control | Tenant-filtered try-on usage/cost data and widget event/funnel adapters exist | Dashboard analytics currently presents preview metrics | Connected journey funnel, order/revenue attribution and disclosed methodology |
| Integrations | Concrete Shopify, Supabase, Redis and provider code exists | Integration catalogue includes different readiness states; public logos do not fully communicate depth | Per-tenant connection health, granted scopes and production evidence |
| Managed implementation | Booking and implementation-request UI exists; operator-only entitlement actions exist | Request form success is currently local UI state rather than durable intake | Assignment, payment verification, delivery workflow, ownership and runbooks |
| Billing and entitlements | Plan/pack catalogue, credits, manual activation/renewal/top-up and reconciliation exist | Public catalogue can fall back to hardcoded offers | Ongoing commercial approval and proof that displayed terms equal active operations |
| Evidence/truth layer | Testimonials are disabled pending approval; some disclaimers exist | Claims and metrics are hardcoded across components | Typed claim status, evidence reference, approval, last-verified date and public flag |
| Public information architecture | Landing, pricing and try-on pages exist | Much of the wider product story is inside the landing page | Meaningful platform, conversations, leads, operations, analytics, integrations, customer and trust pages |

## Public-claim register: immediate risks

These are **unverified claims**, not findings that the values are fabricated.

| Claim area | Current evidence problem | Required action before amplification |
| --- | --- | --- |
| Operational counters | `automations-showcase.tsx` contains 12,842 messages, 342 leads, 28 automations and 1.42-second response time without an attached dataset, measurement window or approval record | Attach evidence and approval or qualify/remove |
| Weekly operation claims | Landing copy includes 1,284 runs and 92% unattended without a traceable public evidence object | Add source, period, definition and approval |
| Try-on timing | “About 9 seconds” is not established here as a current GrindCTRL production percentile | Measure current provider/runtime performance and state methodology |
| Omnichannel/integration wording | Logos and names do not always distinguish native, API, automation-layer, custom, internal or planned states | Add integration-depth data and render it honestly |
| Pricing fallback | Missing, empty or failed catalogue reads may return fallback offers | Make provenance and operational availability explicit; keep owner approval |
| Revenue/outcomes | The strategy proposes attribution, conversion and ROI reporting that current analytics do not prove | Define direct/assisted/influenced rules before publishing outcomes |

Positive patterns to preserve:

- testimonials remain disabled without approved evidence;
- mock/render examples carry disclosure;
- provider cost can remain explicitly unknown rather than being invented;
- commercial claims remain constrained by the current gate documentation.

## Identity, tenancy and authorization

The intended canonical chain is:

`Clerk user -> profile/workspace membership -> widget site -> normalized Shopify shop -> storefront/customer records`

Current source implements important pieces of this chain through server-side authorization helpers, shop ownership checks, composite workspace/site/shop relationships, service-role adapters and RLS/grant migrations.

Remaining proof requirements:

- same-account behavior across Clerk dashboard, Shopify embedded app and storefront;
- rejection of an unrelated account at every mutation entry point;
- live applied RLS, grants and migration identity for the deployed Supabase project;
- install, claim/link, disconnect and reinstall behavior;
- authorized support/operator access boundaries;
- no tenant data in another tenant's AI context, logs, exports or analytics.

Service-role calls remain a critical boundary: browser identity must never be accepted merely because a caller supplies a Clerk user ID. Each mutation must authenticate the session and independently prove ownership before privileged data access.

## Security, privacy and reliability

### Verified or implemented in source

- strict rate-limit helpers deny expensive work when Redis enforcement is missing or malformed;
- shop/customer session tokens are bound to their intended shop/context;
- operator-only credit mutations fail closed;
- try-on inputs, provider reads and outputs are bounded and validated;
- unknown provider spend remains unknown;
- Shopify privacy topics, durable request recording and guarded processing now exist;
- API version pins are aligned to stable `2026-07`;
- shop-scoped entitlement reconciliation and a daily reconciliation schedule are documented as applied;
- current CI has exercised clean install, tests, typecheck, lint, container build/scan/start and release-SHA health checks on the recorded candidate.

### Remaining or incomplete

- privacy requests that fail or stop after durable receipt need a verified retry/manual-reconciliation operating process;
- shopper-photo messaging does not yet establish every provider-retention, model-training, backup and deletion-request fact required by the strategy;
- the cleanup API treats rejected cleanup operations as failures but does not elevate fulfilled cleanup results whose returned `failed` count is nonzero;
- analytics initialization shows URL scrubbing, but a complete consent gate and strategy-level safe event envelope were not established by this audit;
- external workflow alert delivery and operational ownership remain live concerns;
- provider timeout does not prove cancellation or absence of billing;
- VPS image selection, reverse-proxy trust and exact rollback execution need production-side evidence.

### Post-implementation addendum — 2026-09-13

The two findings recorded at lines 126–127 above are preserved as the historical audit snapshot. Subsequent local implementation and tests now verify that fulfilled cleanup summaries with a nonzero `failed` count propagate as a failed cleanup run, and that analytics capture is explicit-consent-only with a typed, allowlisted, sensitive-data-rejecting event envelope. This is local source/test evidence, not proof of deployed behavior, lawful production configuration or operating-process closure.

## Analytics gap

The strategy calls for a single event system spanning storefront, try-on, conversations, leads, workflows, orders, reporting, integrations and billing. Current source has meaningful event and usage foundations, but not a verified end-to-end customer-journey model.

Before outcome claims, define and test an envelope containing, where lawful and relevant:

- tenant/site/shop;
- anonymous session and identified customer linkage;
- product and variant;
- source/channel;
- flow/workflow;
- result, duration and error code;
- consent state;
- experiment identifier;
- attribution method and time window.

No shopper-photo data or capability-bearing private URL should enter analytics payloads.

## UX, mobile, Arabic and accessibility

The repository contains strong foundations: logical CSS, locale-aware components, RTL sheet behavior, reduced-motion handling, responsive containers and the protected mobile sign-in allocation.

Phase 1 must still verify rather than assume:

- 320, 343, 375, 390, 430, tablet and desktop widths;
- EN/AR and light/dark combinations;
- upload, progress, cancellation, failure, retry and return-to-cart behavior;
- connected-journey interaction on touch and keyboard;
- focus restoration and screen-reader status announcements;
- mixed Arabic/English strings, prices, phone numbers and directional icons;
- real storefront performance and layout stability.

Do not replace the verified mobile header arrangement without equivalent browser evidence.

## Delivery and production evidence

Latest repository documentation records:

- 1,402 tests / 212 files passed on the dated gate-closure tree;
- clean typecheck, lint and Next build on that tree;
- a successful clean CI/container/security/startup gate for the recorded candidate;
- Shopify privacy, stable API version and entitlement reconciliation work closed or materially advanced;
- the chosen launch model: Free self-serve; paid tiers through the current manual concierge activation flow.

These are historical evidence entries, not a fresh test run on the current dirty worktree. This audit did not run the full suite or claim that current HEAD is deployed.

Still requiring live or owner-supplied evidence:

1. authenticated Clerk and Shopify journeys;
2. backup/PITR status, restore test and operational ownership;
3. bounded provider quality, latency, failure, retention and cost benchmarks;
4. external CRM/social/n8n workflow operation;
5. current production SHA/image, proxy settings and executable rollback procedure;
6. continuing approval for prices, entitlements, claims and service boundaries.

## P0 status

| P0 requirement | Status |
| --- | --- |
| Platform-first positioning | Gap |
| Connected customer journey hero | Gap |
| Preserve try-on proof | Implemented foundation; needs live quality evidence |
| Product pillars | Partial in copy; not yet one coherent public architecture |
| Evidence/truth layer | Gap |
| CTA hierarchy | Present; needs full journey verification |
| Mobile | Strong partial evidence; new work must be re-tested |
| Arabic/RTL | Strong partial implementation; incomplete surface coverage |
| Privacy near photo upload | Partial |
| Performance | CI/build evidence exists; real user/storefront measurement still needed |
| No fabricated proof | Policy exists; several numerical claims lack traceable evidence |

## Ordered next actions

1. **Create the claim and capability register.** Inventory every public metric, integration, testimonial, screenshot, category, timing, pricing and security statement with status and evidence.
2. **Decide immediate claim treatment.** Attach evidence, qualify, hide or remove the currently untraceable numerical claims before reusing them in a redesigned experience.
3. **Produce the public-site information architecture.** Map existing routes/components to the strategy without creating empty SEO pages.
4. **Specify the connected-journey hero.** Use real or explicitly illustrative data, mobile-first behavior, RTL, keyboard operation and reduced-motion fallback.
5. **Define the event and attribution contract.** Do this before building reporting or ROI claims.
6. **Close bounded operational defects.** Address cleanup failure counts and privacy retry/reconciliation ownership without broad rewrites.
7. **Implement Phase 1 through reusable shadcn-first components.** Preserve the sign-in regression guard and working try-on/store-chat flows.
8. **Run proportional verification.** Focused tests during implementation, then typecheck, lint, tests, build, responsive/RTL browser checks and claim review.
9. **Keep deployment gated.** Do not merge/deploy or perform paid benchmarks without the corresponding approval and live prerequisites.

## Phase 0 conclusion

The master strategy is directionally compatible with the repository, but it is not a description of a fully delivered product. GrindCTRL already has enough real infrastructure to support a credible connected-platform story. The next safe step is not a visual rewrite: it is an evidence-backed claim/capability register followed by information architecture and a truthful connected-journey specification.

This audit created documentation only. It did not change product behavior, production data, settings, credentials, billing, external systems or deployment state.
