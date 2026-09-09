# Production risk closure: 2026-09-05 continuation

Owner: current GrindCTRL ecosystem goal, task `01a0581e-3b83-71f2-8cbd-e981e2a28fac`.
Goal runtime status at entry: `usageLimited`; existing objective already covers the entire SaaS/Shopify ecosystem. Available goal tools cannot change its objective or resume status. This linked work register adds the user's explicit provider, library, rate-limit and remaining UI requirements without falsely marking the goal resumed or complete.
Entry code checkpoint: `92f4d0f` with previous local header fix and unrelated working-tree changes preserved.
Release state: **NO-GO until evidence gates pass.**

Launch boundary confirmed by the user during this continuation: **managed service first; keep credit grants operator-only**. Self-service merchant checkout is deferred, not an incomplete mandatory feature for this launch. Do not grant an operator, mark an invoice paid, or bypass Shopify's distribution/billing requirements on the strength of this choice alone.

## Scope and acceptance criteria

This is an implementation continuation of `docs/superpowers/plans/2026-08-31-grindctrl-ecosystem-production-readiness.md`, not a declaration that its old open/closed statuses are current. Later commits fixed several of its original findings. Reconcile each against current code and live records before claiming closure.

| Risk / lane | Required condition | Work owner |
|---|---|---|
| UI: auth overflow and launcher collision | Zero-minimum responsive auth grid, no assistant over auth controls even on client navigation; footer controls clear launcher; EN/AR and light/dark browser proof | UI agent + root browser QA |
| Dependencies | Official-advisory inventory; compatible patched versions; lockfile/install consistency; remaining runtime vulnerabilities explicitly resolved or release-blocked | Dependency agent |
| Public expensive endpoints | Existing abuse limits fail closed on missing/unreachable/timed-out Redis; truthful 429/503 before provider side effects | Rate-limit agent |
| Dashboard / Shopify limits | Authenticated and authorized identities, common verified-shop limits across both surfaces, finite Retry-After and action errors | Rate-limit agent |
| Assistant multi-instance budget | Existing allowance semantics enforced atomically across instances, not only process memory; dependency failure is explicit | Rate-limit agent |
| Image-provider boundary | Time-bounded calls and response reads; no automatic duplicate chargeable retries; allowlisted non-redirecting garment fetch; bounded bytes and validated output; safe failures | Root |
| Cost evidence | Missing provider cost stays null through persistence/replay; a refunded merchant credit does not erase incurred provider cost | Root |
| Groq boundary | Explicit bounded SDK timeout/retries; structured non-sensitive outcome and token-usage logs; no raw provider error payloads logged | Root |
| Live operations | Verify actual Redis, provider/model configuration, funded limits, alert delivery, deployed revision and rollback | Root; external access needed where unavailable |
| Tenancy, billing, data/privacy | Current authoritative subscription/ownership records, reconciliation/backup, privacy queue and Shopify delivery/approval evidence | Root; inherited release gates remain |
| Pricing strategy | Actual costs, customer commitments and sales evidence; owner-approved catalogue/service boundary before publishing proposed prices | Founder + commercial evidence register |

## Three-perspective implementation design

### Frontend

Preserve the previous labelled mobile Sign in fix. Correct auth intrinsic-width containment without hiding overflow globally. Suppress the sales/support launcher on auth routes and on client transitions into protected/embed surfaces; reserve footer clearance rather than covering controls. Reuse existing components and translations. Existing visible error/loading states remain; API/action limit responses must not look like successful saves or empty data.

### Backend

Keep current provider/model selection and billing catalogue unchanged. Use one-attempt image generation with a 120-second operational deadline; retain the existing 20-second garment deadline. Bound garment and output reads before buffering. Keep confirmed finite nonnegative provider cost; use null for unknown cost. Persist known cost even when result storage fails and the merchant reservation is refunded. Limit Groq to an explicit 30-second request timeout with no automatic retries, so an ambiguous timeout does not silently multiply work. Log operation/model/usage numbers and sanitized status, not prompts, photos, API keys or full errors.

Operational rate defaults (30 writes/minute and 120 reads/minute for a verified merchant shop) are safety policy proposals, not paid plan allowances or measured capacity. Preserve public 10/10 seconds, chat session 8/minute and order anti-enumeration 20/hour budgets. Preserve current assistant tier values while making enforcement distributed. Test actual behavior under limit exhaustion and unavailable Redis; tune only from evidence.

### Security checkpoint

Authentication precedes merchant limiting; ownership precedes tenant-bucket selection and mutations. Never key tenancy from email or unverified body/query shop. Provider credentials remain server-only. Validate uploads/results and block garment redirects/credentials/nonstandard ports. No new database migration is needed for nullable cost: existing column/RPC accepts null; confirm with code/tests and later live schema evidence. Do not apply schema changes or destructive privacy operations without project identity, restorable backup and explicit scoped rehearsal.

## Execution and release gates

1. Implement bounded fixes with independent lanes and disjoint file ownership.
2. Review diffs, run focused tests then complete suite/typecheck/lint/build on final dependency graph. Do not mutate node_modules during test/build runs.
3. Real-browser checks: mobile/intermediate/desktop, both languages/themes, auth and menu transitions; authenticated dashboard/embedded/storefront tests require approved test identities.
4. Reconcile provider/library advisories and actual production configuration. Do not send chargeable generations, customer messages, real billing changes, destructive requests or production load tests as an implicit diagnostic.
5. Verify canonical production DB/Redis/provider identity, inherited privacy and billing gates, migration/rollback state and observability. Hold release if any security, ownership, financial or privacy gate is unverified.
6. Deploy only an explicit verified release candidate; verify its exact running SHA and meaningful downstream behavior. A HTTP200, successful build or rendered login form alone is not production readiness.

Progress/evidence is recorded in `docs/superpowers/checkpoints/2026-09-05-production-risk-closure.md`. No final price catalogue is selected by this plan.
