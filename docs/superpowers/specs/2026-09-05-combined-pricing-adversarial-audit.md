# Combined Try-On and Store Chat pricing: completed adversarial audit

Date: 2026-09-05, Africa/Cairo.
Status: decision memo; proposed commercial options, not an approved catalogue or implementation specification.
Scope: complete the interrupted Claude pricing audit. No product code, database, billing configuration, subscription, model setting, or deployment changed in this audit.

Continuation: the [evidence-led commercial strategy](2026-09-05-evidence-led-commercial-strategy.md) now defines the sales process, service boundary, evidence register and first-party decision gates. Selecting A/B/C alone is not approval to publish; actual cost, customer commitments and buying evidence remain incomplete.

## Recovered checkpoint and review coverage

Claude session: `74d935ca-b521-4d80-911b-6c463d78ad36`, titled **Adversarial audit session**.
Workflow: `wf_c9bc561a-6b0`, stopped on September 5 at 14:37 Cairo.
Five research results and four role proposals were saved; only the Sales critique completed. Three critiques and final synthesis failed at the usage limit.

Source journal on this computer:
`C:/Users/HP/.claude/projects/C--Users-HP-Desktop-grindctrl-booking-apps-web-next/74d935ca-b521-4d80-911b-6c463d78ad36/subagents/workflows/wf_c9bc561a-6b0/journal.jsonl`.

This continuation completed independent CFO, marketing, and retention critiques and rechecked selected primary sources. The archived Sales critique was retained but its mistaken competitor and blanket one-time-billing conclusions were corrected. This is a bounded commercial review, not proof of exhaustive market coverage or live product readiness.

| Original proposal | Review outcome | Principal reason |
|---|---|---|
| CFO: $15/$29/$49 | Reject as written | Effective costs were assumptions; the upper tier failed its own downside margin floor; annual/setup billing mechanics were flawed. |
| Marketing: $15/$29/$49/$79 | Reject as written | False cheapest-competitor premise, uncosted human service, and unverified paid capabilities. |
| Sales: $15/$29/$49 | Reject as written | Unlimited chat and free regeneration exposure; onboarding excluded from costs; annual/usage conflict. |
| Retention: $15/$29/$49/$89 | Reject as written | Buffers and annual discounts broke its stated margins; never-stop AI had no spending bound. |

The reviewers agreed on defects, not on one optimal quota. Marketing favoured closer prices and more usage; finance favoured lower allowances. The recommendation below is the lead synthesis, not a claim of unanimous endorsement or measured willingness to pay. A subsequent finance check reproduced every proposed downside percentage; finance and retention accepted A as a provisional choice, with B more resilient in percentage terms and at severe costs.

## User requirements carried forward

- Paid entry remains $15.
- Bring tier prices closer together and include both Try-On and Store Chat.
- Use Muse for image generation on every tier; no Lite/Pro model quality distinction.
- Present clear options before changing prices.
- Show the same verified shop account, settings, plan and balances in Shopify and GrindCTRL.cloud.

Muse here refers to the image model. It does not replace the text model with an image model. Store Chat's current text model is GPT-OSS-120B, with no proposed tier-based quality change.

## Corrected evidence

