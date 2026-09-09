# GRINDCTRL Unified Pricing — Adversarial Audit Results

**Method:** 5 independent research sweeps -> 4 commercial-role proposals (CFO, Marketing, Sales, Customer Success), each designed blind to the others from the same evidence -> each proposal adversarially attacked by a dedicated critic on margin, conversion, cannibalisation, Shopify billing legality, and model reality -> synthesis. 14 agents, 5/5 research sweeps returned, 4/4 proposals produced, 4/4 adversarially judged.

**Headline: all four proposals failed review.** Scores 4-5/10, `survives: false` on every one. Not a tie-break between good options — every proposal shared the same fatal flaw, found independently four times.

## The flaw that killed all four

Every proposal computed its margin story against an **optimistic, unmeasured effective cost** for meta/muse-image (~$0.013-0.014/render — list price plus a guessed retry rate). meta/muse-image has **zero production renders** behind that number. When each critic stress-tested at 2-3x that cost — plausible given the model's documented weakness on "unusual poses / extreme perspective," which is exactly what a shopper selfie is — 2 to 4 of each proposal's 4-5 tiers broke the proposal's own stated margin floor. One critique caught a proposal's own text presenting a 2.72x multiple as a "pass" one paragraph after stating the rule required 3x.

## The one idea that survived, independently, four times

**Bundle Store Chat — unmetered — into every try-on tier.** All four critics, arguing from CFO, marketing, sales, and retention angles, separately named this the single load-bearing idea worth keeping regardless of what happens to render pricing. Reasons given independently but converging:
- It costs ~$0.005/conversation on a cost base that's actually measured (real production data), unlike every render number in every proposal.
- Verified market rate for an AI conversation elsewhere: Willdesk $0.20, Chatway $0.50, Tidio $0.65-0.78, Gorgias/Intercom ~$0.90-0.99, Zendesk $1.50-2.00. GRINDCTRL's cost sits 40-400x below market.
- Zero of 18+ competitor try-on apps sampled bundle AI chat. No chat vendor sells try-on either. It is unmatched from either direction without the competitor building the other product.

## New facts this audit surfaced (not known before this run)

- **Shopify App Pricing (the current, recommended billing system) cannot express a one-time charge at all.** Legacy Billing API can, but Shopify steers new apps away from it.
- **Shopify's App Events API always returns HTTP 202, even when the event fails billing validation — there is no failure webhook.** Any usage-based overage meter shipped without a reconciliation job risks serving-and-never-billing silently.
- **Meta withdrew a related consumer-likeness feature within 3 days of launch** under CAA/SAG-AFTRA pressure. muse-image ships under "limited preview" terms that were updated 5 days before this audit ran.
- Multiple critiques independently flagged (medium confidence, unverified against shopify.dev directly) that **Shopify usage meters may not attach to a bare yearly recurring plan** — only monthly or monthly-with-yearly-discount. This is why the final recommendation defers annual pricing.
- Shopify may cap public apps at 8 published plans; a monthly+annual variant of every tier could approach or exceed that, unconfirmed.

---

## Final recommended catalogue (synthesis, after resolving every fatal flaw or explicitly accepting the risk)

Priced against a **$0.025/render stress cost (2.5x list)**, not the optimistic $0.013 that broke all four proposals. This is the one point the synthesis overrules every specialist simultaneously.

| Tier | USD | EGP (1:50) | Renders/mo | Conversations/mo | Included $/render | Margin @ literal $0.010/render | Margin @ $0.025 stress cost |
|---|---|---|---|---|---|---|---|
| **Free** | $0 | 0 | 100 one-time on install + 15/mo after | 50/mo | — | n/a | n/a |
| **Launch** | $15 | 750 | 150 | 250 | $0.10 | 81.1% | 65.7% |
| **Growth** | $29 | 1,450 | 350 | 750 | $0.083 | 74.3% | 55.6% |
| **Pro** | $49 | 2,450 | 650 | 1,200 | $0.075 | 73.7% | 53.2% |

