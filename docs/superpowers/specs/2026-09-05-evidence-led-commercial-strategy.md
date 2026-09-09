# GrindCTRL commercial strategy and evidence register

Date: 2026-09-05, Africa/Cairo.
Status: working strategy; not an approved price catalogue, revenue forecast, or authorization to publish offers.
Owner: GrindCTRL founder. Engineering/commercial analysis: this continuation.

## 1. The decision we are making

Build one coherent Shopify-focused SaaS offering combining Try-On and Store Chat, with the same authenticated shop, settings and entitlements in Shopify, GrindCTRL.cloud and storefront enforcement. Decide whom to sell to, what outcome to demonstrate, what service is included, what to charge, how to acquire and retain customers, and what evidence permits each commitment.

The user's requirement is a deliberate commercial strategy grounded in actual business records, not a collection of web findings or an open-ended experiment. A strategy can be explicit before every uncertainty is resolved; it cannot truthfully promise demand or profit that has not been observed. Missing evidence is a named work item, not permission to invent a number.

This document supplements the [pricing adversarial audit](2026-09-05-combined-pricing-adversarial-audit.md). Its A/B/C prices remain candidate configurations. In particular, A is a planning recommendation, not validated willingness to pay. No candidate is being deployed by this document.

## 2. Direction and commercial boundaries

| Decision | Working direction | Basis and remaining condition |
|---|---|---|
| Product | One SaaS account experience, two clearly defined usage meters | User requirement. Matching email is not shop authorization; ownership must be verified. |
| Initial customer profile | Shopify fashion merchant with suitable product photography, an identifiable buyer and a real product-page or support problem | Existing campaign targets owners of women's fashion, dress, abaya and modest-fashion stores. This is the starting segment, not proof it is the most profitable segment. Geography and priority subsegment require founder confirmation. |
| Positioning | A store-native product preview and store-grounded assistance, operated from one account | Fits the documented product direction. Show functioning capabilities; do not claim measured sales uplift, fewer returns, perfect fit or autonomous resolution without proof. |
| Quality | Same chosen image model and chat quality standards across all tiers, including Free | User requirement. Model suitability and delivered-result cost still require verification. |
| Packaging | Simple monthly shop-scoped bundles; distinguish images from bounded AI sessions | Clear customer units and bounded exposure. Exact quotas must reconcile customer demand, costs and buying evidence. |
| Paid entry | $15 is a design constraint, not a discovered optimal price | User requirement. If realistic service costs do not fit, change scope or revisit the constraint explicitly. |
| Human work | Routine technical support is a cost of SaaS; bespoke installation, catalogue work and recurring managed work need a separately scoped offer | Prevents quietly including agency labour in low-cost subscriptions. No service price or response-time SLA is approved yet. |
| Sales motion | Founder-led qualification and a private, relevant one-product demonstration; record a clear next action and commercial outcome | Existing campaign approach. No conversion rate or acquisition cost has been established. No outreach is authorized or sent by this document. |
| Growth investment | Establish attributable paid activation, retention and contribution before expanding paid acquisition | Operating decision to protect limited cash and service capacity, not a claim about an industry benchmark. |

### Resolve the managed-service conflict before publication

`apps/web-next/PRODUCT.md` describes an agency/managed service, while the user's newer request explicitly calls for a full SaaS ecosystem. `PLANS.md` promises theme configuration, brand tuning and a monthly check-in in the historic $59 Done-for-you plan.

Proposed reconciliation: SaaS is the core product; optional human implementation is a separately scoped service. Preserve existing contracted services and balances until the merchant accepts a supported migration. Do not silently rewrite historical contracts or sell new bundles as including their labour. The founder must approve the new boundary before product copy, quotes or catalogue changes. Existing product documents remain unchanged pending that decision.

## 3. Evidence register

Evidence categories: **requirement** = owner instruction; **current source** = inspected code/document or official source; **historical report** = earlier observation not refreshed against the underlying record; **assumption** = scenario input; **missing** = no supporting first-party record inspected. These are provenance labels, not a statistical confidence score.

