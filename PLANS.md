# GrindCTRL Try-On: Plan Catalog and Policies (operator reference)

This is the commercial reference for the credits system. PLANS-DESIGN.md is the
engineering design (schema, transactions, enforcement); this file holds the
numbers and the policies as the owner and merchants experience them. Catalog
values live in database rows; changing them is a dashboard edit, never a code
change. All amounts USD, all timestamps UTC.

## Cost basis (why these numbers are safe)

| Model | Provider cost per render | Status |
|---|---|---|
| google/gemini-3.1-flash-lite-image | ~$0.03 assumed | Not yet measured; measure with one live render after the OpenRouter key is topped up |
| google/gemini-3.1-flash-image | $0.0682 | Measured from production job history |

Pricing rule: sell lite renders at or above $0.05, flash renders at or above
$0.12. Every paid plan must clear a positive margin at 100 percent credit
utilization; typical utilization (30 to 60 percent) is upside, never the thing
that makes a plan viable.

Re-price lever: if the measured lite cost is at or below $0.02, Launch may move
to $12 for 350 renders ($0.034 per render, still above 40 percent worst-case
margin) to make the value gap unarguable. Decision deferred until measured.

## Catalog v1

| Key | Name | Price /mo | Renders /period | Model | Period | Grace | Worst-case margin |
|---|---|---|---|---|---|---|---|
| free-v1 | Free | $0 | 20 | lite | 1 month | none | acquisition cost, max $0.60 |
| launch-v1 | Launch | $15 | 300 | lite | 1 month | 3 days | 40% |
| dfy-v1 | Done-for-you | $59 | 450 | flash | 1 month | 3 days | 48% |

Top-up packs (one-off, require an active or grace subscription):

| Key | Name | Price | Renders | Model | Validity |
|---|---|---|---|---|---|
| pack-lite-v1 | Boost 80 | $5 | 80 | lite | 365 days |
| pack-flash-v1 | Boost 75 Pro | $10 | 75 | flash | 365 days |

Done-for-you includes service, not just renders: GrindCTRL configures the
merchant's theme, tunes the widget to their brand, and does a monthly check-in.
That line is part of the offer and should appear wherever the plan is described.

Market position these numbers buy (verified July 2026): Launch at $0.050 per
render is the cheapest per-render subscription in the Shopify try-on category
(competitor entry plans run $0.13 to $0.20; the cheapest scale overage is
$0.12). The Free tier's 20 renders beats the category-standard 10.

## Policies

Versioning. Catalog rows are immutable once a subscription references them.
A price or volume change is a new row (launch-v2) plus deactivation of the old
one; existing subscribers keep their version until the owner moves them.

Billing period. Anchored to the activation timestamp, calendar arithmetic in
UTC, half-open interval start <= now < end. Anchor day 29 to 31 clamps to the
last day of shorter months and returns to the anchor day afterward.

Credits. Append-only ledger. Grant on activation and on each renewal; debit by
reservation before the provider is called; refund automatically on any failed
generation (merchant pays only for delivered images; GrindCTRL absorbs provider
cost on failures). Consumption order: plan credits before top-up credits;
within each, earliest expiry first.

Expiry and grace. Paid plans get 3 days of grace after period end: no new
credits, top-ups still usable, urgent banner shown. Payment during grace renews
from the old period end (anchor preserved). After grace the subscription is
expired: all generation stops, including remaining top-ups, until reactivation.
No automatic fall-back to Free.

Unused credits. Plan credits expire at period end, no rollover. Top-up credits
survive across periods until their own 365-day expiry but freeze while the
subscription is expired.

Upgrades. Immediate. The shop is granted only the difference between the new
plan's renders and what was already granted this period, so upgrade loops
cannot mint credits. Better model applies immediately. Cash difference is
settled manually by the owner.

Downgrades. Take effect at the next period boundary; nothing is clawed back
mid-cycle.

Free-tier abuse. One subscription per myshopify domain, forever. Uninstalling
never deletes the subscription, anchor, or ledger; reinstalling resumes the
current period's remaining balance and never backfills missed periods. A
genuinely new store domain is a new free tier; the owner reviews new shops in
the dashboard action queue.

Payment. Manual for phase 1: the owner invoices (Instapay, Vodafone Cash, bank
transfer, PayPal for foreign clients) and activates or renews from the
dashboard. Every owner action carries an idempotency key and a note field for
the payment reference. The schema reserves an activation source field so a
Merchant-of-Record webhook (Lemon Squeezy or Polar) can activate plans later
without schema change.

Reminders (no email infrastructure). Merchant admin banners: renewal due at 7
days, urgent at 3 days, grace banner during grace, expired after; low credits
at max(5, 20% of included), critical at max(2, 5%), exhausted at zero. Priority
when several match: expiry/grace, then exhausted, then critical, then low. The
top-up CTA opens a prefilled WhatsApp message to the owner naming the shop and
pack (mailto fallback); it never mutates billing state. Owner dashboard action
queue lists every shop within 7 days of period end, in grace, expired, or at
low/critical/zero credits.

Storefront behavior. Shoppers never see plan or payment language. Out of
credits or expired means the try-on button and catalog pill simply do not
render; mid-session exhaustion shows localized "Try-on is temporarily
unavailable. Please check back soon." The availability endpoint exposes only
available true/false plus a message key, cache-control no-store.

Rate limits versus credits. Rate limits (10/IP and 30/shop per 10 minutes)
absorb bursts and return 429 with Retry-After; they never consume credits.
Credits are the durable ceiling; entitlement failures return the stable code
TRYON_UNAVAILABLE and never reach the provider.