Steps: 1.93x then 1.69x (today: 3.9x in one jump). All three paid tiers clear >=50% margin even at the pessimistic stress cost.

**Deliberate scope cuts versus every one of the 4 specialist proposals:**
- **3 paid tiers, not 4-5.** Every specialist added a $79-89 top tier; cut as speculative surface area with zero paying customers and an unvalidated model yet.
- **No annual plans yet** — the unresolved usage-meter-on-yearly-plan risk above.
- **No retail-metaphor tier names** (Window/Counter/Floor, etc. — scored worst, no evidence it converts better). Ships as Free / Launch / Growth / Pro.
- **No prepaid top-up pack on Shopify App Pricing** — it's a one-time purchase, which that billing system cannot express. Replaced with a per-render overage meter, descending by tier ($0.16 / $0.13 / $0.11), checked against upgrade cannibalisation (overage never beats the next tier's included rate past a clean threshold).

### Done-for-you setup — resolved

Folded into **Pro ($49) as an included recurring benefit**, delivered day 10-14 of the first cycle (not day 1, to blunt the "take Pro once, collect setup, downgrade" leak). Labour capped at 2 hours, treated as CAC recovered from Pro's margin over ~2 months. Anything beyond included scope is a per-asset usage-metered add-on (e.g. "$2/product" for extra catalogue prep) — real work billed as usage, the compliant shape, not a disguised one-time charge.

### Ceiling behaviour

- **Renders:** admin banners at 80%/100%. At 100% with overage off (default), the try-on control simply doesn't render — no shopper-facing error. Never billed for a failed, refused, or timed-out render (extend the existing failure-path guarantee to refusals before this ships).
- **Chat:** never a hard stop, ever. Cost is too low to justify degrading a shopper-facing surface. Allowance is for expectation-setting only.

### Free tier logic

100 renders once on install (proves the model on the merchant's own garments in week one) + 15/month after (down from today's 20 — verified data shows only ~4% shopper engagement on sub-$50 items, so 20/month can fully satisfy a small store forever and never convert) + 50 chat conversations free (beats Willdesk's 20, beats Shopify Inbox's capability entirely).

### Positioning

Headline: *"Try it on. Ask about it. One subscription."*
Differentiator: *"The only Shopify app where a shopper can try on the outfit and ask a real question about it — in the same subscription, at no extra charge for the chat."*
Trust line: *"We never bill you for a render that didn't work."*

### Three biggest risks

1. **meta/muse-image has zero measured production cost or quality data.** Mitigation: $0.025 stress floor already absorbs a 2.5x cost miss — but not a quality failure (unusable output, not just expensive output). Gated by the validation step below.
2. **App Events API's silent-failure behaviour (202-always).** Mitigation: nightly reconciliation job between the jobs table and Shopify's accepted events, built before any overage meter ships.
3. **Single-provider dependency with a demonstrated pull-it-fast pattern.** Mitigation: keep the already-measured gemini-3.1-flash-lite path warm behind one config value, not deleted.

### Gate before launch (non-negotiable per the synthesis)

Run 40-50 real renders across real garments, real shopper poses (arm's-length, mirror, seated, partial body), multiple body types — **before** this catalogue goes live. None of the margin math or the "never bill a failure" trust promise means anything if muse-image's real accept rate on shopper selfies is materially worse than assumed.

---

## Full proposal and critique detail

Preserved in the workflow journal for reference (all 4 full proposals with per-tier rationale, and all 4 full adversarial critiques with worked arithmetic) at:
`C:\Users\HP\.claude\projects\C--Users-HP-Desktop-grindctrl-booking-apps-web-next\74d935ca-b521-4d80-911b-6c463d78ad36\subagents\workflows\wf_c9bc561a-6b0\journal.jsonl`