| ID / claim | Evidence available | What it establishes | What it does not establish / closure requirement |
|---|---|---|---|
| E01 / $15 entry and shared quality | User requirement | Commercial constraints | Demand or profitability. Reconcile paid outcomes and all-in costs. |
| E02 / fashion-store focus | `apps/grindctrl-tryon/PRODUCT.md`, Users and Product Purpose | Intended buyer and one-product demo motion | Segment size, conversion or best geography. Review qualified/won/lost opportunities by segment. |
| E03 / existing paid customers | August 31 Store Chat plan reports one paid subscription; recovered later material conflicts | Need to preserve possible live commitments | Current paid count, cash collection or active contract. Reconcile subscription rows with invoices, receipts and merchant IDs. |
| E04 / image cost | `PLANS.md` historically reports $0.0682 for an older Flash model; audit records fal Muse's $0.01 list price | Historical model-specific pointer and external list price | Current OpenRouter/Muse delivered cost. Reconcile actual provider route, jobs, failures/retries and invoice. |
| E05 / chat cost | Audit records Groq token prices; August 31 document reported zero conversations | Provider tariff and historical lack of usage | $0.005 or $0.01 per-session cost, actual demand, retention. Capture complete per-session usage including context, tools, attachments and failures. |
| E06 / competitor context | Dated primary listings in pricing audit | Published competitor prices, units and terms at review time | Equal quality, our willingness to pay, or our being cheapest. Compare equivalent units/features and actual merchant alternatives. |
| E07 / healthy margins | Audit reproduces scenario arithmetic | Sensitivity under stated inputs | Net profit. Include infrastructure, labour, refunds, acquisition, fees and free customers; inspect actual costs. |
| E08 / conversion and support benefit | Product purpose only; no first-party outcome study inspected | Intended customer problem | Revenue lift, return reduction or labour savings. Obtain merchant baseline, comparable outcomes and permission to publish. |
| E09 / telemetry completeness | `lib/try-on/image-runner.ts` uses `usage?.cost ?? 0`; reviewed chat path does not aggregate full session cost | Cost measurement has known limitations | Zero cost when provider usage is missing. Mark unknowns and reconcile before using aggregates. |
| E10 / dashboard numbers | `analytics-preview.tsx` labels data “Sample / preview metrics” | Demo UI content | Actual visitors, conversions, sales or capacity. Exclude these numbers from all commercial calculations. |
| E11 / unified ecosystem | User requirement and product settings principle | Required experience | Production correctness. Verify account linking, shared state, metering and failures in the actual browser and backend. |

Do not promote an old agent's description of a database query into current database evidence. Store the source record/reference, extraction date, coverage period and relevant shop count beside every measured figure.

## 4. Required first-party evidence pack

Use read-only exports or existing authorized access. Store private data in an approved private location, not in this public-source repository. Redact customer identifiers from reports; no raw shopper photos, credentials or payment details belong in Git. Start with all available records, showing their actual date coverage and sample size; do not manufacture a cohort when the product is new.

| Pack | Minimum fields / records | Source owner | Acceptance check |
|---|---|---|---|
| Customers and cash | Pseudonymous shop ID, offer/version, currency, price, service promise, invoice/receipt reference, paid/refunded amount, activation, renewal, cancellation | Founder / billing account | Every counted paying shop ties to confirmed collection; explain complimentary, test, unpaid and refunded accounts separately. |
| Sales opportunities | Segment, country/language, store size where known, source channel, buyer role, problem, alternative, demo date, quoted offer, outcome, stated objection, next step | Founder / CRM / sales correspondence | Include losses and no-decisions, not just successes. Distinguish seller interpretation from recorded customer statements. |
| Usage and quality | Eligible product-page visits, widget starts, attempts, delivered results, merchant-accepted quality, chat sessions/replies, latency, failures, escalation, cancellations | Product / merchant analytics | Stable shop and period keys; denominator defined; no demo/bot/internal traffic silently mixed with customer usage. |
| Provider costs | Provider/model/version, request/job/session IDs, successful and failed billable attempts, token/image costs, retries, credits, invoice totals | Engineering / provider billing | Explain unallocated invoice spend and missing usage; unknown cost is never zero. Separate benchmark work from live use. |
| Operating cost and capacity | Hosting/storage/monitoring invoices, onboarding/support/managed-work minutes, loaded hourly cost, incidents and refund handling | Founder / operations | Count founder time, not just contractor invoices. Separate per-shop recurring work from one-off setup and fixed overhead. |
| Buyer value | Actual support questions, current workflow, purchase objections, baseline handling time, current tools/spend, decision authority, budget cycle | Merchant interviews + business records | Interview notes establish stated needs; receipts establish buying; observed outcomes establish value. None substitutes for the others. |

If customer or usage history does not exist, mark it absent. Conduct structured buyer discovery and bounded real-product verification with consent and an approved spend limit; do not claim that external benchmarks fill the gap. This is evidence gathering inside the strategy, not a substitute for choosing a strategy.

## 5. Pricing decision method

Select an offer at the intersection of three constraints: a customer who has a reason and ability to buy, a usage bundle they understand, and sufficient contribution after the actual cost to serve. Competitor prices are a reasonableness check, not the formula.

