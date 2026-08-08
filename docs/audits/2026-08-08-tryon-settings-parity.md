# Try-on settings: dashboard vs Shopify panel

Date: 8 August 2026
Status: audit only — no code changed by this document

Requested because the two surfaces "don't feel consistent with each other".

## Summary

The settings a merchant actually chooses are **already identical**. Both surfaces
render the same `TryOnSettingsControls` component with the same `locale` prop,
writing to the same record. There is no divergence in the controls themselves.

What differs is the scaffolding around them, and almost all of it is defensible:
the dashboard is an operator view across many shops, the Shopify panel is one
merchant's view of their own shop. Those are different jobs and they justify
different surroundings.

One divergence is **not** deliberate and is worth fixing: a width cap in the
Shopify panel silently disables the two-column preview layout there.

## Control inventory

| Item | Dashboard | Shopify panel | Same record | Verdict |
|---|---|---|---|---|
| Widget appearance controls (`TryOnSettingsControls`) | yes | yes | yes | **same** |
| Live preview (`WidgetPreview`, five tabs) | yes | yes | n/a | **same** |
| Save button | yes | yes | yes | **same** |
| Shop selector | yes | no | n/a | dashboard-only |
| KPI row (installed shops, generations, avg time, spend) | yes | no | n/a | dashboard-only |
| Merchant shops table | yes | no | n/a | dashboard-only |
| Recent generations list | yes | no | n/a | dashboard-only |
| Shopify app install card | yes | no | n/a | dashboard-only |
| Plan and credits — `ShopPlanControl` (activate, grant) | yes | no | yes | dashboard-only |
| Plan and credits — `MerchantPlanCard` (read-only) | no | yes | yes | Shopify-only |
| Product pages setup card | no | yes | n/a | Shopify-only |
| Catalog pages setup card | no | yes | n/a | Shopify-only |
| Brand logo header | no | yes | n/a | Shopify-only |
| Theme toggle | shell chrome | own button | n/a | different by necessity |

## Divergences, each with a recommendation

### Plan surface differs by role

**What differs:** the dashboard renders `ShopPlanControl`, which can activate a
plan and grant credits. The Shopify panel renders `MerchantPlanCard`, which is
read-only.

**Why:** `PLANS.md` puts payment outside the app — the owner invoices and then
activates. A merchant must be able to *see* their plan and must not be able to
grant themselves credits.

**Recommendation:** keep apart deliberately. Converging these would be a
privilege-escalation bug, not a consistency win.

### Product-page and catalog-page setup cards are Shopify-only

**What differs:** two cards linking into the Shopify theme editor to place the
try-on entry points.

**Why:** they deep-link into a specific merchant's theme editor. The dashboard
operator view spans many shops and has no single theme to open.

**Recommendation:** keep apart. If an operator ever needs it, the honest form is
a per-row link in the merchant shops table, not a copy of these cards.

### Shop selector and oversight widgets are dashboard-only

**What differs:** shop selector, KPI row, shops table, recent generations.

**Why:** the Shopify panel is inherently scoped to one shop, which Shopify itself
identifies. There is nothing to select and no cross-shop view to show.

**Recommendation:** keep apart.

### The width cap silently disables two-column preview in Shopify

**This is the one that is accidental.**

**What differs:** `components/shopify/admin-settings.tsx:129` wraps the panel in
`max-w-3xl`. That is exactly **48rem**, which is exactly the `@3xl` container
threshold `components/try-on/settings-controls.tsx` uses to switch the preview
into its own sticky column.

The container can therefore never exceed the threshold, so in the Shopify panel
the preview always sits above the controls and scrolls away, no matter how wide
the merchant's screen is. In the dashboard it moves beside the controls.

**Why it happened:** nobody chose 48rem twice on purpose. One value is a
readability cap that predates the container-query work; the other is the layout
breakpoint chosen during it. They collided.

**Is it harmful?** Not today. The original defect was the preview covering the
controls, and a preview that scrolls away cannot do that — so Shopify gets a
correct outcome by accident. But it is fragile: changing either number changes
the Shopify layout with no test and no comment explaining the link.

**Recommendation:** decide explicitly, then record the decision in code.

- If the merchant should get the two-column layout, raise the cap (`max-w-5xl`)
  and confirm it still reads well inside the Shopify iframe, which is narrower
  than the browser.
- If the cap should stay for readability, add a comment at both sites naming the
  other, so the next person changing one knows it moves the layout at the other.

Either way this should not remain an undocumented coincidence.

## What this audit did not examine

Merchant-authored content — button labels, catalog labels, loading steps,
disclaimer text — is database content and identical on both surfaces by
definition. Localizing that content is separate approved work; see the design
doc committed as `9a9a36b`.