1. **Muse list price is not delivered-result cost.** The [fal Muse edit page](https://fal.ai/models/meta/muse-image/edit) lists $0.01/image. Failed attempts, replacements and provider-specific fees affect the cost per billable result. The repository currently routes generation through OpenRouter with a configurable model; the deployed model and that route's actual invoice were not checked. Do not assume fal's price proves the current deployment's cost or compatibility.
2. **Chat cost was never established as a measured $0.005/session.** [Groq's model page](https://console.groq.com/docs/model/openai/gpt-oss-120b) lists $0.15/M input and $0.60/M output tokens. A session's total includes repeated context, tools, attachments and retries. The inspected messenger completion path did not aggregate provider token usage into a per-session cost ledger. The August 31 document itself reported no real chat traffic then.
3. **The competitor argument for halving the entry allowance was false.** [Envision](https://apps.shopify.com/envision) lists $9/month for 250 try-ons; [Vue](https://apps.shopify.com/vue) lists $20/month for 200. Prices alone establish neither equivalent quality nor that $15/300 is commercially wrong. [Dimenso](https://apps.shopify.com/virtualtryon) sells sessions and separate 3D-generation allowances; do not silently equate those to single generated images.
4. **Chat comparisons must use the correct billing period and product.** [Tidio's Shopify listing](https://apps.shopify.com/tidio-chat) lists Lyro AI at $39/month with up to 200 conversations; $390/year is a different payment commitment. Its separate Customer Service product is not established as a mandatory additional purchase for that offer.
5. **Shopify is not simply free below $1M.** Its [revenue-share rules](https://shopify.dev/docs/apps/launch/distribution/revenue-share) specify a 2.9% processing fee, applicable taxes and possible regional fees. The 0% revenue-share band has eligibility and associated-account conditions; revenue counted from January 1, 2025 is described in the current rules. Account eligibility was not checked. Model a 15% revenue-share sensitivity too.
6. **One-time purchases are supported through a different billing route.** [Shopify's billing guide](https://shopify.dev/docs/apps/launch/billing) directs unsupported models and one-time purchases to Manual Pricing. [One-time purchase documentation](https://shopify.dev/docs/apps/launch/billing/manual-pricing/support-one-time-purchases) documents the Billing API. This does not establish the app's current enrollment or that arbitrary mixtures of systems are safe. Genuine setup must have a defined deliverable, price and supported charging path.
7. **App Pricing constraints matter.** [Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing) does not natively support one-time purchases or usage caps; usage cannot combine with yearly-only plans. Subscription state comes from the Partner API, not trusted redirect parameters. Initial fixed monthly bundles avoid the disputed annual/usage combinations. A change of billing system still needs an explicit migration design.

## Three concrete catalogue options

All prices are proposed USD per month per shop, before applicable taxes. Every cell below is **monthly price / delivered Try-On images / AI-assisted chat sessions**. No pooled multi-shop allowance is promised. Features and quality are common; usage is what changes.

| Option | Launch | Growth | Scale | Tradeoff |
|---|---|---|---|---|
| **A: balanced, recommended** | **$15 / 200 / 150** | **$29 / 400 / 350** | **$49 / 700 / 650** | More usage and contribution dollars at the upper tiers; three understandable paid choices. |
| B: closest price steps | $15 / 200 / 150 | $25 / 325 / 250 | $39 / 500 / 450 | Smaller $10 and $14 steps, lower included volume. |
| C: more generous usage | $15 / 300 / 150 | $29 / 600 / 350 | $49 / 1,000 / 650 | Retains 300 images for new $15 customers; materially less downside cost headroom. |

Recommended common Free proposal: 20 images and 25 AI-assisted sessions per month, same models and core functionality, with GRINDCTRL attribution. No additional 100-image install bonus initially. These are new-customer proposals; preserve existing commitments during migration. Free remains a costed acquisition experiment, not a proven conversion mechanism.

Why A: it replaces the existing $15-to-$59 jump with $14 and $20 steps, increases both allowances faster than price, and retains more room for real service costs than C. B is preferable if lowest sticker-price gaps are the priority. C should wait for measured delivery costs and a consciously funded acquisition plan. None is established as the revenue-maximising choice.

The A/B entry allowance of 200 is deliberately a new bundle proposal, not a silent reduction of existing $15/300 contracts. It is a cost-risk choice; competitor prices do not make it mandatory. Existing customers may prefer their old plan and must retain that choice under the migration policy.

## Reproducible cost scenarios

These are planning assumptions, not measured production costs or profit forecasts. All included usage is exhausted in each calculation.

| Scenario | Cost per delivered image | Cost per bounded AI session |
|---|---:|---:|
| Base | $0.014 | $0.005 |
| Downside | $0.020 | $0.010 |
| Severe | $0.030 | $0.020 |

`net_receipts = price * (1 - 0.029 - revenue_share_rate)`
`api_cost = included_images * effective_image_cost + included_sessions * effective_session_cost`
`api_contribution = net_receipts - api_cost`
`api_contribution_percent = api_contribution / net_receipts * 100`

The table uses 0% revenue share conditionally. Tax/regional-fee effects, infrastructure, support, refunds, free-cohort acquisition and onboarding are excluded. A positive API contribution is not business profit. Severe is another sensitivity, not an upper bound on an abusive or unbounded service.

| Option/plan | Net receipts | Base API cost | Downside API cost | Downside dollars left | Downside contribution | Severe contribution |
|---|---:|---:|---:|---:|---:|---:|
| A Launch | $14.565 | $3.55 | $5.50 | $9.065 | 62.2% | 38.2% |
| A Growth | $28.159 | $7.35 | $11.50 | $16.659 | 59.2% | 32.5% |
| A Scale | $47.579 | $13.05 | $20.50 | $27.079 | 56.9% | 28.5% |
| B Launch | $14.565 | $3.55 | $5.50 | $9.065 | 62.2% | 38.2% |
| B Growth | $24.275 | $5.80 | $9.00 | $15.275 | 62.9% | 39.2% |
| B Scale | $37.869 | $9.25 | $14.50 | $23.369 | 61.7% | 36.6% |
| C Launch | $14.565 | $4.95 | $7.50 | $7.065 | 48.5% | 17.6% |
| C Growth | $28.159 | $10.15 | $15.50 | $12.659 | 45.0% | 11.2% |
| C Scale | $47.579 | $17.25 | $26.50 | $21.079 | 44.3% | 9.6% |

At 15% revenue share, A's downside dollars left fall to $6.815/$12.309/$19.729. Actual operating costs must fit inside these dollars. For illustration only, allocating $3/$4/$6 per paying shop for infrastructure and routine support leaves $6.065/$12.659/$21.079 at 0% revenue share in the downside scenario; these allocations are not actual costs.

The common Free proposal costs $0.405/month in the base scenario and $0.65/month in downside, before infrastructure/support. Twenty fully active free shops per paying shop would consume $13/month at downside. That is a sensitivity, not a forecast, and shows why cohort-level free spend must be measured alongside conversion.

## Customer contract to carry into a selected design

- One render means a generated, validated image made available for retrieval. Transport retries and polling reuse the same job. Provider failure/refusal or a result never made retrievable restores the reservation. A deliberate new generation uses another clearly disclosed render. Subjective complaints receive a per-result review/credit policy, not unlimited regeneration or blanket refunds.
- One AI session starts at the first substantive successful AI answer and lasts a fixed 24 hours, with at most 20 successful AI replies, not 20 HTTP attempts. Attribute the unit to the billing cycle in which that first answer succeeds; crossing a monthly reset does not create another unit. Refresh/reopen does not create a second unit. The transcript outlives the metering window. Immediate contact capture/handoff before an AI answer is not counted; later escalation does not erase delivered AI work.
- Advertise that reply bound beside the session definition. At the bound, retain the conversation in manual/leave-message mode. Do not count another session automatically within the same 24-hour window to evade the advertised limit.
- Use identical models, grounding, safety and output standards on all plans. Do not reduce context or safety to conceal exhaustion. Attachments need a common published size/count and cost envelope, rather than an unlimited implied entitlement.
- Show merchant warnings at 80%, 95% and 100%. Finish reserved jobs and already admitted chat sessions within their stated bounds; reserve their cost in advance. At exhaustion, suppress new Try-On starts and keep contact capture, merchant-authored help and manual replies available. Never show an internal provider/billing error or promise notification before delivery succeeds.
- Extra charges are off by default. Initial proposal uses fixed monthly subscriptions. Optional extra usage belongs in a later verified design, with explicit rates and an atomic merchant-set monetary ceiling covering in-flight work. Do not fabricate one-time service fees as recurring usage or assume an HTTP acceptance proves settlement.
- Same immutable plan version and balances must appear in Shopify, GrindCTRL.cloud and storefront enforcement. Authenticate the account and prove shop ownership; matching email alone is not authorization. One account can manage multiple shops, each with its own subscription and ledger scope.
- Preserve existing paid prices, allowances, purchased credits, expiry terms and contracted services until an accepted migration. Preserve already-promised free bonuses too, with stable-shop grant history preventing reinstall duplication. Check authoritative subscription records before rollout: historic documents disagree on whether a paid subscriber exists. Upgrades/downgrades must respect confirmed billing periods and avoid duplicate grants. New chat allowances are not silently added to old contracts without costing the transition; do not silently cut off currently promised chat access either.
- Human installation/catalogue services, priority-latency promises, multi-store pools, public APIs and retained-photo archives are excluded from these prices. Offer scoped setup separately only after cost, capacity and its billing route are verified. Technical support remains an operating cost, even with self-service setup. Manual inbox replies mean the merchant's own staff, not included GRINDCTRL agents or 24/7 staffing.
- Do not display a hardcoded EGP conversion as a guaranteed Shopify charge. Show USD billing clearly; any local estimate must be identified as an estimate. Separate directly billed non-Shopify customers need a later currency/billing design.

## State of the repository and next implementation boundary

Read-only source checkpoint: `main` at `92f4d0f`. The August 31 master plan is older than subsequent fixes and must not be treated as current release proof.

The fallback catalogue still contains Free 20, Launch $15/300, Done-for-you $59/450 and model-specific packs in `apps/web-next/lib/try-on/public-catalog.ts`. The image runner uses `TRYON_MODEL` or a Gemini default through OpenRouter. Store Chat uses GPT-OSS-120B and a separate vision path. A database plan row alone does not prove Shopify has collected payment. No deployed configuration was inspected in this audit.

After the commercial option is selected, write a scoped implementation design covering the canonical catalogue, verified shop/account linking, two usage meters, billing-system enrollment and subscription synchronization, provider adaptation, existing-customer migration, failure handling and browser QA. Keep catalogue publication behind proof of measured costs and the shared entitlement flow.

Before promising Muse performance or these allowances, run a representative garment/person evaluation with consented test images, measure total provider spend per delivered result and per chat session, and verify both language directions. No chargeable generation was run during this audit; billing access is not needed to choose between these proposed commercial shapes.

Audit completion: five archived research outputs reused, all four original proposals now critiqued, targeted primary-source refresh completed, scenario arithmetic recomputed. Remaining work is a business selection followed by implementation and real verification, not another full research restart.
