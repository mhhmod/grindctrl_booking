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

## 2. Plans — re-audited

I checked the first draft's numbers against real usage data before finalizing anything. **There is none**: `widget_conversations` has zero rows across the two `widget_sites` that exist — this product hasn't taken real chat traffic yet. So this section is a first-principles audit of the *logic*, not a data-backed validation — and I'm saying that plainly rather than presenting invented precision as verified fact.

### What the first draft got wrong

**100 free conversations/month doesn't create upgrade pressure for the actual target customer.** Reasoning through the funnel: a small, early-stage Shopify store — the store actually installing a $0-entry chat widget for the first time — typically runs somewhere in the 500–3,000 monthly-session range. Chat-engagement rates for a proactive widget usually land in the low single digits of visitors, and only a fraction of those send an actual message. That funnel puts most such stores at roughly 5–90 real conversations a month, comfortably under 100. A free tier sized above where most of the target market actually lives isn't generous, it's a tier nobody ever needs to leave — which defeats the tier's purpose. It also breaks consistency with Try-On, whose 20-render free tier is deliberately *tight*: an active store burns through it in days, which is why it converts.

**Everything else in the first draft held up:**
- The Growth→Pro ratio (5x) and the Free→Growth ratio (10x) are both reasonable, standard SaaS step sizes — the ratios weren't the problem, the free tier's absolute size was.
- Unit economics have enormous headroom either way: `openai/gpt-oss-20b` on Groq costs a small fraction of a cent per reply, so even the tightest reasonable free tier costs nothing to actually serve. The free-tier ceiling is a conversion lever, not a cost-containment one — cost containment is what the attachment-storage gating is for, and that reasoning was already correct.
- $15/$5 anchored to Try-On's Launch/Boost-80 price points remains the right call for cross-product consistency, and I confirmed Try-On's real USD→EGP peg (exactly 1:50, both live EGP rows checked) rather than guessing at an FX rate — Store Chat's EGP prices now use that same peg.

### Revised numbers

| Plan | Price/mo | Conversations/mo | Knowledge entries | Photo attachments | Branding | AI escalation to human |
|---|---|---|---|---|---|---|
| **Free** | $0 | **50** | 10 | off | "Powered by GRINDCTRL" | on |
| **Growth** | $15/mo (750 EGP) | **500** | 50 | on | none | on |
| **Pro** | $39/mo (1,950 EGP) | **2,500** | unlimited | on + AI photo triage | none, priority support | on |
| Top-up | $5 (250 EGP) | **+250 conversations** | — | — | — | — |

Same 10x / 5x step sizes as before (so the tier *shape* is unchanged), applied to a free-tier anchor that sits inside the range where real target-market usage actually falls, not above it. Top-up halved to +250 to match — a top-up should read as "half a month more," not "a full month's allowance for less than the monthly price," which the original +500-for-$5 against a 500/mo Growth tier would have implied.

### One more gap: what happens at the ceiling

The first draft specified the numbers but not the failure mode when a free or metered site hits its cap mid-month. A hard stop — AI simply stops replying — is the wrong default: it's a bad shopper experience that reflects on the merchant, and it's exactly the kind of thing that shows up as a 1-star Shopify App Store review with no chance to fix it before the damage is done. Proposed behavior, modeled on Try-On's `grace_days` mechanic rather than invented fresh:
- **AI auto-reply turns off for new conversations once credits are exhausted; existing open conversations are unaffected.** A shopper starting a *new* thread sees the contact-capture flow instead (already built — `messenger_contact_capture`) so the merchant still gets the lead, just without automated AI handling.
- **The merchant sees the same `low` → `critical` → `exhausted` banner progression Try-On already has**, not a surprise cutoff — this reuses `getBannerState`'s thresholds directly rather than a new one-off scheme.
- No conversation or message data is ever blocked from being *read* — only new AI-handled conversations are gated. A merchant on a lapsed plan can still see and manually reply to everything through the dashboard.

**These are still a proposal, not a unilateral decision.** Tell me to adjust any number and I will, before implementation starts.

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

1. **The three price points and limits** (Free/Growth/Pro, $15/$39, 50/500/2,500 conversations) — confirm, or tell me what to change.
2. **Grandfathering**: existing sites start Free-metered immediately, or get a notice-then-grace period first?
3. Anything in section 4's file list that should NOT happen (e.g., if you want this dashboard-only for now, embedded-app Plan card can come later).

Once you confirm, this goes through the same process as every other feature this session: a full implementation plan via `writing-plans`, executed task-by-task through Codex with independent review before every commit, same as Phases 1–3.