1. **Value:** document the merchant's problem, baseline and existing alternative. Demonstrate a relevant item and real store questions. Ask what work or buying objection the product changes. Record actual quotes and purchases rather than treating “looks good” as willingness to pay.
2. **Usage fit:** use distributions by target segment and billing period, not one pooled average. Count how many real shops each candidate serves, expected exhaustion points and each shop's image/chat mix. Do not force a larger tier solely because the unused companion product has a large allowance.
3. **Cost floor:** recompute each candidate at full included use and observed stressed delivery costs. Include reserved/in-flight work, quality remedies, routine support and applicable billing fees. Test each product meter independently and together.
4. **Service capacity:** calculate hours promised per customer and affordable service capacity. A bundle that only works if founder labour is free is not commercially approved.
5. **Buying evidence:** reconcile accepted, rejected and no-decision offers in the intended segment. A single paid deal proves that deal, not a general conversion rate or optimal price. Report uncertainty and selection bias.
6. **Approval:** founder signs one catalogue version, contribution floor, acquisition budget/payback limit, service boundary and migration policy. Record tradeoffs and the evidence IDs. Do not pick by agent vote.

No percentage margin floor, minimum interview count, marketing budget, quota or forecast is being presented as evidence-derived today. These must be explicit owner policies or measured outputs, visibly labelled as such.

### Reproducible economics

For a selected currency and a defined billing cohort:

```text
net_collections = receipts - refunds - payment/platform fees - collected tax liability
effective_image_cost = all attributable image-provider spend / delivered billable images
effective_session_cost = all attributable chat-related spend / successfully admitted billable sessions
recurring_contribution = net_collections - provider spend - variable infrastructure
                        - routine support labour - ongoing managed-service labour
total_acquisition_spend = attributable channel spend + sales labour + demo spend
                          + attributable free-customer acquisition costs
customer_acquisition_cost = total_acquisition_spend / acquired_paying_customers
cohort_net_contribution = recurring_contribution - one_off_onboarding_cost
                         - total_acquisition_spend
cash_surplus_after_stated_costs = sum(cohort_net_contribution) - remaining_fixed_overhead
```

Zero delivered units or zero acquired paying customers makes the respective ratio undefined, not free. Avoid counting refunds, labour or free acquisition twice. State the attribution method for shared invoices. These are cash-based management calculations, not accounting operating profit; forecast cash collection separately from revenue recognition. Compute payback from cumulative realized contribution; do not infer lifetime value from an unobserved churn rate. Actual payment/tax treatment must follow the confirmed billing setup.

The existing audit's base/downside/severe inputs remain sensitivities. Missing cost telemetry must be resolved or conservatively bounded and explicitly approved; it cannot be hidden by a positive API-only margin.

## 6. Sales and marketing playbook

### Qualify before quoting

Confirm the buyer controls a suitable Shopify store, the products and photos are supported, the relevant problem occurs, the buyer can authorize a subscription, and expected usage fits the offer. Ask about language, current support staff/tools, desired launch date and whether they require hands-on implementation. Record unknowns. Do not promise unsupported integrations or garments to close the deal.

### Demonstrate the merchant's use case

Use one merchant-approved product and consented input images. Show actual output, limitations and failure recovery; show store-grounded answers and handoff with the merchant's own information. Explain what counts, what happens at limits and who handles support. If the feature is staged rather than live, label it. A demo is product proof, not proof of conversion lift.

Working positioning statement: “Let shoppers preview selected products and get store-specific help, with your settings managed in one account.” Publish only after those capabilities and their boundaries are verified.

### Make a consistent written offer

Every proposal records shop, plan/version, monthly price/currency, both allowances and unit definitions, included/excluded service, charge/renewal/cancellation terms, data handling, limits, implementation prerequisites, and a named next action. No undocumented discount, unlimited usage, guaranteed revenue improvement or 24/7 human service. Any discount requires founder approval and a recalculated contribution check.

### Handle objections with proof

- “Will it increase my sales?” Show only attributable observed results; otherwise demonstrate the workflow and agree what the merchant will measure. Do not guarantee uplift.
- “Another app is cheaper.” Compare its actual units, supported use case, quality and service scope. Do not use the obsolete “cheapest” claim.
- “I do not have time to set it up.” Show verified onboarding; separately scope human work if needed.
- “What if I use all the allowance?” Explain warnings, permitted ongoing work and shopper-safe fallback. Do not invent an overage feature that has not shipped.
- “Why pay for two products?” Explain each product's relevance to this merchant. Record bundle objections; do not assume every buyer values both equally.

