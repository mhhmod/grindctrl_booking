# Store Chat Pricing & Plan System

**Date:** 2026-08-31
**Status:** Proposed — real numbers included, price points need your sign-off before implementation starts
**Scope:** Give Store Chat a real plan/entitlement system, structurally identical to Try-On's, so both products are billed, banner-nudged, and rate-limited the same way. Store Chat has none of this today — it's free and unmetered for every merchant, indefinitely.

---

## 1. What's actually true today (verified, not assumed)

**Try-On has a real, live, working plan system.** Queried the production database directly:

| Plan | Price | Renders/mo | Notes |
|---|---|---|---|
| Free | $0 | 20 | `is_free = true` |
| Launch | $15/mo ($750 EGP) | 300 | ~$0.05/render |
| Done-for-you | $59/mo ($2,950 EGP) | 450 | includes setup service |
| Top-up: Boost 80 | $5 | +80 renders | 365-day validity |
| Top-up: Boost 75 Pro | $10 | +75 renders | premium model |

Backed by real tables (`tryon_plans`, `tryon_subscriptions`, `tryon_credit_ledger`, `tryon_credit_packs`), atomic credit math done in Postgres RPCs (`reserve_tryon_credit`, `finalize_tryon_job`, `activate_tryon_plan`, etc.), and a `BannerState` machine (`renewal_due` → `urgent` → `grace` → `expired`, plus `low`/`critical`/`exhausted` credit warnings) that drives the UI. This is the thing to mirror, not redesign — it already works and merchants may already be used to its shape (1 real paid subscription exists in production today).

**Store Chat has zero plan/billing presence.** No `messenger_plans` table, no subscription check anywhere in the messenger code path, no line on `/pricing` (that page's title is literally "GrindCTRL AI Try-On Pricing" — Store Chat isn't mentioned). Every merchant who sets it up gets it free and unmetered, forever. That's the gap "the existing one is only for the trial" was pointing at.

**Abuse-prevention rate limiting already exists and is solid** — this is a different thing from plan-tier metering, and it's already handled:
- `app/api/messenger/send/route.ts`: IP-based (`publicApiRatelimit`, 10 req/10s), per-visitor-session (8 messages/60s), and order-lookup brute-force protection (20 attempts/hour).
- These stay exactly as they are. Nothing here needs touching — it's not what's missing.

**Store Chat's real unit cost is low, and metering it 1:1 with Try-On's renders would be wrong.** The chat model is `openai/gpt-oss-20b` via Groq — an open-weight model on a very cheap inference host, not a proprietary frontier model. A single reply costs a small fraction of a cent, nothing like Try-On's per-render image-generation cost. Metering Store Chat like Try-On (expensive-unit-capped) would produce absurdly generous or absurdly stingy limits depending which axis you copy. The right metering axis for a support-chat product is **conversations per month** — a proxy for support-desk value delivered, the same axis every live-chat SaaS (Intercom, Crisp, Tidio) actually prices on, not raw inference cost.

---

## 2. Proposed plans

| Plan | Price/mo | Conversations/mo | Knowledge entries | Photo attachments | Branding | AI escalation to human |
|---|---|---|---|---|---|---|
| **Free** | $0 | 100 | 10 | off | "Powered by GRINDCTRL" | on |
| **Growth** | $15/mo | 1,000 | 50 | on | none | on |
| **Pro** | $39/mo | 5,000 | unlimited | on + AI photo triage | none, priority support | on |
| Top-up: **+500 conversations** | $5 | — | — | — | — | — |

Reasoning, not just numbers:
- **$15 Growth matches Try-On's Launch price exactly.** A merchant already paying $15/mo for Try-On sees a familiar number for Store Chat, not a second, unrelated price scale to learn. This is the "consistency, coherence, unification" ask made concrete.
- **$5 top-up matches Try-On's cheapest pack ($5 Boost 80)** for the same reason — one psychological price point across both products.
- **100 free conversations is generous on purpose.** Since the real cost is inference-cheap, the free tier isn't rationed for cost reasons — it's bounded so a store with genuine ongoing shopper volume has a reason to upgrade, while a store just trying the feature never hits the wall by accident.
- **Photo attachments gated behind paid tiers**, not conversation count. Attachments carry real storage cost (90-day retention, per the existing triage code) and are the one place free-tier usage could genuinely run up a bill if unbounded — this is the actual cost-containment lever, not the conversation cap.

**These are a starting proposal, not a decision I've made unilaterally.** The one thing I won't do is quietly pick a final number and ship it — tell me to adjust any of these and I will, before writing a line of implementation code.

---

## 3. Architecture — mirror Try-On's shape exactly

New tables, same pattern as `tryon_*`, so the two systems share one mental model instead of two:

```
messenger_plans          (plan_key, name, price_minor, currency, conversations_included,
                           knowledge_limit, attachments_enabled, period_unit, period_count,
                           grace_days, is_free, active, sort_order)
messenger_subscriptions  (site_id, plan_id, status, current_period_start/end, grace_ends_at,
                           pending_plan_id, pending_plan_effective_at)
messenger_credit_ledger  (subscription_id, entry_type, amount, source_grant_id, plan_id,
                           credit_pack_id, expires_at)   — "credits" = conversations here
messenger_credit_packs   (pack_key, name, price_minor, currency, conversations, validity_days)
```

Subscribed by `widget_sites.id` (a site, matching how Store Chat is already tenanted post-Phase-1), not by shop domain directly — a site is the unit that gets a plan, same as `tryon_subscriptions` keys off `shop_domain` because a shop is Try-On's unit.

Reuse, don't reinvent:
- The RPC-driven atomic-credit pattern (`reserve_tryon_credit`-equivalent: `reserve_messenger_conversation`) — this is the part of Try-On's design that actually matters (race-condition-safe credit debits under concurrent requests), and re-deriving it from scratch risks the exact bugs Try-On's version presumably already found and fixed.
- `getBannerState`'s logic shape (`lib/try-on/entitlement.ts`) — same states, same thresholds philosophy, applied to `messenger_subscriptions` instead.
- `/pricing` gets a second section, not a second page — one page listing both products under one GRINDCTRL umbrella, consistent with the embedded-app rename work already shipped.

**What actually gets metered:** one credit consumed per *new* conversation started (not per message — a long back-and-forth with one shopper is one credit, matching "conversations/month" as sold). Reserved at the point `widget_conversations` gets its first row for a visitor, alongside the existing `publicApiRatelimit`/session-limiter checks in `app/api/messenger/send/route.ts` — abuse-rate-limiting and plan-metering are two different gates that both need to pass, not one replacing the other.

---

## 4. What changes where

- **New migration** (`supabase/messenger_plans.sql`, manual delta, same convention as every prior migration this project uses) — 4 new tables + RPCs. Reversible: a `DROP TABLE IF EXISTS` rollback block, same as `shopify_unified_app.sql`.
- **`lib/messenger/entitlement.ts`** (new, mirrors `lib/try-on/entitlement.ts`'s shape) — `getSiteEntitlement`, `reserveConversationCredit`, `ensureFreeMessengerSubscription`.
- **`app/api/messenger/send/route.ts`** — add the credit-reservation check alongside the existing rate limiters.
- **Dashboard**: a new "Plan" tab (or a card in Overview) showing the same banner-state UX Try-On already has, reusing `MerchantPlanCard`-style components where the shape matches.
- **Embedded Shopify app**: the same plan card renders in Store Chat's Overview tab automatically, since Overview is already shared between both surfaces (Phase 2's whole point).
- **`/pricing`**: add a Store Chat section.

**What does NOT change:** the existing `publicApiRatelimit`/session/order-lookup limiters, Try-On's tables or RPCs, anything about how conversations are stored or the AI reply flow itself beyond the one new credit-reservation call.

---

## 5. Known risks, named up front

- **Retroactive metering.** Every site using Store Chat today has zero subscription row. The migration must backfill a Free subscription for every existing `widget_sites` row (mirroring `ensureFreeSubscription`'s on-demand pattern, or a one-time backfill RPC) so nobody's chat silently breaks the day this ships.
- **Grandfathering.** Existing users get unlimited usage today; the honest move is a generous free tier (100/mo, above) rather than a hard cutover that makes an existing merchant's chat stop working mid-conversation history. Worth deciding explicitly: does an existing site start on Free, or does it get one "loyalty" period before metering kicks in? I'd default to starting everyone on Free with a clear in-dashboard notice, not a silent grandfather period — but this is a business call, flagging it rather than deciding it.
- **This is a schema change on a live table set** (`widget_sites` already has RLS/production traffic). Per this project's own Supabase conventions: reversible migration, pre-flight check for existing data shape, applied and verified against production before merge — same rigor as every migration this session has already run.

---

## 6. What I need from you before implementation starts

1. **The three price points and two limits** (Free/Growth/Pro, $15/$39, 100/1,000/5,000) — confirm, or tell me what to change.
2. **Grandfathering**: existing sites start Free-metered immediately, or get a notice-then-grace period first?
3. Anything in section 4's file list that should NOT happen (e.g., if you want this dashboard-only for now, embedded-app Plan card can come later).

Once you confirm, this goes through the same process as every other feature this session: a full implementation plan via `writing-plans`, executed task-by-task through Codex with independent review before every commit, same as Phases 1–3.
