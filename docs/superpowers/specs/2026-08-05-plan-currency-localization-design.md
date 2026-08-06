# Plan names in Arabic, and prices in the visitor's currency

Date: 5 August 2026
Status: approved, ready for implementation planning

## Problem

Plan names render in English everywhere, including the Arabic UI, and every
price renders in USD regardless of who is looking. An Egyptian merchant reading
the Arabic pricing page sees "Launch — $15/mo" and has to do the conversion in
their head, for a product they will in fact pay for in EGP by Instapay or
Vodafone Cash.

This is a separate sub-project from
`2026-08-05-dashboard-i18n-parity-design.md`. That one closes the gap between
Arabic chrome and English page bodies on the try-on surface. This one concerns
how plans and prices are presented, on the public pricing page and in the
merchant-facing surfaces.

## Scope

**In:** Arabic names for the three plans, EGP catalog rows, country detection for
the public pricing page, a currency switcher, and currency resolution in the
Shopify panel.

**Out:** the top-up packs (`pack-lite-v1`, `pack-flash-v1`). They follow the same
pattern and should get EGP rows in the same pass, but their display surface is
the merchant plan card rather than the pricing page, so their UI work is separate.

**Out:** changing how anyone is billed. Payment stays manual per `PLANS.md`
phase 1. This changes what a price *says*, not how money moves.

## Decisions

| Question | Decision |
|---|---|
| EGP as real price or conversion | Real catalog rows, prices set by the owner |
| How the pricing page picks a currency | IP country lookup, with a visible switcher |
| Where the lookup runs | Locally, from a GeoLite2 database in the image |
| Existing USD subscribers | Unchanged — they keep the row they subscribed on |

### Why real rows rather than conversion

`PLANS.md` computes every margin against provider costs quoted in USD and states
that catalog rows are immutable once a subscription references them, so a price
change is a new row rather than an edit.

Live conversion would contradict both. The displayed price would drift daily, an
FX outage would leave the pricing page with no price, and an EGP devaluation
would quietly erode a margin that was calculated in USD — and EGP has moved
sharply in recent years. A fixed manual rate is no better: it creates a second
source of truth for price that can silently disagree with the catalog.

Owner-set EGP rows keep one source of truth and make the pricing decision
explicit, which is what it actually is.

## Design

### Plan names

Added to the plan copy in both languages:

| Key | English | Arabic |
|---|---|---|
| `free-v1` | Free | مجاني |
| `launch-v1` | Launch | انطلاق |
| `dfy-v1` | Done-for-you | خدمة كاملة |

`خدمة كاملة` — "full service" — is chosen over a literal rendering of
done-for-you because it is what a merchant would actually say. Modern Standard
Arabic, matching every other dictionary in the codebase.

This resolves the open question left in the i18n spec's allowlist section: plan
names translate. They are therefore *not* allowlisted as permitted Latin text in
the Arabic UI, so a future untranslated plan name fails the gate rather than
slipping through.

### Catalog rows

Three new rows: `free-v1-egp`, `launch-v1-egp`, `dfy-v1-egp`, with
`currency: 'EGP'` and `price_minor` set by the owner.

No migration is required — `currency` is already a column on the catalog table
and already flows through `lib/try-on/public-catalog.ts`.

Copy resolution already works: `getPlanCopyKey()` maps `launch-*` to `launch-v1`,
so an EGP row inherits the same name and description with no code change. Display
order continues to come from `sort_order`.

The pricing page filters catalog rows to the active currency and renders one card
per plan.

### Country detection

The `maxmind` npm package reading a `GeoLite2-Country.mmdb` file baked into the
Docker image. The lookup is local: no network call while rendering, and no third
party is ever sent a visitor's IP. The database is roughly 6MB.

`geoip-lite` is deliberately rejected: it bundles its dataset as an install of
around 150MB, and the VPS runs at about 91% disk.

The client IP comes from `x-forwarded-for`, which the app already reads at
`app/api/try-on/generate/route.ts:56` for rate limiting, so Traefik is passing it.

Country `EG` resolves to EGP. Every other country resolves to USD.

### Precedence

Highest first:

1. An explicit choice stored in a `gc-currency` cookie by the switcher
2. The country derived from the client IP
3. USD

A wrong guess therefore costs one click and then persists.

### The switcher

Always visible on the pricing page, not hidden behind a wrong guess. It writes
the cookie and refreshes, following the pattern `DashboardLocaleToggle` already
uses for locale — cookie write, then `router.refresh()`, because the price is
resolved server-side.

### Shopify panel

No guessing. Shopify supplies the shop's country, which is exact. The merchant
plan card resolves currency from that rather than from an IP.

### Caching

`/pricing` already builds as a dynamic route rendered per request, so varying by
IP introduces no stale-cache risk and requires no cache configuration change.

### Failure modes

All of these resolve to USD rather than erroring: the `x-forwarded-for` header is
missing, the IP does not parse, the country is absent from the database, or the
database file is missing from the image. A pricing page that renders USD is a
worse guess; a pricing page that throws is an outage.

## Testing

1. **Currency resolution** — a pure function mapping (cookie, country) to a
   currency, tested across: cookie set and disagreeing with country, no cookie
   with country `EG`, no cookie with another country, no cookie and no country,
   and an unrecognised cookie value.
2. **Catalog filtering** — given a mixed USD and EGP row set, the page renders
   exactly one card per plan in the active currency.
3. **Plan names** — both dictionaries expose all three names, and the Arabic
   dictionary contains no Latin plan name.
4. **Failure modes** — each of the four cases above resolves to USD.

The database lookup itself is not unit-tested; it is a third-party library
reading a data file. What is tested is the resolution logic around it, which is
where the decisions live.

Existing suite baseline is 83 files / 276 tests and must stay green.

## Risks

**The GeoLite2 database goes stale** between deploys. It refreshes whenever the
image is rebuilt, which at the current deploy cadence is acceptable, but it
belongs in the deploy notes so it is not forgotten during a quiet month.

**MaxMind requires a license key** to download the database. That key becomes a
build-time dependency. If it lapses, the build must still succeed and the app
must fall back to USD rather than failing — which the failure-mode design already
covers.

**Detection is wrong for VPN users, travellers and expats.** This is inherent, not
a defect, and is the reason the switcher is always visible rather than appearing
only when detection fails.

**EGP prices erode against USD-denominated provider costs** if EGP slides and the
rows are not revisited. Real rows make this visible and fixable by the owner; live
conversion would have hidden it until the margin was gone.

## To verify during implementation

- That `x-forwarded-for` is genuinely populated in production behind Traefik. If
  it is not, IP detection cannot work — and separately, the existing rate limiter
  is currently bucketing every visitor under `'unknown'`, which would be a real
  finding worth reporting.
- Whether the Shopify session or shop record already carries the shop's country,
  or whether it needs an additional Shopify API call.
- The actual EGP prices, which are the owner's decision. Round-number pricing is
  likely to beat direct arithmetic conversion: $15 converts to roughly 720 EGP,
  but 749 reads better and leaves headroom if EGP moves.