### Activate, retain and expand

Define activation as the merchant successfully configuring and verifying the intended shopper journey, not merely installing. Record setup work and first usable result. At renewal, review actual usage, reliability, value and unresolved issues. Recommend a larger bundle because of recorded needs, not opaque pressure. Capture cancellation reasons in the merchant's words and distinguish price, low demand, quality, onboarding and missing features.

Start with the existing founder-led demonstration motion. Expand a channel only when its attributable customer contribution and service load are understood. There is no evidence-backed ad budget or conversion forecast yet; market size estimates and competitor traffic are not substitutes.

## 7. One commercial contract across the ecosystem

| Contract element | Must match | Verification before release |
|---|---|---|
| Identity and ownership | Dashboard account, Shopify shop link and server-derived storefront shop | Account can access only verified shops; changing email does not transfer ownership. |
| Settings | Dashboard and embedded settings write the canonical shop record; storefront reads effective settings | Save from each surface, refresh the other, verify widget; test unauthorized writes and failures. |
| Catalogue | Approved immutable version, currency, allowances and service description | Pricing page, quote, checkout, receipt and both admin surfaces agree. |
| Billing and balances | Confirmed subscription state and two server-enforced ledgers | Replayed events, renewals, concurrent requests, failed jobs and period boundaries cannot double charge/grant. |
| Exhaustion and failure | Merchant warnings plus shopper-safe fallback, no secret errors | Test actual success, loading, error, exhausted and recovery paths, EN/AR and mobile/desktop. |
| Existing promises | Original paid/free grants, packs, expiry and contracted service | Reconciled inventory, explicit accepted migration, rollback and reconciliation evidence. |

This is an acceptance contract, not a claim those checks are already complete. The detailed metering proposals remain in the pricing audit and need a scoped engineering design after commercial selection.

## 8. Decision gates and next work

| Gate | Owner / work | Required output | Present status |
|---|---|---|---|
| 1. Commercial identity | Founder confirms priority segment/geography and SaaS versus separately sold human work | One signed positioning and service-scope brief | Awaiting founder context; recommendation above is explicit. |
| 2. Baseline | Founder provides records; analyst reconciles sales, costs, commitments and usage | Dated evidence pack with gaps and coverage | Source locations/access not yet provided; no current private records inspected. |
| 3. Decision economics | Finance/engineering measures missing cost and joins usage with quotes | Per-option contribution, capacity and customer-fit report | Scenario math exists; actual business inputs incomplete. |
| 4. Offer selection | Founder chooses or revises catalogue using that report | Approved version, policies, migration and funded acquisition limits | A/B/C are not approved for publication. |
| 5. Product readiness | Engineering implements selected shared contract and independent QA reviews | Test results, real-browser proof, billing reconciliation and documented blockers | Separate work; mobile sign-in fix does not establish ecosystem readiness. |
| 6. Commercial rollout | Founder authorizes publication and channel execution | Consistent copy/quotes, onboarding, reporting ownership and review date | Not authorized by this document. |

At each commercial review, report the denominator and period for qualified leads, demos, paid activations, collections, refunds, renewals/cancellations, usage, successful deliveries, support hours and contribution. Show outcomes by target segment/channel rather than hiding them in a blended total. Record changes with a reason and evidence reference; do not change prices reactively after every isolated objection.

Proposed management cadence, subject to founder confirmation: founder-led weekly pipeline/support/capacity review and monthly cohort/economics review. Engineering owns the reliability and telemetry evidence; the founder owns pricing, service capacity and spend decisions. This is a proposed operating policy, not an evidence-derived benchmark or a scheduled automation.

## 9. Sources and interpretation limits

- [Completed pricing audit](2026-09-05-combined-pricing-adversarial-audit.md): primary provider, competitor and Shopify links, corrected claims, arithmetic and candidate policies. External prices are dated context, not demand evidence.
- [Historical product direction](../../../apps/web-next/PRODUCT.md): managed service and common-settings principles.
- [Campaign buyer and demonstration direction](../../../apps/grindctrl-tryon/PRODUCT.md): intended buyer, not measured customer research.
- [Historical commercial catalogue](../../../PLANS.md): old prices, model costs and service commitments; not current eligibility, exchange-rate or competitive proof.
- [August 31 Store Chat proposal](2026-08-31-store-chat-pricing-plan.md): historical paid-account/zero-traffic reports and proposed metering; later verification required. Its unreferenced store-traffic and conversion claims are not adopted here.

No new sales message, campaign, chargeable model run, price change, database write, subscription migration or deployment was performed to produce this strategy.
