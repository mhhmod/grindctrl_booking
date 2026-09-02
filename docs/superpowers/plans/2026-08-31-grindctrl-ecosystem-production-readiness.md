# GRINDCTRL Ecosystem Production-Readiness Execution Plan

> **For implementation agents:** Execute this plan phase by phase. Do not skip gates, combine database phases, or call a deployment successful from health checks alone. Update the progress table and attach evidence before advancing.

**Goal:** Ship one coherent GRINDCTRL SaaS and Shopify app in which a merchant's Clerk account, Shopify store, Try-On settings and entitlement, Store Chat settings, and storefront widget all resolve to the same tenant; failures are explicit; privacy obligations are durable; and release readiness is proven by automated and recorded human browser verification.

**Current checkpoint:** `bda59f2` on `main`, synchronized with `origin/main` at planning time.

**Current release status:** **Not ready for merchant launch.** The tenancy fixes in `687424a` and owner-email claim gate in `bda59f2` close the original audit's `AUTH-01` and `AUTH-02` reproductions for Store Chat, but two newly verified blockers and the privacy blocker remain.

**Primary sources:**

- `docs/superpowers/specs/2026-08-31-production-readiness-audit.md`
- `docs/superpowers/specs/2026-08-30-shopify-unified-app-design.md`
- `docs/superpowers/plans/2026-08-30-shop-tenancy.md`
- `docs/superpowers/plans/2026-08-30-shop-embedded-store-chat.md`
- `specs/001-widget-setup-flow/plan.md` (legacy setup context only; it is not the active workstream)
- [Shopify privacy-law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Shopify webhook verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries)
- [Shopify API versioning](https://shopify.dev/docs/api/usage/versioning)
- [Shopify protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
- [Shopify `Shop.email`](https://shopify.dev/docs/api/admin-graphql/latest/objects/shop)

---

## 1. Non-negotiable architecture invariants

1. **Clerk profile/workspace is the account authority.** A Shopify session proves control of a shop surface; it does not become a second user account system.
2. **Canonical, normalized `shop_domain` is the Shopify tenant key.** Client-supplied `shop`, `siteId`, workspace, email, or plan values never establish authority.
3. **`shopify_shops` is the target shop registry, after live inspection.** It links a shop to one account workspace and one Store Chat `widget_sites` row. `tryon_shops` remains a temporary lifecycle compatibility table during migration; `tryon_shops.owner_clerk_user_id` must not remain the long-term ownership authority.
4. **One product, one record per setting domain.** Try-On settings remain in `tryon_settings[shop_domain]`. Store Chat draft/published settings remain on the registry-linked `widget_sites` row. Dashboard and embedded Shopify are two authenticated views over those same records.
5. **Storefront billing is server-derived.** A public Try-On request can debit only the shop proven by a Shopify-signed storefront context and a server-signed session. Body/query `shop` is display input at most.
6. **Merchant identities cannot mutate global defaults.** The `tryon_settings.shop = 'default'` row is internal configuration. Until an explicit internal-admin authorization exists, it is immutable from merchant UI, server actions, and embedded routes.
7. **Mutations are atomic and truthful.** Multi-section Save, claim/link, publish, entitlement debit/finalize/refund, privacy actions, and lifecycle changes either commit as a whole or return a typed failure. Logging an error and returning success is forbidden.
8. **Service-role access makes route scoping the security boundary.** Every service-role query must derive and include tenant scope; RLS is defense in depth, not an excuse to omit application authorization.
9. **Privacy work is durable and idempotent.** Webhook acknowledgement follows validated durable enqueue, not in-process best effort. Customer/shop export or erasure has auditable completion state and includes database rows and private storage objects.
10. **No destructive database action before evidence.** No delete, merge, constraint replacement, ownership transfer, redaction rehearsal, or backfill may run against a live project until the project is positively identified, read-only schema/collision evidence is captured, and a restorable backup/snapshot is recorded.
11. **Expand, compare, switch, then contract.** Keep legacy reads/writes available through the shadow period. No legacy table/column/constraint removal belongs to this plan.
12. **Mobile and Arabic are release surfaces.** Verification starts at 320/360/390/430px in English and Arabic. Desktop-only success does not pass a UI gate.

---

## 2. Verified baseline and outstanding severity

### What is already complete

- `af31cd3`: Store Chat theme-block config no longer fails unconditionally with `400 bad_key`; Installation's previously reported overflow is contained.
- `687424a`: dashboard-first and embedded-first Store Chat resolution is domain-first; safe empty domain-less orphans are reconciled, while non-empty/history-bearing rows are retained for review.
- `bda59f2`: the claim path is reachable from the embedded app and redemption compares the signed-in Clerk email with Shopify's documented shop-owner `Shop.email`.
- Last recorded full baseline before this plan: 161 test files / 832 tests passing, TypeScript clean, and production build successful. Treat this as historical evidence and rerun it after every phase that changes code.
- The last recorded VPS and GitHub Pages deployments were green, and the live storefront-config smoke returned the intended `403 origin_not_allowed` instead of the former unconditional `400 bad_key`. This proves that checkpoint's deployment, not the readiness of the open phases below.
- Post-audit characterization: 8 focused test files / 72 tests passed. It confirmed the remaining registry, billing, default-settings, atomicity, privacy, and truthfulness gaps; it made no edits.

### Current blockers

| ID | Blocker | Evidence | Required release condition |
|---|---|---|---|
| `TRYON-AUTH-01` | Public Try-On accepts a client-selected `shop` and debits that shop's entitlement. | `app/api/try-on/session/route.ts`, `app/api/try-on/generate/route.ts`, `lib/try-on/service.ts:90-110` | A Shopify-signed storefront assertion and server-signed session derive the billable shop; spoofed/absent/expired proof cannot debit or run a paid generation. |
| `TRYON-AUTH-02` | Any authenticated merchant can select `default` and mutate global Try-On defaults. | `lib/shopify/shops.ts:110-123`, `app/dashboard/try-on/actions.ts:7-20`, `lib/try-on/settings.ts:154-205`, `components/dashboard/tryon-settings-panel.tsx` | Merchant paths reject `default`; global-default controls are absent; negative tests cover users with and without linked shops. |
| `SHOP-01` | Mandatory `customers/data_request`, `customers/redact`, and `shop/redact` webhooks are not registered or implemented. | `apps/grindctrl-tryon/shopify.app.toml`, `app/api/shopify/webhooks/route.ts` | TOML registration, raw-body HMAC verification, durable idempotent queue, export/redaction workers, storage cleanup, tests, deployed app version, and Partner Dashboard delivery evidence all pass. |

### Confirmed high-severity work still open

- `PR-01`: the mobile Store Chat preview is wider than a 320px dashboard column (`preview-frame.tsx`).
- `AUTH-03`: a changed Clerk primary email is not reliably synchronized to `profiles`, risking notifications to a stale address (`provisioning.ts`, `notify.ts`).
- `DATA-01`: Support Desk Save races four whole-draft replacements (`support-desk-settings.tsx`, `actions-core.ts`).
- `DATA-02`: knowledge metadata, re-sync, status, and delete operations discard Supabase errors (`knowledge.ts`).
- `INSTALL-01`: Store Chat "Live" is inferred from Try-On lifecycle activity instead of a recent site-scoped `config_served` heartbeat.
- `INSTALL-02`: Store Chat installation uses a generic theme URL and the wrong visible block name instead of the direct app-embed activation flow.
- `SEC-01`: knowledge URL import checks hostname strings but not resolved A/AAAA addresses, leaving DNS rebinding/private-target SSRF possible.
- `RLS-01`: runtime depends on an unreproducible `tryon_shops` schema while checked-in SQL defines the different `shopify_shops` registry.
- `SHOP-02`: Admin GraphQL/webhooks are pinned to release-candidate `2026-10`; `2026-07` is the latest stable version on the plan date.
- `SHOP-05`: Partner Dashboard protected-customer-data approval for `read_orders`, email, and shipping location is an unverified external launch gate.
- `ERR-01`: per-panel failures are rendered as valid empty/not-live states in dashboard and embedded Store Chat.

### Additional confirmed gaps that must be closed in their owning phase

- Claim redemption links Store Chat but does not durably bind Try-On ownership.
- `shopify_shops_site_workspace_fkey` is non-deferrable; two TypeScript updates cannot honestly be called an atomic workspace/site transfer.
- Shopify storefront origin patterns are not provisioned as part of store link/claim.
- Verified Shopify customer ID is minted into the shopper token but discarded instead of persisted on `widget_visitors`.
- Leads and private attachment objects are not covered by a complete customer/shop redaction path.
- Try-On save failures are logged but not returned truthfully to the merchant.
- Conversation composite operations and discard-draft behavior can drift between dashboard and embedded surfaces.
- Remaining medium/low audit items (`PR-02`–`PR-04`, `I18N-01`–`I18N-02`, `AUTH-04`, `DATA-03`–`DATA-04`, `RLS-02`–`RLS-04`, `SHOP-03`–`SHOP-04`, `ERR-02`–`ERR-04`) are launch-scope and mapped below.

---

## 3. Allowed APIs and anti-pattern guardrail

### Allowed, evidenced interfaces

- Shopify mandatory subscriptions use one `[[webhooks.subscriptions]]` entry with `compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]` in `shopify.app.toml`.
- HTTPS webhooks are verified against the **raw request body** using `X-Shopify-Hmac-SHA256`; `X-Shopify-Webhook-Id` is the idempotency key; invalid HMAC returns `401`.
- Webhook endpoints respond inside Shopify's five-second window only after durable acceptance. Work can complete asynchronously within Shopify's stated compliance window.
- Shopify App Proxy signatures are verified by the existing `verifyShopifyProxySignature` pattern in `lib/messenger/identity.ts`; extend this pattern for Try-On storefront context rather than trusting Liquid-derived query values after they reach the browser.
- Shopify owner-email verification uses Admin GraphQL `shop { email }`, already encapsulated by `lib/shopify/shop-owner.ts`.
- Shopify Admin GraphQL and webhook payloads use stable `2026-07` until a later stable-version upgrade is independently tested.
- Supabase service-role calls remain server-only. Multi-row ownership/settings/privacy changes use reviewed Postgres functions invoked via `.rpc(...)`, with tenant keys, row locks, idempotency keys, and typed return values.
- Existing shared UI primitives under `apps/web-next/components/ui` and the existing Store Chat editors/tabs are the first-line frontend building blocks.

### Forbidden patterns

- Do not infer tenant ownership from body/query `shop`, `siteId`, email, Referer, Origin, or a merchant-visible embed key.
- Do not perform a two-row ownership transfer as independent PostgREST updates.
- Do not delete or merge collision rows automatically; generate a reconciliation report and require a human decision for non-empty or ambiguous rows.
- Do not mutate `tryon_settings.default` from any merchant action merely because the user is authenticated.
- Do not return `{ok:true}`, `Saved`, empty data, or `Live` after a rejected/unknown persistence or detection operation.
- Do not run privacy erasure after the HTTP response without a durable queue.
- Do not redact database rows while leaving the corresponding object in `storage.objects`.
- Do not deploy TOML changes without `shopify app deploy` and verification in the Dev Dashboard; a CLI trigger alone does not prove subscription deployment.
- Do not request `read_products` without a concrete Admin API use that survives least-scope review.
- Do not switch registry reads until shadow comparison is clean and rollback remains available.

---

## 4. Progress and checkpoints

| Phase | Status at plan creation | Checkpoint/evidence required to mark complete |
|---|---|---|
| Baseline fixes through `bda59f2` | Complete | Commits present; prior tests/build/deploy recorded green. |
| 0. Production identity and read-only reconciliation | Not started; blocked on Supabase/hosting access | Confirmed project ref, schema/RLS/advisor export, collision report, restorable backup identifier. |
| 1. Local security and truthfulness fixes | Not started | Focused security/error tests plus full test/typecheck/build green. |
| 2. Expand-only ownership registry and atomic claim/link | Not started; Phase 0 gate required | Migration reviewed/applied, dual-write tests green, atomic claim binds Store Chat + Try-On, no collision loss. |
| 3. Atomic settings and shared mutations | Not started | Concurrency tests prove no lost writes; all mutation failures are visible. |
| 4. Privacy/webhooks and Shopify compliance | Not started; legal/Partner access gates remain | Three topics deployed, durable jobs complete, export/redaction/storage tests and Partner delivery evidence pass. |
| 5. Installation, UI/UX, RTL, error states, observability | Not started | EN/AR 320–430px browser matrix, install heartbeat, degraded states, alerts/dashboards verified. |
| 6. Shadow comparison and registry read switch | Not started | Zero unexplained mismatches for agreed window; canary switch and rollback drill pass. |
| 7. Human release gate and deployment | Not started | Recorded end-to-end journeys, external approvals, backups, CI/deploy/smoke/telemetry all green. |

After each phase, record commit SHA, migration identifier (if any), test counts, screenshots/video location, live query output location, rollback result, and approver in this table or a linked execution log.

---

## 5. Phase 0 — Confirm production and reconcile read-only

**Purpose:** Remove the current contradiction between Supabase references and learn the real live schema/data shape before designing or applying any migration.

**Files/documents:**

- Read: `apps/web-next/.env.example`, `apps/web-next/docs/deployment.md`, deployed VPS environment (values recorded with secrets redacted), `apps/web-next/public/widget/v1/runtime.js`
- Read: every `supabase/*.sql`, especially `shopify_tryon_foundation.sql`, `shopify_unified_app.sql`, `clerk_profiles_workspaces_widget_sites.sql`, `widget_production_foundation.sql`, and Messenger migrations
- Create during execution: `docs/superpowers/evidence/2026-08-31-phase-0-live-reconciliation.md` (redacted evidence only)

**Tasks:**

- [ ] Obtain read-only Supabase access and deployment/VPS environment access. Identify the production project by deployed `NEXT_PUBLIC_SUPABASE_URL`, not by whichever local file is newest.
- [ ] Record project ref, database version, migration history, table/column/index/constraint/trigger/policy/grant inventory, storage buckets/policies, and `get_advisors` output.
- [ ] Confirm whether `tryon_shops`, `shopify_shops`, entitlement tables/RPCs, Messenger tables, and the domain unique index exist live and match repository definitions.
- [ ] Run read-only collision queries for duplicate canonical domains, multiple workspaces per owner, multiple sites per shop, `tryon_shops`/`shopify_shops` disagreements, owner links without profiles, registry links whose site/workspace pair disagrees, synthetic owners, domain-less sites, orphan knowledge/conversations/leads/attachments, duplicate privacy idempotency keys, and storage objects without attachment rows (and vice versa).
- [ ] Produce a per-shop reconciliation matrix: normalized domain, registry row, lifecycle row, Clerk owner/profile/workspace, Store Chat site, Try-On settings, subscription/ledger, token presence, verified origins, last config heartbeat, and collision disposition.
- [ ] Create and verify a restorable pre-migration database backup plus storage-object inventory. Record immutable identifiers/timestamps, not secrets.
- [ ] Classify each collision as safe empty/synthetic, non-empty needs merge decision, or foreign-owner/security incident. Do not modify it.
- [ ] Reconcile the repository/deployment source of truth for the Supabase project reference; plan the later documentation/config cleanup without editing secrets into Git.

**Verification:** Evidence includes raw read-only query outputs, advisor output, backup restore instructions, counts reconciled against tables/storage, and a signed statement of the production project selected.

**Tests:** Re-run every inventory/collision query in the same read-only transaction or snapshot and confirm stable counts; verify the backup identifier is discoverable by the restore operator without performing a production restore.

**Manual checks:** In Supabase and VPS dashboards, a human independently compares the project ref and a known non-sensitive site/domain row.

**Rollback:** None; this phase is read-only. If any command mutates state, stop and restore before continuing.

**Gate:** No unknown production project, missing backup, unexplained non-empty collision, or unreviewed live-schema divergence remains. If access is unavailable, implementation may proceed only on Phase 1 local code; Phases 2–7 remain blocked.

---

## 6. Phase 1 — Local security and truthful-failure fixes

**Purpose:** Close locally provable exploit/failure paths before introducing new database state.

**Files/components:**

- Try-On tenant proof: `app/api/try-on/session/route.ts`, `app/api/try-on/generate/route.ts`, `app/api/try-on/jobs/[jobId]/route.ts`, `lib/try-on/service.ts`, `components/try-on/try-on-demo.tsx`, `app/embed/try-on/page.tsx`
- New server-only proof modules/routes: `lib/try-on/storefront-context.ts`, `app/api/shopify/proxy/try-on-context/route.ts`
- Theme transport: `apps/grindctrl-tryon/extensions/tryon-block/assets/tryon.js`, `tryon-catalog.js`, and their Liquid blocks
- Default authorization/settings truth: `lib/shopify/shops.ts`, `app/dashboard/try-on/actions.ts`, `lib/try-on/settings.ts`, `components/dashboard/tryon-settings-panel.tsx`, embedded Try-On settings routes/components
- SSRF/error truth: `lib/messenger/knowledge.ts`, `app/dashboard/messenger/actions.ts`, `app/api/shopify/store-chat/knowledge/route.ts`
- Email sync: `lib/messenger/provisioning.ts`, `lib/messenger/notify.ts`
- API/scope truth: `lib/shopify/admin.ts`, `apps/grindctrl-tryon/shopify.app.toml`, `app/api/shopify/webhooks/route.ts`

**Tasks:**

- [ ] Extend the existing signed App Proxy pattern to mint a short-lived Try-On storefront-context token bound to canonical shop and a high-entropy browser/session nonce.
- [ ] Replace the opaque client-created session ID with a server-signed session that binds product, canonical shop (or explicit public-demo null), nonce, issued/expiry times, and audience. On generation, derive shop/product from the signed session; reject disagreement instead of accepting body `shop`.
- [ ] Require valid Shopify storefront proof for a billable live shop. Preserve a separately rate-limited, non-merchant public demo path that cannot name or debit a shop.
- [ ] Ensure retry/request idempotency is scoped to proven shop + session + request key; do not allow a request key from one shop to replay against another.
- [ ] Change `requireManagedTryOnShop('default')` to reject merchant callers. Remove Global defaults from merchant selectors. Add an explicit internal-only boundary later rather than overloading Clerk authentication.
- [ ] Make `saveTryOnSettings` throw/return a typed error on Supabase failure; make dashboard and embedded actions display that result with `role="alert"` on failure.
- [ ] Resolve every knowledge URL hostname to all A/AAAA addresses, reject private/reserved/link-local/loopback/metadata ranges, connect only to a validated address while preserving TLS hostname verification, and repeat validation/pinning on every redirect. Set strict byte/time/redirect limits.
- [ ] Inspect and propagate Supabase errors for URL metadata, re-sync, pause/resume, and delete. Record audit only after the mutation succeeds.
- [ ] Synchronize a changed, non-placeholder Clerk primary email on authenticated account load. Never overwrite a current real email with a placeholder; notification fallback must use the synchronized address.
- [ ] Pin Admin GraphQL and webhooks to stable `2026-07`. Remove unused `read_products` unless Phase 0 finds an actual production feature that needs it. Persist scope changes from `app/scopes_update` instead of only touching `last_seen_at`.
- [ ] Add safe error codes/structured logs without PII, tokens, HMACs, full URLs, image data, or message bodies.

**Tests:**

- Add route/unit tests proving spoofed body/query shop, unsigned/expired/wrong-audience/wrong-session proof, missing storefront proof, cross-shop request-key replay, and public-demo shop injection cannot debit a tenant.
- Update `lib/shopify/shops.test.ts` and Try-On action/UI tests: users with a linked shop and users without one both fail to mutate `default`; owned real shops still save.
- Add `lib/messenger/knowledge.test.ts` cases for DNS-to-loopback/RFC1918/link-local/IPv6/metadata, mixed public/private answers, rebinding/redirects, timeouts, and surfaced Supabase failures.
- Add provisioning/notify tests for real-email change, placeholder upgrade, and failed sync.
- Run from `apps/web-next`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Run the extension build/check command discovered from `apps/grindctrl-tryon/package.json`/Shopify CLI configuration.

**Manual checks:** Use a local proxy-signed Shopify request and browser DevTools to prove the browser cannot change the billed shop; induce database/network failures and verify the UI reports failure rather than Saved/empty.

**Rollback:** Keep the previous storefront transport behind a disabled compatibility flag only for non-billable mock mode. Reverting code must never re-enable client-selected billing or global-default writes.

**Gate:** Both blockers are closed by negative tests, no merchant-visible false success remains in touched flows, and the full local verification suite is green.

---

## 7. Phase 2 — Expand-only ownership registry and atomic account link

**Purpose:** Establish one durable mapping from Clerk account to Shopify shop, Store Chat site, Try-On lifecycle/settings, and entitlements without deleting legacy state.

**Files/components:**

- Create a new delta migration after Phase 0 names the live shape, expected path: `supabase/shopify_account_registry_expand.sql`
- Modify: `lib/shopify/shops.ts`, `lib/messenger/shop-tenancy.ts`, `lib/messenger/shop-provisioning.ts`, `lib/messenger/provisioning.ts`, `app/claim/page.tsx`, `app/api/shopify/oauth/callback/route.ts`, `app/api/shopify/admin/settings/route.ts`, `app/api/shopify/webhooks/route.ts`
- Tests: matching `*.test.ts`/`*.test.tsx` files plus migration verification SQL recorded in Phase 2 evidence

**Tasks:**

- [ ] Write an expand-only migration based on the Phase 0 inventory. Add missing registry ownership/link metadata, claim audit/idempotency fields, lifecycle timestamps, and reconciliation status without deleting or rewriting legacy records.
- [ ] Make the existing composite shop/site/workspace relationship transaction-safe. Prefer a reviewed deferrable equivalent of `shopify_shops_site_workspace_fkey`; if the live shape makes that unsafe, add a redesigned ownership link and leave physical site/workspace unchanged until a later reconciled transaction. Never issue two independent TypeScript updates and call them atomic.
- [ ] Add one security-definer claim/link RPC that locks the canonical shop, profile/workspace, site, and compatibility lifecycle row; is idempotent; rejects another real owner; binds `shopify_shops` to the Clerk account; binds Try-On ownership; provisions the canonical verified storefront origin; records an audit event; and returns the canonical IDs.
- [ ] Keep non-empty/domain-less collisions. Mark them for manual reconciliation (for example with `superseded_by`/status metadata) rather than deleting them. Only a later human-approved migration may merge/delete data.
- [ ] Backfill the registry by insert-only operations for unambiguous rows identified in Phase 0. Emit every skipped/ambiguous shop into the reconciliation report.
- [ ] Dual-write install/uninstall/last-seen and claim ownership to the target registry and `tryon_shops` compatibility row. Make any dual-write disagreement observable and non-successful for ownership-changing operations.
- [ ] Change claim redemption to call the single RPC only after the current Shopify `Shop.email` versus Clerk primary-email check succeeds. The claim result must link both Store Chat and Try-On.
- [ ] Add an audited support recovery/unclaim operation with explicit internal authorization, reason, and idempotency; do not expose it to merchants by default.
- [ ] Enforce/prepare one default workspace per profile only after Phase 0 collision decisions. If a unique constraint cannot be added cleanly, keep bootstrap atomic in an RPC and track duplicates for contraction.

**Tests:**

- Migration fingerprint, rerun/idempotency, grants, RLS, canonical-domain, FK deferrability/link integrity, and rollback-code-path tests.
- RPC tests: dashboard-first, embedded-first, repeat claim, concurrent same-owner claim, concurrent different-owner claim, email mismatch before RPC, synthetic-to-real claim, foreign real owner refusal, multi-store one account, store reinstall, and injected mid-transaction failure with zero partial transfer.
- App tests prove dashboard and embedded surfaces load the same `widget_site_id` and `tryon_settings[shop]` after claim.

**Manual checks:** In a disposable/dev store, install from Shopify first and dashboard first; claim with matching and non-matching emails; change settings from each surface and verify the exact same DB row IDs.

**Rollback:** Turn off registry read flags and continue dual-writing. Retain all added rows/columns/functions; do not drop them. Restore from the Phase 0 backup only for a proven corrupt write, not for ordinary code rollback.

**Gate:** Every active test shop has one explainable registry mapping; claim is atomic and binds both products; storefront origin is provisioned; ambiguous production rows remain untouched and documented.

---

## 8. Phase 3 — Atomic settings, publishing, and shared operations

**Purpose:** Ensure the same control in dashboard and embedded Shopify executes the same transaction and reports the true result.

**Files/components:**

- Create: `supabase/messenger_atomic_mutations.sql`
- Modify: `lib/messenger/actions-core.ts`, `components/dashboard/messenger/support-desk-settings.tsx`, `app/dashboard/messenger/actions.ts`, `components/shopify/store-chat-actions.ts`, Store Chat draft/publish/thread routes
- Modify: `lib/try-on/settings.ts`, dashboard/embedded Try-On settings actions/components
- Modify/extract: `lib/messenger/conversations.ts` or new `lib/messenger/thread-actions.ts`; `lib/messenger/knowledge.ts`

**Tasks:**

- [ ] Add a row-locked/RPC draft mutation that accepts one validated patch plus expected draft revision, atomically merges it, increments revision, records audit, and returns the canonical draft/revision. A revision conflict returns a typed conflict and refresh instruction.
- [ ] Change Support Desk Save from four `Promise.all` whole-document replacements to one combined patch and one action result.
- [ ] Move publish and discard into shared server-only RPC-backed functions. Publish atomically promotes the exact draft, increments settings version, clears draft, and records audit.
- [ ] Route both dashboard and embedded Store Chat through the same draft/publish/discard implementation and expose discard in both.
- [ ] Extract reply/takeover/release/close into one authorized server orchestrator; keep auth gates surface-specific, but share state transitions, audit, error mapping, and transaction semantics.
- [ ] Apply the same typed-result rule to Try-On setting saves; after save, reload and return the canonical row so both surfaces render identical settings.
- [ ] Bound launcher label/string lengths in validation and persistence, not only HTML `maxLength`.

**Tests:**

- Deterministic concurrent tests for four Support Desk sections, two tabs editing different keys, same-key revision conflict, publish versus save, discard versus save, and injected audit/database failure.
- Contract tests run the same mutation vectors through dashboard and embedded adapters and compare DB calls/result shapes.
- Tests confirm UI announces success only after canonical persistence and announces conflict/error with `role="alert"`.

**Manual checks:** Open dashboard and embedded Shopify side by side, make alternating changes, refresh both, test conflict recovery, discard, and publish; compare database revision/version values.

**Rollback:** Code can temporarily use the new RPC through the old UI; do not restore whole-document concurrent writes. Added revision fields/functions remain.

**Gate:** No lost write under the concurrency suite; both surfaces converge after refresh; all failures are visible and retryable.

---

## 9. Phase 4 — Privacy outbox, redaction/export, and Shopify compliance

**Purpose:** Meet Shopify's mandatory privacy contract with durable, testable processing across database and storage.

**Files/components:**

- Create: `supabase/shopify_privacy_jobs.sql`
- Create: `lib/shopify/privacy.ts`, `lib/shopify/privacy-worker.ts`, and tests
- Modify: `app/api/shopify/webhooks/route.ts`, `apps/grindctrl-tryon/shopify.app.toml`
- Create a protected worker entry point appropriate to the confirmed deployment, expected `app/api/internal/shopify/privacy/run/route.ts`
- Modify customer persistence: `lib/messenger/conversations.ts`, bootstrap/send/contact routes, `widget_visitors` schema
- Cover: `widget_visitors`, conversations/messages/events, `widget_leads`, feedback/audit payloads, Messenger knowledge where customer-derived, `messenger_attachments`, `storage.objects`, `tryon_jobs`, Try-On entitlement data, product config, shop tokens, registry/lifecycle/settings rows

**Tasks:**

- [ ] Add `shopify_customer_id` (or an equivalent indexed, site-scoped identity field) to visitors and persist the verified App Proxy customer ID. Preserve email fallback only for legacy matches.
- [ ] Add a durable privacy-job/outbox table keyed by Shopify webhook ID/topic/shop/customer/request, with received/processing/completed/failed timestamps, attempts, result manifest, retention/legal-hold fields, and least-privilege grants/RLS.
- [ ] Refactor webhook handling to validate raw-body HMAC in constant time, validate topic/shop/payload shape, deduplicate `X-Shopify-Webhook-Id`, enqueue in one transaction, and then return `2xx`. Invalid HMAC returns `401`; unknown topics return an explicit non-success or are allowlisted lifecycle no-ops—not silent success.
- [ ] Register all three `compliance_topics` in TOML.
- [ ] Implement `customers/data_request`: resolve the site by registry; match verified customer ID first and normalized email only for legacy data; export the minimum relevant visitor/conversation/message/lead/feedback/attachment metadata and Try-On job metadata; exclude secrets and unrelated tenants; deliver through the legally approved secure mechanism; record a manifest/hash and completion.
- [ ] Implement `customers/redact`: remove or irreversibly anonymize matched personal rows, leads, message/contact metadata, and attachment database rows; delete every corresponding private storage object; preserve only approved non-identifying aggregate counters.
- [ ] Implement `shop/redact`: after Shopify's post-uninstall event, erase shop-specific Store Chat, Try-On, token, entitlement, customer, audit-payload, and storage data according to the approved retention policy. Use the registry as the scope root and make reruns safe.
- [ ] Implement retries/backoff/dead-letter alerts and an operator retry command. The worker must be externally scheduled/durable; never rely on `void process()` after the response.
- [ ] Add retention cleanup for attachments and expired privacy export artifacts, with object/row reconciliation.
- [ ] Deploy Shopify config with `shopify app deploy`; verify the released app version contains the compliance subscriptions.

**Tests:**

- HMAC valid/invalid/missing, malformed JSON/payload, duplicate delivery, replay, unknown topic, enqueue failure, worker retry, partial storage failure, and idempotent rerun tests.
- Fixture-driven export/redaction tests with two shops and overlapping email values prove site/customer isolation and cover customer ID, legacy email, leads, messages, attachments, object deletion, Try-On metadata, and shop-wide erasure.
- Run Shopify CLI webhook triggers for all three topics, then verify completed job manifests. Also verify real subscriptions in the Partner/Dev Dashboard because triggers do not prove registration.

**Manual checks:** A human reviews an export for completeness/minimization, requests customer deletion and confirms both tables and storage are clean, repeats the same delivery, and performs shop redaction only in a disposable development store.

**Rollback:** Roll back handler code to enqueue-only while retaining jobs; never acknowledge then discard. Pause workers on unexpected scope, preserve queued events, and restore mistaken non-compliance deletions from the Phase 0 backup only under the approved incident process.

**Gate:** All three subscriptions are deployed; durable jobs complete within policy; storage/database manifests reconcile; protected-customer-data and legal gates below are approved.

---

## 10. Phase 5 — Installation, UI/UX, degraded states, and observability

**Purpose:** Make installation and daily control simple, consistent, responsive, bilingual, and operationally diagnosable.

**Files/components:**

- Installation/detection: `components/dashboard/messenger/install-card.tsx`, `app/dashboard/messenger/page.tsx`, `app/api/shopify/store-chat/state/route.ts`, `app/api/messenger/config/route.ts`, `lib/messenger/conversations.ts`
- UI/RTL/i18n: `preview-frame.tsx`, `conversations-panel.tsx`, `appearance-editor.tsx`, `launcher-preview.tsx`, `ai-knowledge-editor.tsx`, `components/shopify/admin-settings.tsx`, `merchant-plan-card.tsx`, shared i18n/copy files
- Degraded-state contracts: dashboard Messenger page, embedded Store Chat state route/component, `MessengerTabs` and tab panels
- Observability: `instrumentation.ts`, `instrumentation-client.ts`, Sentry configs, `lib/analytics.ts`, `lib/analytics/scrub-url.ts`, Shopify/Messenger/Try-On routes, `.github/workflows/deploy-next.yml`, deployment/runbook docs
- Browser tests: extend/create Playwright coverage under `apps/web-next/e2e` and the established local browser harness

**Tasks:**

- [ ] Derive Store Chat Live only from a recent, site-scoped `config_served` heartbeat emitted by the storefront widget. Return `off`, `enabled_waiting`, `live`, `stale`, and `detection_error` as distinct states.
- [ ] Make the primary Shopify install action enable Store Chat, surface the result, open the direct app-embed activation URL (`context=apps&activateAppId=<client-id>/messenger`), use the exact visible name **GRINDCTRL Store Chat**, and poll heartbeat on return. Put Other platforms behind a secondary disclosure in Shopify context.
- [ ] Provision/verify permanent `myshopify.com` origin during registry link and provide explicit custom-domain verification rather than an implicit allow-all.
- [ ] Fix the mobile preview with fluid `max-w-full` sizing; wrap Arabic conversation actions; add `overflow-wrap:anywhere` to unbroken message content; enforce/truncate launcher label bounds in preview and storefront runtime.
- [ ] Finish embedded Try-On Arabic copy for loading/error/install/plan/action states and correct the Arabic knowledge subtitle mistranslation.
- [ ] Replace `Promise.allSettled` empty fallbacks with per-panel `{status:'ready'|'empty'|'error', data, retry}` contracts in dashboard and embedded state. Keep healthy panels usable while failed panels show localized retryable errors.
- [ ] Surface enable/disable failures, embedded refresh failures, and AI knowledge errors with correct success/error tone and accessibility roles.
- [ ] Add localized loading, empty, success, error, offline/timeout, conflict, unauthorized, and rate-limit states for every touched tab and Try-On flow.
- [ ] Add structured event names and correlation IDs for claim, registry mismatch, settings save/publish/conflict, storefront proof rejection, entitlement reservation/finalization/refund, config heartbeat, webhook enqueue/process/dead-letter, privacy completion, Shopify GraphQL errors, and storage cleanup. Scrub PII/secrets.
- [ ] Configure Sentry alerts and an operations dashboard/runbook for elevated 4xx/5xx, paid-generation failures/refund mismatches, webhook retry/dead letters, stale installs, registry shadow mismatches, privacy SLA, and notification delivery.
- [ ] Expand deploy smoke checks to signed/non-destructive contracts where possible; an HTTP `<500` alone is not success. Add post-deploy telemetry queries with explicit expected zero/error thresholds.

**Tests:**

- Component/route tests for every state discriminant and localized error.
- Automated 320/360/390/430px EN/AR overflow tests for dashboard Messenger, embedded Shopify Try-On/Store Chat, storefront Store Chat, and storefront Try-On; include long Arabic labels, 2,000-character unbroken messages, and maximum launcher labels.
- Accessibility checks: keyboard navigation, focus restoration, visible focus, dialog/sheet semantics, status/alert announcements, contrast, reduced motion.
- Observability tests assert correlation IDs, safe error codes, and scrubbing of tokens, emails, URLs with claim tokens, photos, message content, and webhook payload PII.

**Manual checks:** Real Chromium browser at phone widths and desktop, EN/AR and RTL/LTR; install app embeds through Shopify Theme Editor; turn each dependency off once and verify degraded UX plus Sentry/event evidence.

**Rollback:** UI can roll back independently while retaining truthful API contracts. Detection can fall back to `enabled_waiting` but never to a false `live`. Disable noisy alerts rather than deleting telemetry.

**Gate:** Browser matrix has no overflow/runtime/console/a11y failures; installation reaches real heartbeat Live; degraded panels are honest; alerts are received and actionable.

---

## 11. Phase 6 — Shadow comparison and controlled registry switch

**Purpose:** Prove the new account/shop registry agrees with legacy behavior before it controls production reads.

**Files/components:**

- `lib/shopify/shops.ts`, new registry adapter module and tests
- `lib/messenger/shop-tenancy.ts`, `shop-provisioning.ts`, `provisioning.ts`
- dashboard Store Chat/Try-On pages, embedded state/settings routes, OAuth/webhooks
- feature-flag/env documentation and observability queries/runbook

**Tasks:**

- [ ] Implement one registry adapter with `legacy`, `shadow`, and `registry` modes. Callers receive one typed shop/account/site view rather than querying tables directly.
- [ ] In shadow mode, continue serving legacy results while reading `shopify_shops` and emitting a scrubbed mismatch event containing identifiers/hashes sufficient for diagnosis but no PII.
- [ ] Compare ownership, lifecycle, site ID, workspace/profile, settings target, entitlement shop, install state, and origin set for every dashboard/embedded/storefront path.
- [ ] Run the agreed observation window across all known active shops and execute synthetic dashboard-first, embedded-first, reinstall, multi-store, and account-email-change journeys.
- [ ] Reconcile every mismatch. Do not suppress a class of mismatch just to meet the gate.
- [ ] Canary registry reads for internal/dev shops, then a small merchant cohort, then all shops. Continue dual-write and keep the legacy read path available.
- [ ] Drill rollback to legacy reads without changing database state; prove no settings or ownership change is lost.

**Tests:** Adapter contract tests for all modes, forced mismatch event tests, canary flag tests, and complete regression suite.

**Manual checks:** Compare dashboard, embedded app, storefront config, Try-On settings and plan for the same store before/after flag changes; perform rollback drill.

**Rollback:** Set read mode to `legacy`; keep dual-write and new registry data. No schema contraction or data deletion.

**Gate:** Zero unexplained mismatches for the approved observation window, canary and rollback drill pass, and an owner approves the switch.

---

## 12. Phase 7 — Recorded human release gate and deployment

**Purpose:** Prove the product as a merchant and shopper would use it, then deploy with reversible checkpoints.

**Files/components:**

- `.github/workflows/deploy-next.yml`, `.github/workflows/static.yml`, root `playwright.config.ts`, `apps/web-next/e2e/**`, all phase-owned tests/migrations, `apps/grindctrl-tryon/shopify.app.toml`
- Create during execution: `docs/superpowers/evidence/2026-08-31-release-certification.md` plus redacted screenshots/video/log/query artifacts

**Tasks:** Freeze the release scope, record the release/rollback identifiers, execute the automated and human certification below, deploy in the stated sequence, observe the soak window, and have the named release owner sign the evidence package.

**Tests — pre-release automated checks:**

- [ ] `apps/web-next`: clean install as CI does, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- [ ] Root/static site: `npm ci`, `npm run build`, `npm test`.
- [ ] Shopify extension build/validation and TOML validation; stable API version and least scopes confirmed.
- [ ] Migration rerun/fingerprint/RLS/advisor checks; backup and restore procedure revalidated.
- [ ] Privacy fixtures and live development-store deliveries complete; no dead letters.
- [ ] Security regression: tenant spoofing, global-default write, SSRF, cross-shop reads/writes, forged sessions/webhooks/proxy requests, rate limits, token/PII scrubbing.

**Manual checks — recorded human browser journeys:**

- [ ] New merchant: install Shopify app, open embedded app, activate Try-On and Store Chat, claim matching Clerk account, arrive in the same GRINDCTRL dashboard account.
- [ ] Dashboard-first merchant: create/open account before install, connect store, claim, and verify no split settings/site.
- [ ] Multi-store merchant: switch stores and prove each has its own Try-On/Store Chat records while sharing the account.
- [ ] Change Try-On and Store Chat settings in embedded Shopify; observe them in dashboard and storefront. Change in dashboard; observe the same rows in embedded/storefront.
- [ ] Shopper: anonymous and signed-in Store Chat, contact capture, attachment, AI response, handoff, staff reply/takeover/release/close, order lookup success/no-scope/redacted-data/error.
- [ ] Shopper Try-On: valid paid render, exhausted plan, provider failure with refund, idempotent retry, spoofed shop refusal, upload validation, poll/result/add-to-cart.
- [ ] Installation: direct Theme Editor activation, heartbeat transitions, custom domain, embed disabled/stale/re-enabled.
- [ ] Privacy: customer export, customer redaction, shop redaction in disposable store, duplicate delivery, storage verification.
- [ ] Failure tour: Supabase query failure, Shopify GraphQL error, Redis/rate-limit dependency failure, image provider timeout, email failure, storage failure, refresh conflict, offline browser. Confirm UI and alerts.
- [ ] Repeat critical journeys in English and Arabic at 320, 360, 390, 430px and desktop. Confirm no horizontal overflow, clipping, broken focus, untranslated critical copy, or incorrect mirroring.

**Deployment sequence:**

1. Freeze scope and record the release commit, current production image, feature flags, migration list, backup ID, and rollback commands.
2. Apply reviewed expand-only migrations to the confirmed project; run post-migration schema/policy/collision checks.
3. Deploy Shopify app configuration and verify the released version/subscriptions/scopes.
4. Deploy Next via `.github/workflows/deploy-next.yml`; deploy static Pages only if its source changed.
5. Require GitHub Actions success, then run functional live checks, database reconciliation, Shopify delivery checks, and Sentry/PostHog verification.
6. Enable shadow/canary flags in stages. Stop on any unexplained tenant, entitlement, privacy, or settings mismatch.
7. Observe the agreed soak window and sign the release evidence package.

**Rollback:** Revert application image/commit, set registry reads to legacy, pause workers while retaining durable jobs, and leave expand-only schema in place. A database restore is reserved for confirmed data corruption and requires incident authorization. Shopify config rollback must preserve the three compliance subscriptions.

**Final gate:** No open blocker/high finding; no unexplained schema/advisor/registry mismatch; protected-customer-data and legal/Partner gates approved; automated suites and recorded human journeys pass; alerts are quiet/actionable; rollback drill is proven.

---

## 13. Decisions requiring user, legal, or external access

These are real release gates and must not be guessed by an implementation agent:

- **Supabase/VPS access:** provide read-only production DB access first, then separately authorize migration execution; provide backup/restore access or an operator who can perform it.
- **Shopify access:** development store with owner account, Partner/Dev Dashboard access, Shopify CLI app-deploy authorization, and permission to inspect webhook delivery logs/API health.
- **Protected customer data:** confirm `read_orders` plus required email/name/address fields are requested and approved. If not approved, decide whether order lookup is removed/degraded or submission waits.
- **Legal/privacy:** approve privacy policy, retention periods, legal-hold exceptions, export delivery mechanism, subprocessors, customer-data purpose/minimization, and whether any entitlement/billing ledger fields must be retained after shop redaction.
- **Internal admin authority:** designate the identity/role allowed to manage global Try-On defaults and perform recovery/unclaim. Until then, both operations remain unavailable to merchants and are handled by controlled manual operations.
- **Real recipient/provider tests:** authorize test emails, image-generation spend limits, and disposable customer/shop data used for destructive privacy verification.
- **Release/soak window:** name the human approver, canary cohort, observation duration, incident contacts, and rollback authority.

---

## 14. Technical decisions already settled

- Do not redesign the product around separate dashboard and Shopify configurations; both are views over the same tenant records.
- Keep current Store Chat domain-first resolution and owner-email claim verification; extend the claim atomically to the target registry and Try-On.
- Use signed Shopify App Proxy proof plus a server-signed Try-On session; do not trust client `shop`.
- Deny merchant writes to global defaults now; an internal admin capability is additive future work.
- Use `shopify_shops` as the target registry only after live verification; keep `tryon_shops` as compatibility during dual-write/shadow.
- Use database transactions/RPCs for claim/link, draft/publish, and privacy queue state; do not emulate transactions with sequential service-role requests.
- Keep settings in their current product-specific records; consistency comes from canonical tenant linkage, not copying JSON between systems.
- Process privacy through a durable outbox/worker and include private storage cleanup.
- Pin Shopify APIs/webhooks to stable `2026-07` for this release and remove unused scope.
- Release through expand → dual-write → shadow compare → canary → switch. No contraction is authorized in this plan.
- Human browser verification is mandatory evidence, not a substitute for automated tests and not optional after green CI.

---

## 15. Finding-to-phase traceability

| Finding | Phase |
|---|---|
| `TRYON-AUTH-01`, `TRYON-AUTH-02`, `SEC-01`, `AUTH-03`, `DATA-02`, `SHOP-02` | Phase 1 |
| Remaining claim-to-Try-On gap, `RLS-01`, `RLS-02`, `AUTH-04`, storefront-origin provisioning, non-deferrable transfer | Phases 0 and 2 |
| `DATA-01`, `DATA-03`, `DATA-04`, truthful Try-On saves | Phase 3 |
| `SHOP-01`, `SHOP-03`, `SHOP-04`, `SHOP-05`, customer-ID persistence, lead/storage redaction | Phase 4 |
| `PR-01`–`PR-04`, `I18N-01`–`I18N-02`, `INSTALL-01`–`INSTALL-02`, `ERR-01`–`ERR-04` | Phase 5 |
| Registry divergence/cutover risk and service-role boundary regression | Phase 6 |
| Full ecosystem/browser/deploy proof | Phase 7 |

---

## 16. Definition of done

GRINDCTRL is ready only when all of the following are simultaneously true:

- A normalized Shopify store maps to exactly one account link, one Store Chat site, one Try-On settings row, and one entitlement identity; dashboard and embedded views show the same persisted values.
- No public request can select another tenant for billing or data access, and no merchant can mutate internal defaults.
- All settings and lifecycle operations are atomic, idempotent where required, and truthful on failure.
- Mandatory Shopify privacy topics are registered, verified, durably processed, and proven across database plus storage; external protected-data/legal gates are approved.
- Store Chat installation reports actual storefront heartbeat, not Try-On activity, and the five-minute install path is direct and correctly named.
- Every important empty/loading/error/conflict/offline state is localized and accessible.
- Automated security/unit/integration/browser/build checks pass, and recorded human verification passes across merchant/shopper, English/Arabic, mobile/desktop, dashboard/embedded/storefront, and induced failures.
- Production deployment, telemetry, backup, canary, soak, and rollback evidence are attached. A green health endpoint or preflight alone is never treated as completion.
