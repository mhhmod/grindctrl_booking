# PR 75 — independent-review remediation

Milestone 1 remains **not approved**. Reviewed starting HEAD: `209340229572c36a631a352f4244adbd29c80ee4`; main remains the original audited baseline `4f5467fa80f73dde26f98f435ef1606488a68864`. Work stays on `feat/shopify-installation-isolation` and [Draft PR 75](https://github.com/mhhmod/grindctrl_booking/pull/75). AGENTS.md was reread and the clean starting worktree verified. No hosted credentials/database state/Shopify settings were available to inspect; none is assumed empty or correctly configured.

This follow-up changes runtime code and manual SQL. The previously passing 3,202 tests/207 browser checks are historical evidence for the reviewed starting code, not proof of these fixes. Final tested SHA/results are recorded below once executed. No merge/deployment/hosted SQL/app setting change/real merchant installation/paid AI/M2 occurred.

## Code findings and remediation

### 1. Refresh resilience — runtime and SQL changes

Root cause: all fetch/status/parse failures collapsed to exchange_failed and permanently required reauthorization. A temporary outage could strand a valid rotating refresh token. An expired abandoned lease also forced retirement without token rejection evidence.

`lib/shopify/tokens.ts` now classifies transport/timeouts, 429 and 5xx as transient, terminal 401 separately, and other rejected requests as permanent/configuration failures. Refresh has at most three attempts under the same distributed lease, honoring short Retry-After waits; longer waits/exhaustion are persisted as installation-scoped cooldown. Transient failures, lost/truncated responses, persistence failure and generic storage errors preserve encrypted refresh material and do not become terminal retirement. Cooldown failure leaves the fence to expire safely rather than forcing reauthorization. Near-expiry access is not presented as fresh access during failure. Explicit invalid credentials/permanent rejection require reauthorization; no credentials/provider bodies are logged.

Successful rotation atomically saves both encrypted tokens and provider-defined expiry metadata. The follow-up SQL recovers an expired abandoned lease with a new fence without guessing token ownership; the former writer cannot commit. Acquisition and refresh still share that lease. Authorization-code acquisition is not blindly retried. An authorized fresh token acquisition can clear refresh cooldown without racing another lease owner.

[Shopify's refresh documentation](https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange#refresh-an-expiring-offline-token) explicitly permits retry after ambiguous/transient failures while the presented refresh token remains usable, until its replacement is used within provider expiry/grace. We do not assume a fixed retry window or use the documented grace cap as an application token lifetime. Terminal 401 is final. No real Shopify token refresh was performed.

### 2. Replay/ordering — runtime and SQL changes

Root cause: a valid body plus caller-controlled delivery timestamp/ID could be presented as a newer uninstall and remove a reauthorized credential. Body HMAC does not authenticate those delivery headers or installation generation.

The new `record_shopify_installation_event_v2` only records lifecycle receipts. No timestamp/body receipt can mutate credentials. New code calls v2, so missing follow-up schema fails before invoking the old mutating function; the follow-up also makes the old RPC delegate to the safe implementation for compatibility.

The webhook handler verifies current app-specific credentials against Shopify. Expiry first uses serialized refresh. Then a current, still-unexpired credential is probed through `currentAppInstallation` under the shared lease. Active response -> ignore the old uninstall. Definitive 401 -> atomically disconnect only the matching installation/version/lease; store aggregate stays installed while B remains active. The event retains verification installation/version/outcome/time. Receipt and scope events cannot reactivate stores or fence an in-flight authorization merely because headers changed.

Network/429/5xx/403, malformed/GraphQL responses, missing/expired credentials and lost fences cannot authorize deletion. Pending receipts survive retries; the HTTP response is 503 when verification is unavailable. Terminal refresh disables that exact credential but does not fabricate uninstall-generation evidence. Residual ambiguity: a 401 proves rejection of the current credential, not its unique underlying cause; absent usable credentials and actual delivery/installation ambiguity need authoritative manual reconciliation. Real delivery/captured-header tests on Shopify remain unexecuted. Legitimate current-credential revocation is handled automatically when its definitive response is available.

### 3. Privacy — casework SQL and actionable procedure

The former implementation recorded/notified requests but lacked an execution/retention/evidence workflow. New `shopify_privacy_case_actions`, restricted work queue and RPC cover both installation and legacy sources. The queue calculates original-receipt 30-day deadlines and flags legacy completed rows without fulfillment evidence. Evidence is append-only for service tooling. Completion requires previously reviewed scope hash, separate reviewer, approval and actual execution/verification references; legacy cases additionally need independent provenance. Data delivery/redaction require their respective evidence; legal holds cannot be cleared by assignment/escalation. Case completion and evidence append are transactional.

The RPC validates evidence structure and trusted operator declarations; it does not prove external deletion or authenticate a human from a string. There is no browser completion API and no automatic domain-wide/shared-data deletion. [The fulfillment procedure](2026-10-24-shopify-privacy-procedure.md) specifies accountable/backup roles, daily monitoring, escalation targets inside the 30-day deadline, exact manifest/ownership checks, new/legacy provenance, shared-data decisions, object-before-row deletion, export delivery, partial failures, in-flight/financial reconciliation, legally specific retention, vendor/backups and independent deletion evidence.

**Still P0 for rollout:** the owner must name operators, approve legal ownership/retention, verify actual schema/subprocessors/access enforcement and rehearse fulfillment on synthetic hosted data. No legal signoff, actual export/deletion, hosted audit or organizational approval is claimed. The procedure and casework are concrete candidates for independent review, not proof that real requests have been fulfilled.

### 4. App Proxy coexistence — loader changes and configuration requirements

All three storefront loaders hardcoded `/apps/grindctrl`, so two registrations could not be assumed to use independently configured roots. Product Try-On, catalog and Store Chat blocks now pass a configurable, validated same-origin connection root to their loaders. Existing defaults remain compatible. Config, product proof and shopper identity use the selected root; URLs/traversal/query paths are refused. Signatures, not browser path selection, establish backend app identity.

[The exact configuration/acceptance document](2026-10-24-shopify-proxy-coexistence.md) requires distinct actual roots (A `/apps/grindctrl`, B `/apps/grindctrl-public` examples), per-app URLs/scopes/releases and matching fields in all three blocks. Existing Shopify merchant-customized paths must be inspected; TOML changes do not prove installed paths changed. One storefront publisher at a time is required; overlapping installations do not mean duplicate global chat/catalog loaders were redesigned. Real A/B proxy routing, theme releases and coexistence are **unverified until Development Store evidence**.

### 5. Dependency triage — compatible patches, explicit remaining risk

[All original 13 findings are triaged](2026-10-24-development-dependency-triage.md) with exact packages/versions, dependency paths, preconditions, advisory references and decisions. Compatible lockfile updates: body-parser 2.4.0, Hono 4.13.13, ip-address 10.7.4, Undici 7.30.1, Vite 7.3.7 and root Zod 4.6.7; incidental required iconv-lite/qs patches retained. Unrelated SWC platform metadata preserved. No package.json major range or test-framework major changed.

Full-graph audit fell from **13 to 8 findings** (3 moderate, 3 high, 2 critical); production-only remains zero. Vitest/Tinypool critical chains, mocker, nested Zod/shadcn/registry and typography/parser remain explicit toolchain review gates. Node/JSDOM run mode, trusted checkouts, isolated CI and absent production credentials bound exposure; they do not neutralize a compromised dependency. A supported patched Vitest/pool/mocker migration and coordinated upstream consumer upgrades need a separate justified change or explicit reviewer disposition before merge. No blanket risk acceptance is assumed.

## Database and rollback

Manual additive order: existing `20260909_shopify_privacy_requests.sql` schema verified -> `20261024_shopify_installation_isolation.sql` -> **`20261024_shopify_review_remediation.sql`** -> **`20261024_shopify_privacy_casework.sql`**. Hosted preflight must inspect table/function/grant drift, exact projects, data counts, RLS/bypass behavior, backups, old privacy backlog and pending jobs. No hosted SQL was run.

The two new deltas add refresh cooldown/verification evidence and privacy audit/queue/RPC; replace lifecycle/lease functions; preserve merchants/subscriptions/jobs/ledger and legacy tokens. No ownership backfill is guessed. Source installation event RPC requires v2, so deploy follow-up SQL before new code and drain old images before two-app use. Never reapply older function definitions over these deltas.

Rollback should retain additive audit/schema and prefer a forward fix. Do not restore old timestamp-driven lifecycle mutations/domain-only token writers or delete the evidence tables. Code rollback cannot revive retired Shopify credentials or undo privacy erasure. Old and new app generations require explicit authorized reconnect/drain steps; no credit regrant or AI regeneration is a recovery mechanism.

## Evidence and readiness

Executed before the final late fence regression: **470 tests / 46 affected files passed** (76.39 seconds), including credential/lifecycle/privacy/loader, existing credit accounting and durable/in-flight job tests. Earlier failures in SQL fixtures exposed and corrected an unintended merchant-column update and parameter typing; assertions were retained. Additional final focused/static and full CI results must be recorded against their actual SHA, not inferred from this count.

| Decision | Current recommendation |
|---|---|
| Source approval | Ready for independent re-review after new full CI; **not approved**. Reviewer must examine real code/SQL changes, privacy procedure and remaining critical-tooling disposition. |
| Controlled Development Store testing | Conditional after source review and separate authorization of named isolated project, manual migrations, real app/proxy/theme operations, synthetic data and noncharging AI stub. No such operations authorized/executed here. |
| Merge | **NO-GO pending independent approval**, final checks and explicit toolchain/security disposition; main triggers deployment workflows. |
| Real merchant rollout | **NO-GO**: privacy operating/legal approval, hosted data/schema/backup/RBAC validation, actual proxy/extension/distribution/permissions evidence and financial/job reconciliation remain open. |

Final validation record is appended after completion. No M2 work is authorized by these recommendations.
