# Try-on dashboard i18n integrity, and a settings parity audit

Date: 5 August 2026
Status: approved, ready for implementation planning

## Problem

A merchant switching the dashboard to Arabic gets a half-translated product: the
navigation and page titles are Arabic while the page bodies stay English. On the
try-on page this is glaring — the heading is Arabic and the table under it reads
"Merchant shops", "Shop", "Status", "Generations", "Plan and credits".

This is not a collection of missed strings. It is a boundary that was drawn and
never closed. `lib/dashboard/dashboard-i18n.ts:5` states the dictionary covers
"navigation, page titles, descriptions, breadcrumbs. Page bodies own" their copy.
Page bodies then hardcoded English: a pattern search for English sentence text in
JSX returns **roughly 159 matches across 22 dashboard components**, plus the page
files themselves. That figure is a heuristic lower bound, not an audited count —
it matches text between JSX tags and so misses strings passed as props. The order
of magnitude is what matters here: this is a surface-wide gap, not a few misses.

`app/dashboard/try-on/page.tsx` is the sharpest example. It imports
`getRequestLocale` at line 12, passes the locale down to the settings panel, and
renders its own copy in hardcoded English anyway. The locale is in scope and
unused.

The reverse direction reported — "Overview still has Arabic" — is not literal
Arabic in the Overview body. A search finds Arabic characters in only one
dashboard component, the locale toggle's own `العربية` label. What is being seen
is the Arabic chrome persisting around English bodies.

Separately, the dashboard and the Shopify embedded admin do not present the same
try-on settings experience, and it is not currently written down anywhere what
the difference is or whether it is deliberate.

## Scope

**In:** the try-on surface only — `app/dashboard/try-on/page.tsx` and
`components/dashboard/tryon-settings-panel.tsx` — plus an automated gate that
prevents new untranslated copy on that surface, plus a written parity audit.

**Out:** the other 20 dashboard components. They stay English for now. This is a
deliberate decomposition: the gate is scoped so it can be widened one page at a
time. A gate that lights up 159 findings on day one gets switched off.

**Out:** changing the scaffolding difference between the two surfaces. The audit
documents it; acting on it is a later decision.

## Decisions

| Question | Decision |
|---|---|
| How far to translate now | Try-on surface only, plus a gate |
| Parity between surfaces | Audit and document; change nothing yet |
| What Latin text stays Latin in Arabic | Brand name, shop domains, numbers, plan keys |
| Where the guarantee comes from | Types for completeness, a gate for bypass |

### Why types carry most of the guarantee

The requirement is "no English inside Arabic". That decomposes into two claims:

1. Every dictionary key has an Arabic value.
2. No user-facing string bypasses the dictionary.

Claim 1 is already free. A typed copy module with one interface and two
dictionaries makes an English-only key a compile error — the pattern
`lib/try-on/settings-copy.ts` already uses. No gate needed.

Only claim 2 needs enforcement, which is why the gate is narrow rather than a
general i18n framework.

### Why the gate has two parts

The try-on surface is two kinds of code and they are not testable the same way.

`app/dashboard/try-on/page.tsx` is an async server component behind Clerk auth.
Testing Library cannot render it, and driving it in Playwright would require a
signed-in session this project does not currently automate. So it gets a source
scan.

`components/dashboard/tryon-settings-panel.tsx` and the controls beneath it are
client components. They can be rendered, so they get a real render assertion —
which is strictly better, because it catches strings arriving through props,
through third-party components, or by concatenation, none of which a source scan
sees reliably.

Using the weaker technique where the stronger one is available would be a choice
to test less than we can.

## Design

### Copy module

`lib/try-on/dashboard-copy.ts`, following the shape of the existing
`lib/try-on/settings-copy.ts`:

- one exported interface naming every key
- `en` and `ar` dictionaries, both typed against it
- `getTryOnDashboardCopy(locale: SiteLocale)` returning the right one

It absorbs the try-on page's KPI labels, "Merchant shops" and its table headers,
"Plan and credits", and the panel's "Editing" label.

Arabic register: Modern Standard Arabic, matching every other dictionary in this
codebase. A single colloquial string among MSA reads as a mistake rather than a
voice.

### Gate, part one — Arabic render assertion

A test that mounts the settings panel with `locale="ar"` and walks the rendered
DOM, failing on any Latin-script text run that is not allowlisted.

Allowlist: the brand name, shop domains (`*.myshopify.com` and similar), digits
and punctuation, and plan keys (`free-v1`, `launch-v1`, `dfy-v1`).

Plan *names* are deliberately not allowlisted. If "Launch" should stay English in
the Arabic UI it must be an explicit dictionary value saying so, not an accident
of nobody translating it.

Resolved since: plan names translate — مجاني, انطلاق, خدمة كاملة. See
`2026-08-05-plan-currency-localization-design.md`. Keeping them out of the
allowlist is therefore load-bearing: an untranslated plan name must fail this
gate rather than pass as permitted Latin.

### Gate, part two — scoped source scan

A test reading `app/dashboard/try-on/page.tsx` and failing on JSX text children
and on user-facing string props (`aria-label`, `placeholder`, `title`, `alt`)
that are string literals rather than copy references.

It watches this one file. Widening it to another page is a deliberate act of
adding that path, which keeps each expansion reviewable.

### Parity audit

`docs/audits/2026-08-05-tryon-settings-parity.md`. A control-by-control table of
both surfaces, every row marked *same*, *dashboard-only*, or *Shopify-only*, with
a recommendation per divergence.

What is already known and must appear in it: both surfaces render the same
`TryOnSettingsControls` with the same `locale`, so the settings a merchant
actually chooses are identical. The divergence is entirely in the surrounding
scaffolding — the Shopify panel has product-page and catalog-page setup cards and
a `MerchantPlanCard`; the dashboard has a shop selector and surfaces plan and
credits at page level instead.

The audit changes no code.

## Testing

Three tests:

1. **Arabic render** — panel mounted with `locale="ar"` exposes no un-allowlisted
   Latin text.
2. **Source scan** — the try-on page holds no hardcoded user-facing literals.
3. **Copy completeness** — both dictionaries expose identical key sets at
   runtime. Types cover this at build time; this catches a dictionary assembled
   dynamically, where types would not.

Existing suite baseline is 83 files / 276 tests and must stay green.

## Risks

The allowlist is the weak point. Too permissive and the gate proves nothing; too
strict and it fails on a shop domain and gets disabled. It starts strict, and
every addition to it goes in with a comment saying why that text is legitimately
Latin.

Translating only one surface makes the inconsistency between the try-on page and,
say, the Leads page more visible, not less. That is accepted: the alternative is
a 22-component diff nobody can review carefully.

## To verify during implementation

- Whether `getRequestLocale` is already available in the panel's render path or
  must be threaded from the page. The page imports it; the panel receives
  `locale` as a prop, so this is likely already solved — confirm rather than
  assume.
- Whether any of the try-on page's KPI labels come from a server query rather
  than being literals. Data-derived labels need translating at the boundary, not
  in the dictionary.
