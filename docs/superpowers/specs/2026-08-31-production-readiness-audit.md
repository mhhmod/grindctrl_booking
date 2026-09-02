# GRINDCTRL: Try-On + Store Chat — Production Readiness Audit

**Audit date:** 2026-08-31  
**Scope:** `apps/web-next`, `apps/grindctrl-tryon`, and repository Supabase migrations  
**Verdict:** **Not ready for a merchant launch.** There are 30 unique findings: **3 Blocker, 11 High, 14 Medium, and 2 Low**.

This was a read-only, current-working-tree review. Call paths were traced from both authentication surfaces to their database writes, and the requested component directories were swept for the known mobile-overflow class. No implementation changes or test runs were performed. Supabase live inspection is a material limitation: `.mcp.json` names a Supabase server, but this session exposed no Supabase MCP tools or resources, so `list_tables`, `get_advisors`, and read-only collision queries could not be run. Static migration conclusions are identified separately from facts that would require a live database.

Path notation is repository-relative. For compact repeated citations, `app/`, `lib/`, and `components/` mean the corresponding path under `apps/web-next/`; unprefixed Messenger component filenames mean `apps/web-next/components/dashboard/messenger/`; and unprefixed Liquid block filenames mean `apps/grindctrl-tryon/extensions/tryon-block/blocks/`.

Severity means:

- **Blocker:** do not launch until fixed; exploitable ownership/privacy failure, deterministic split-brain, or certain App Store rejection.
- **High:** likely merchant-visible data loss, serious security/reliability failure, or a major launch gate.
- **Medium:** important defect or drift risk that should be fixed before launch where practical.
- **Low:** contained quality or operability issue.

## 1. Responsive / layout integrity

The sweep covered `apps/web-next/components/dashboard/messenger/**` and `apps/web-next/components/shopify/**`, including every `.tsx` file directly under the Messenger directory. The known Installation-tab class is now contained: the grid has `min-w-0` (`install-card.tsx:96`, `install-card.tsx:108`), the code sample has `overflow-x-auto` (`install-card.tsx:136`), the domain is truncated (`install-card.tsx:162`), and the footer key is inside a `min-w-0` parent and uses `break-all` (`install-card.tsx:173-175`). That area is reviewed and clean in the current tree.

### Findings

- **[High PR-01] The mobile preview itself is wider than a 320px dashboard column.** `apps/web-next/components/dashboard/messenger/preview-frame.tsx:32` adds 16px padding on each side, while `preview-frame.tsx:65` renders a hard `w-[300px]` frame with a 6px border and no `max-w-full`/responsive width. Reproduction: open Appearance, AI, or Behaviour at a 320px viewport and select **Mobile**. The card needs at least 332 CSS pixels before surrounding page padding, so it creates horizontal overflow. This is the only uncapped fixed-pixel `w-[…]` found in the requested component scope; the other arbitrary values are `max-w-[…]` caps or breakpoint-only grid tracks.
- **[Medium PR-02] The Arabic conversation action group can be wider than the thread header.** `apps/web-next/components/dashboard/messenger/conversations-panel.tsx:248-263` places two shared `Button`s in a non-wrapping `flex` row. The primitive applies `shrink-0 whitespace-nowrap` (`apps/web-next/components/ui/button.tsx:7-8`). The exact failing labels are `إعادة للذكاء الاصطناعي` and `إغلاق المحادثة` (`conversations-panel.tsx:53-54`). Reproduction: at 320px, open an Arabic `handoff_active` thread; the combined labels, button padding, and gap cannot shrink and can overflow the card even though the outer header wraps.
- **[Medium PR-03] An unbroken message URL/hash escapes the 80% bubble.** `apps/web-next/components/dashboard/messenger/conversations-panel.tsx:276-302` caps the bubble at `max-w-[80%]` but gives the message text no `break-words`, `overflow-wrap:anywhere`, or clipping. Staff replies accept 2,000 characters (`apps/web-next/app/dashboard/messenger/actions.ts:249-257`, with the embedded equivalent at `app/api/shopify/store-chat/thread/route.ts:84-95`). Reproduction: send `https://example.com/` followed by 500 `a` characters; the single token paints beyond the bubble/card and can widen the page.
- **[Medium PR-04] Merchant-configured launcher text has no length boundary and can push the launcher outside its preview/store corner.** The two inputs have no `maxLength` (`apps/web-next/components/dashboard/messenger/appearance-editor.tsx:177-194`), `normalizeLocalized` trims but never caps strings (`apps/web-next/lib/messenger/config.ts:99-105`), and the absolute launcher renders the label in a non-wrapping flex button with no max width or truncation (`apps/web-next/components/dashboard/messenger/launcher-preview.tsx:48-64`, `launcher-preview.tsx:97`). Reproduction: save 100 unbroken `A` characters as the launcher label; it expands past the 300px preview and can do the same in the mirrored storefront launcher contract.

### Clean checks

- The editor grids correctly use `minmax(0,1fr)` plus `min-w-0`, for example AI (`ai-knowledge-editor.tsx:128-129`), Appearance (`appearance-editor.tsx:113-115`), Behaviour (`behaviour-editor.tsx:151-153`), Conversations (`conversations-panel.tsx:205`, `conversations-panel.tsx:240`), and Installation (`install-card.tsx:96`, `install-card.tsx:108`).
- Scrollable conversation content has the required column-flex escape hatch: the thread is `flex-col` with `min-w-0` (`conversations-panel.tsx:240`) and the log uses `min-h-0 flex-1 overflow-y-auto` (`conversations-panel.tsx:267`). No missing `min-h-0` instance was found around a column-flex scroller in scope.
- Knowledge titles and source URLs are explicitly truncated (`ai-knowledge-editor.tsx:261-264`, `ai-knowledge-editor.tsx:295-296`), and shared text inputs carry `min-w-0` (`apps/web-next/components/ui/input.tsx:7-14`).

## 2. RTL / i18n

The scoped Tailwind scan found no physical `ml-`, `mr-`, `pl-`, `pr-`, `left-*`, `right-*`, `text-left`, `text-right`, `border-l`, or `border-r` utility in these components. Installation uses logical `ps-5` and `me-2` (`install-card.tsx:111`, `install-card.tsx:174`), and conversations use `text-start` (`conversations-panel.tsx:214`).

The physical `left`/`right` style in `launcher-preview.tsx:45-59` is correct: `bottom-left`/`bottom-right` is a merchant-selected physical storefront corner and must not flip merely because the current UI language changes. No blanket `rtl:` transform was found. Chat-bubble paths and the GRINDCTRL brand mark are not mirrored, which is also correct.

### Findings

- **[Medium I18N-01] The Try-On half of the embedded Shopify app is only partially translated.** Its localized section titles sit beside hardcoded English loading/error copy (`apps/web-next/components/shopify/admin-settings.tsx:84-93`), install descriptions and buttons (`admin-settings.tsx:107-135`), and an entirely English plan card (`apps/web-next/components/shopify/merchant-plan-card.tsx:93-112`). Reproduction: open the embedded app with Arabic locale and select Try-On; the shell and card titles switch to Arabic, but core installation instructions, failure guidance, plan status, and actions remain English. This is not a directionality failure, but it makes the embedded Arabic experience inconsistent and materially harder to install.
- **[Low I18N-02] The Arabic AI knowledge subtitle contains a merchant-visible mistranslation.** `apps/web-next/components/dashboard/messenger/ai-knowledge-editor.tsx:64` says `السياسات والشيوخ والأسئلة الشائعة` (“policies, sheikhs, and FAQs”), where the context plainly calls for shipping (`الشحن`) or another knowledge category. It is shown in both dashboard and embedded contexts.

The Arabic fixed-size pressure point is **[Medium PR-02]** above: the shared button primitive deliberately makes labels unbreakable. Other long Arabic copy in the requested components sits in wrapping paragraphs or fluid controls; badges are short enough for the current `h-5` primitive, and no other likely fixed-height overflow was found by inspection.

## 3. Auth boundary consistency (dashboard vs embedded app)

### Actual resolution paths

| Surface | Authentication | Site/workspace resolution | Mutation guard |
|---|---|---|---|
| `grindctrl.cloud/dashboard/messenger` | `requireDashboardUser()` requires a Clerk user (`apps/web-next/lib/auth/dashboard.ts:11-16`; called at `app/dashboard/messenger/page.tsx:60`) | `listMessengerSites(userId, email)` creates/loads the Clerk profile and its oldest workspace, then lists only that workspace (`lib/messenger/provisioning.ts:197-211`) | Every dashboard mutation calls `requireOwnedSite`, which finds the site only inside that Clerk user's list (`provisioning.ts:388-393`) |
| Embedded Shopify app | Bearer session token, HMAC checked with audience, expiry, `nbf`, and `dest` (`apps/web-next/lib/shopify/session-token.ts:22-57`) | Routes ignore client `siteId`; `ensureShopOwnedSite(session.shop)` globally finds the canonical shop domain or provisions it under a synthetic `shop-<domain>` profile (`lib/messenger/shop-provisioning.ts:55-65`) | Each route derives the site again from the verified token shop, e.g. state (`app/api/shopify/store-chat/state/route.ts:16-25`), knowledge (`app/api/shopify/store-chat/knowledge/route.ts:20-30`), and thread (`app/api/shopify/store-chat/thread/route.ts:35-49`) |

When both paths possess the same non-null canonical domain, the data model is strong: `findSiteByDomain` performs a global exact-domain lookup (`lib/messenger/shop-tenancy.ts:71-103`), the migration adds a partial unique index on `lower(domain)` (`supabase/shopify_unified_app.sql:20-31`), and adoption uses a compare-and-swap on both site and prior workspace (`lib/messenger/provisioning.ts:258-286`). A domain held by a different real Clerk account is rejected (`provisioning.ts:328-340`). That exact-domain case was reviewed and is internally consistent.

### Findings

- **[Blocker AUTH-01] The two entry sequences can deterministically create two configurations for the same merchant, and the product exposes no working reconciliation UX.** Reproduction:
  1. A fresh Clerk merchant visits `/dashboard/messenger` before the store is linked. With no managed Try-On shop, the page calls `ensureMessengerSite(userId, null)` (`app/dashboard/messenger/page.tsx:70-84`), creating a real-account `widget_sites` row whose domain is null (`lib/messenger/provisioning.ts:344-353`).
  2. The merchant then opens the embedded Shopify app. Its exact-domain lookup cannot match the null row, so it creates a second domain-bearing row under a synthetic profile (`lib/messenger/shop-provisioning.ts:55-65`). The dashboard edits the first row; the storefront/embedded app edits the second.
  3. The reverse order also fails unless ownership was populated out of band: `listManagedTryOnShops` filters `tryon_shops.owner_clerk_user_id` (`lib/shopify/shops.ts:130-138`), but no non-test application or migration code in this repository writes that field. The embedded shell contains no claim/link control (`components/shopify/app-shell.tsx:20-64`), and a repository search found no caller of `/api/shopify/claim/start`; only the route itself exists (`app/api/shopify/claim/start/route.ts:26-52`).
  4. Even manually redeeming a claim does not repair the dashboard-first case. Adoption moves the domain row into the real workspace but does not remove/merge the older null row (`provisioning.ts:266-286`). Sites are ordered oldest-first (`provisioning.ts:203-211`), and the dashboard selects `sites[0]` unless a `?site=` is supplied (`app/dashboard/messenger/page.tsx:107`), so it continues to show the wrong, domain-less configuration.

  This directly answers the central audit question: yes, the same objective Shopify store can resolve to a different `widget_sites` row across the two auth boundaries. Multi-store accounts compound it: first-visit auto-provision chooses only the first installed shop (`page.tsx:75-84`), while no reachable add/claim flow links later stores.

- **[Blocker AUTH-02] Any Shopify staff member who can open the embedded app can irreversibly claim the store into their own Clerk account.** The verified session type retains only `shop` and never validates `sub` or an owner-grade authorization (`apps/web-next/lib/shopify/session-token.ts:16-57`). The redeem page documents the exact limitation: any staff account can mint and redeem a claim and there is no disconnect/unclaim path (`apps/web-next/app/claim/page.tsx:77-99`). Reproduction: a non-owner staff user opens the app, calls the claim-start route with their valid session token, signs into a personal Clerk account, and redeems the token. The compare-and-swap prevents a second claimant; it does not prove the first claimant was authorized to bind the store to an external account.
- **[High AUTH-03] A changed Clerk email remains stale in `profiles` and can receive shopper handoff data.** `ensureProfile` updates only placeholder addresses; once a real address exists, a different current Clerk primary email is ignored (`apps/web-next/lib/messenger/provisioning.ts:43-62`). When no explicit notification recipients are configured, the notifier loads owner/admin emails from those profile rows (`lib/messenger/notify.ts:40-60`, `notify.ts:118-121`) and emails recent shopper messages (`notify.ts:155-172`). Reproduction: change the Clerk primary email after first provisioning, leave notification recipients empty, and trigger handoff; the old address remains the fallback recipient. Besides missed alerts, this can disclose shopper names/emails and message excerpts to an address the merchant no longer controls.
- **[Medium AUTH-04] “One default workspace per user” is not enforced by the schema.** The table has no unique constraint on `owner_profile_id` (`supabase/clerk_profiles_workspaces_widget_sites.sql:40-48`), and provisioning explicitly acknowledges that concurrent first visits can leave two workspaces and simply selects the oldest (`apps/web-next/lib/messenger/provisioning.ts:108-158`). The site-domain adoption logic mitigates some symptoms, but orphan workspaces/members remain and create an unnecessary tenancy surface. A unique owner constraint or atomic bootstrap is the durable fix.

## 4. Data/config consistency (dashboard vs embedded app)

### Convergence matrix

| Merchant mutation | Dashboard path | Embedded path | Same implementation? |
|---|---|---|---|
| Enable/disable Store Chat | `actions.ts:100-109` | client `store-chat-actions.ts:48-49` → `api/shopify/store-chat/enable/route.ts:7-27` | **Yes:** both call `setMessengerEnabledForSite` (`lib/messenger/actions-core.ts:105-121`) |
| Edit Appearance | shared `AppearanceEditor` → `saveDraftSection` (`actions.ts:57-70`) | same editor → `/draft` (`store-chat-actions.ts:45-46`; draft route `:12-32`) | **Yes:** both call `saveDraftSectionForSite` (`actions-core.ts:37-54`) |
| Edit Behaviour / support-desk settings | shared editors → dashboard action | same editors → `/draft` | **Yes at the leaf**, with the race in **DATA-01** |
| Edit AI settings | shared AI editor → dashboard action | same editor → `/draft` | **Yes:** `saveDraftSectionForSite` |
| Add URL/manual knowledge | `actions.ts:114-140` | `store-chat-actions.ts:59-68` → knowledge route `:35-43` | **Yes:** both call `addManualKnowledge` / `addUrlKnowledge` |
| Pause/delete/re-sync knowledge | `actions.ts:144-186` | knowledge route `:45-53` | **Yes:** both call the same `lib/messenger/knowledge.ts` functions, with **DATA-02** |
| Publish draft | `actions.ts:73-82` | publish route `app/api/shopify/store-chat/publish/route.ts:8-31` | **Yes:** both call `publishConfigForSite` (`actions-core.ts:57-103`) |
| Staff conversation read/reply/takeover/release/close | `actions.ts:191-326` | `api/shopify/store-chat/thread/route.ts:35-135` | **No:** separate orchestration implementations; see **DATA-03** |
| Discard draft | `actions.ts:85-97` | no `MessengerHostActions` method or embedded route | **No:** dashboard-only; see **DATA-04** |

### Findings

- **[High DATA-01] Support Desk’s single Save deterministically races four whole-draft replacements; only the last-arriving section is guaranteed to survive.** `SupportDeskSettings` launches four `saveDraftSection` calls in `Promise.all` (`apps/web-next/components/dashboard/messenger/support-desk-settings.tsx:140-157`). Each call receives the same pre-save `site`, copies the same stale `site.settings_draft`, changes one key, and replaces the entire JSON column (`lib/messenger/actions-core.ts:49-54`). Reproduction: change notifications, contact capture, attachments, and order lookup, then click Save. All four results can be `{ok:true}`, the UI shows Saved, and the final row contains whichever one-section object arrived last plus the old draft. This affects both dashboard and embedded contexts because they intentionally share this core function. Concurrent saves in different tabs have the same lost-update shape.
- **[High DATA-02] Four knowledge mutations discard Supabase errors and report success.** The source-metadata update after a URL import (`apps/web-next/lib/messenger/knowledge.ts:181-186`), re-sync update (`knowledge.ts:190-207`), status update (`knowledge.ts:209-219`), and delete (`knowledge.ts:222-234`) never inspect the returned `error`. Their dashboard and embedded wrappers therefore return `{ok:true}` after a rejected database operation (`app/dashboard/messenger/actions.ts:144-186`; embedded knowledge route `:45-53`). Reproduction: make the database reject an update/delete (permission, constraint, outage), then pause, delete, or re-sync an entry; the merchant sees success while the row is unchanged. This is especially unsafe for Delete, where the user reasonably expects data removal.
- **[Medium DATA-03] Conversation operations do not converge after authorization.** Dashboard reply/takeover/release/close logic is maintained in `apps/web-next/app/dashboard/messenger/actions.ts:249-326`; embedded logic independently reimplements state transitions, reply insertion, audit writes, limits, and error mapping in `app/api/shopify/store-chat/thread/route.ts:84-135`. They currently look similar, but they are not one callable transaction/orchestrator and can drift silently. Move these composite operations into a shared server-only function that accepts an already-authorized site/conversation/actor, as config mutations already do.
- **[Medium DATA-04] Discard draft exists only in the dashboard implementation.** `apps/web-next/app/dashboard/messenger/actions.ts:85-97` directly clears `settings_draft` and records an audit event, but `components/shopify/store-chat-actions.ts:42-78` has no equivalent and no embedded API route exists. A Shopify-only merchant can create a bad draft and publish over it or manually reverse fields, but cannot discard it as the dashboard can. The direct database implementation is also outside `actions-core`, making future behavior easier to diverge.

Outside those findings, enable/disable, Appearance, Behaviour, AI config, knowledge leaf operations, and publish do converge on the same server-only implementation after their deliberately different authentication gates. That is a strong design choice and was verified rather than inferred from shared UI.

## 5. Installation UX parity (Try-On vs Store Chat)

The platform mechanism is indeed the same for the app-embed cases. Store Chat’s block is a body app embed (`apps/grindctrl-tryon/extensions/tryon-block/blocks/messenger.liquid:16-43`), and Try-On catalog is also a body app embed (`tryon-catalog.liquid:7-19`). Try-On product placement is a section block (`tryon.liquid:49-70`). The surrounding UX, not Shopify’s mechanism, creates the difference.

### Extra Store Chat steps and concepts

Compared with Try-On’s direct product deep link (`apps/web-next/components/shopify/admin-settings.tsx:96-118`) and catalog activation deep link (`admin-settings.tsx:99-100`, `admin-settings.tsx:124-135`), a Store Chat merchant must:

1. Understand and separately manage the GRINDCTRL database status **and** the Shopify theme embed. `install-card.tsx:115-129` shows an app-level **Turn on Store Chat** action alongside the theme action; Try-On does not expose a second enable switch in its install cards.
2. Open a generic theme-list URL (`install-card.tsx:116-120`), choose/current-theme context, navigate to **App embeds**, locate the block, toggle it, and save. Try-On’s links land directly on the relevant block/activation context.
3. Search for the wrong name. The instruction says `GRINDCTRL Support Messenger` (`install-card.tsx:21-22`, `install-card.tsx:45-46`), but the actual extension schema presents `GRINDCTRL Store Chat` (`messenger.liquid:30-33`).
4. Interpret three state concepts—Off, “Enabled—waiting to be seen,” and Live—plus a last-seen diagnostic (`install-card.tsx:89-93`, `install-card.tsx:153-170`). Try-On asks the merchant to add/enable the placement and save.
5. Process an unrelated “Other platforms” script, copy action, embed key, configuration version, and troubleshooting disclosure even though the host context already proves this is Shopify (`install-card.tsx:133-176`).
6. Decide what the extension setting **Hide the messenger** means (`messenger.liquid:35-40`). An app-embed setting is theme-wide, while the setting id says `disable_on_this_page`; that wording introduces a page-scoped concept the implementation does not establish.

### Findings

- **[High INSTALL-01] Store Chat’s “Live” indicator is not measuring Store Chat installation.** Both contexts derive `detectedAt` from `tryon_shops.last_seen_at` (`apps/web-next/app/dashboard/messenger/page.tsx:133-145`; `app/api/shopify/store-chat/state/route.ts:34-47`). That timestamp is written by Try-On admin settings, OAuth, and lifecycle webhooks—not when the Messenger theme block loads (the complete call-site list is visible at `app/api/shopify/admin/settings/route.ts:16,44`, `oauth/callback/route.ts:78`, and `webhooks/route.ts:35`). The actual Store Chat config request records `config_served` (`app/api/messenger/config/route.ts:29-45`) but Installation does not query it. Worse, embedded state calls Clerk-protected `listManagedTryOnShops()` (`state/route.ts:38`; `lib/shopify/shops.ts:130-138`), so a normal cookie-less embedded request commonly rejects and silently leaves detection null. Reproduction: open Try-On settings recently, turn the Store Chat embed off, and keep the app-level status active; the dashboard can label it Live. Conversely, enable the embed in a cookie-less embedded session and it can remain “waiting” forever.
- **[High INSTALL-02] The manual link plus incorrect block name makes the supposedly one-step Shopify install materially harder than Try-On.** Evidence is the generic `/themes` link and two manual instructions (`install-card.tsx:111-120`) versus Try-On’s direct `addAppBlockId`/`activateAppId` URLs (`admin-settings.tsx:96-100`), combined with the instruction/schema name mismatch above. A five-minute merchant can follow the text exactly and fail to find the named item.

### Smallest concrete parity change

Keep the existing card, but make its primary button do three small things: (1) enable Store Chat server-side and surface that result, (2) open a direct current-theme app-embed deep link using `context=apps&activateAppId=<client-id>/messenger`, with the exact visible name **GRINDCTRL Store Chat**, and (3) poll a site-scoped recent `config_served` event when the merchant returns. Move “Other platforms” behind a secondary disclosure in Shopify context. This preserves the design and Shopify mechanism while removing the extra navigation, wrong concept, second action, manual refresh, and false detection source.

## 6. Security / tenant isolation

### Findings

- **[High SEC-01] URL knowledge import remains SSRF-capable through DNS resolution/rebinding.** `assertPublicTarget` rejects literal private IPs and private-looking hostnames (`apps/web-next/lib/messenger/knowledge.ts:112-130`) and correctly validates every redirect (`knowledge.ts:141-155`), but it never resolves the hostname and verifies the resolved addresses. Reproduction: point `attacker.example` at `127.0.0.1`, a private RFC1918 address, or a cloud metadata address; `https://attacker.example/...` passes the string checks, then Node’s `fetch` resolves and contacts the private target (`knowledge.ts:132-147`). Validate every resolved A/AAAA address, pin resolution for the request, and revalidate each redirect target before connecting.

The following requested boundaries were explicitly checked and are clean in the current code:

- **Public config by guessed `shop=` or `embed_key`: no private tenant data is returned.** `/api/messenger/config` accepts either identifier (`apps/web-next/app/api/messenger/config/route.ts:16-37`), but `loadPublicSiteByDomain` resolves through the site’s public-key path (`lib/messenger/public-api.ts:65-77`) and the response type contains only public storefront appearance/behaviour/status data plus the intentionally public embed key (`public-api.ts:123-183`). An attacker can enumerate whether a shop uses the product and see its public widget configuration; they cannot obtain knowledge, conversations, notification recipients, or workspace membership through this route.
- **Embedded state cannot be redirected with a guessed shop/site id.** It derives the shop only from the verified session token and calls `ensureShopOwnedSite(session.shop)` (`app/api/shopify/store-chat/state/route.ts:16-25`). The embedded client deliberately ignores its `siteId` argument (`components/shopify/store-chat-actions.ts:37-50`).
- **Knowledge and conversation ownership checks are present.** Embedded knowledge derives the site from the token and update/delete functions additionally scope by `widget_site_id` (`app/api/shopify/store-chat/knowledge/route.ts:20-30`; `lib/messenger/knowledge.ts:209-228`). Thread operations first require `getConversationForSite(body.conversationId, site.id)` (`thread/route.ts:35-49`). Dashboard equivalents call `requireOwnedSite` and then `getConversationForSite` (`app/dashboard/messenger/actions.ts:191-196`).
- **Storefront session history is double-scoped.** The shared resolver validates key, active site, origin, visitor under that site, then conversation under that visitor (`lib/messenger/public-session.ts:32-59`). Knowing only another store’s embed key is insufficient to read an existing transcript without its random anonymous id and conversation UUID.
- **No client-bundled server secret was found.** The tracked `NEXT_PUBLIC_*` uses are app URL, Clerk publishable key, Supabase URL/anon key, Sentry DSN, and PostHog client configuration (`apps/web-next/.env.example:4-50`). Service-role and Shopify secret access is confined to server modules; for example, `lib/messenger/db.ts:1-22` imports `server-only`, and the client Store Chat adapter imports `ActionResult` as a type only (`components/shopify/store-chat-actions.ts:1-6`). No `NEXT_PUBLIC_` service-role, Clerk secret, Shopify secret, or private API key was found.

The ownership-claim vulnerability **[Blocker AUTH-02]** and stale-email disclosure **[High AUTH-03]** are also security findings; they are fully evidenced in section 3 and counted once.

## 7. Supabase RLS and schema safety

### Live verification limitation

The configured target could not be safely selected or queried. The repository itself is contradictory: `apps/web-next/.env.local:6` names `egvdxshlbcqndrcnzcdn`, then a later duplicate `NEXT_PUBLIC_SUPABASE_URL` at `.env.local:28` names `prsusuwxbzaekynonifl` (the later declaration normally wins); `apps/web-next/docs/deployment.md:57-59` says `prsusuwxbzaekynonifl` is live; `apps/web-next/.env.example:19-22` says `egvdxshlbcqndrcnzcdn` is production; and `apps/web-next/public/widget/v1/runtime.js:17` hardcodes the latter. The current tool registry exposed no Supabase MCP calls despite `.mcp.json` naming a `supabase` server. Therefore:

- `list_tables` and `get_advisors` were **not** run.
- Live RLS state, advisor warnings, policies, installed migration set, duplicate domains/workspaces, synthetic-orphan counts, and real merchant collision checks are **unverified**.
- No project is represented below as confirmed-current merely because it appears in a local file.

### Findings

- **[High RLS-01] Core Try-On ownership depends on an undocumented `tryon_shops` table that no repository migration creates.** Runtime code reads/writes `tryon_shops` (`apps/web-next/lib/shopify/shops.ts:45-77`, `shops.ts:81-100`, `shops.ts:130-140`) and filters a referenced `owner_clerk_user_id` column (`shops.ts:119-138`). The static migrations instead create a materially different `shopify_shops` table keyed to workspace/site (`supabase/shopify_tryon_foundation.sql:137-175`), and the repository contains no `create table tryon_shops`, no owner-column migration, and no non-test writer of `owner_clerk_user_id`. A production database may contain manual schema, but it is not reproducible, its RLS cannot be reviewed from source, and the auth join in section 3 depends on it.
- **[Medium RLS-02] Supabase project-reference drift can split deployments and operational checks across projects.** The duplicate/conflicting references above mean a developer following `.env.example`, the deployment doc, the last local environment declaration, or the old runtime will not necessarily inspect the same database. Resolve this before any live migration/advisor work and make one deployment source authoritative.
- **[Medium RLS-03] Application data access bypasses RLS by design, so RLS is not a backstop for route mistakes.** Messenger access uses a `SUPABASE_SERVICE_ROLE_KEY` client (`apps/web-next/lib/messenger/db.ts:15-22`); Shopify shop/token/try-on modules use the same pattern. Static RLS policies scope workspace reads via `current_setting('app.clerk_user_id')` (for example `supabase/clerk_profiles_workspaces_widget_sites.sql:86-117`), but service-role calls bypass them and these application paths do not set that request-local value. The explicit route guards reviewed in section 6 are therefore the actual security boundary. This can be acceptable, but it raises the blast radius of any missed `.eq(site/workspace)` and should be documented and tested as such.
- **[Low RLS-04] The manual migration set has two concrete rerun/rollback gaps.** `widget_production_foundation.sql` rewrites every empty `settings_json` from legacy columns (`supabase/widget_production_foundation.sql:18-88`), then backfills domain verification tokens and intent behavior/name (`widget_production_foundation.sql:103-110`, `widget_production_foundation.sql:187-198`) without a data rollback section; after subsequent edits there is no reliable way to distinguish generated values from merchant values. Separately, `shopify_unified_app.sql` uses an idempotent unique index but adds `widget_sites_domain_canonical_check` without an `IF NOT EXISTS`/catalog guard (`supabase/shopify_unified_app.sql:29-47`), so rerunning the manual delta fails once the constraint exists. Capture a backup/table snapshot for the backfill and guard the constraint creation.

### Static checks that were clean

- Every `public.*` table created by the checked-in SQL has a checked-in `enable row level security` statement, including profiles/workspaces/sites/domains, Messenger knowledge/feedback/audit/attachments, Shopify tokens and `shopify_shops`, Try-On product config, and widget visitors/conversations/messages/events. This is a static source check, not confirmation of the live database.
- The one-store-one-site migration includes a duplicate-domain preflight, canonical-domain check, unique partial index, transaction, and explicit rollback (`supabase/shopify_unified_app.sql:20-54`). Its data intent is cautious and reversible; its rerun defect is recorded in **RLS-04**.
- No checked-in migration executes `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or a bulk `DELETE` as part of forward application. Constraint/policy drops are paired with replacements in transactions; destructive table/column commands found are comments in manual rollback blocks. The exception is the un-backed-up data rewriting in **RLS-04**, not a direct row deletion.

## 8. Shopify platform compliance

### Scope cross-check

| Declared scope (`apps/grindctrl-tryon/shopify.app.toml:8-15`) | Actual use | Verdict |
|---|---|---|
| `read_orders` | GraphQL order/customer-order lookup (`apps/web-next/lib/messenger/orders.ts:98-120`, `orders.ts:122-178`) | Required for Store Chat order lookup |
| `write_app_proxy` | `[app_proxy]` is configured at TOML lines 12-15 and shopper identity uses the app proxy | Required |
| `read_products` | No Admin API product query was found. Try-On gets product fields from Liquid (`extensions/tryon-block/blocks/tryon.liquid:5-17`) and storefront catalog code, not Admin GraphQL | Unused; see **SHOP-03** |

The OAuth constant exactly matches TOML (`apps/web-next/lib/shopify/oauth.ts:12-15`), and the code uses GraphQL rather than the legacy REST Admin API (`lib/shopify/admin.ts:31-75`). Session-token verification checks HMAC, audience, expiry, `nbf`, and canonical Shopify destination (`lib/shopify/session-token.ts:22-57`). Those parts are reviewed and clean.

### Findings

- **[Blocker SHOP-01] All three mandatory privacy webhooks are absent and the receiver would silently acknowledge them without doing the required work.** TOML registers only `app/uninstalled` and `app/scopes_update` (`apps/grindctrl-tryon/shopify.app.toml:17-26`); it has no `compliance_topics` for `customers/data_request`, `customers/redact`, or `shop/redact`. The single handler branches only on those two lifecycle topics and returns `{ok:true}` for everything else (`apps/web-next/app/api/shopify/webhooks/route.ts:24-42`). It does not export customer data, delete customer/conversation/message data, or erase a shop. `app/uninstalled` deliberately preserves settings and only marks Try-On lifecycle/removes the Admin token (`webhooks/route.ts:6-7`, `webhooks/route.ts:28-35`), which is not a substitute for `shop/redact`. Shopify’s official policy says App Store apps must subscribe to and implement all three, and explicitly says missing/non-responsive endpoints are rejected: [Shopify privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance).
- **[High SHOP-02] Production is pinned to a release-candidate API version.** TOML sets webhook `api_version = "2026-10"` (`shopify.app.toml:17-18`) and Admin GraphQL uses the same version (`apps/web-next/lib/shopify/admin.ts:3-8`). On the audit date, Shopify lists 2026-10 for release on **October 1, 2026**; it is a release candidate and Shopify says release candidates are not recommended for production: [Shopify API versioning](https://shopify.dev/docs/api/usage/versioning). Pin both to the latest stable 2026-07 until 2026-10 becomes stable and the order queries/webhook payloads have been tested against it.
- **[Medium SHOP-03] `read_products` violates least-scope expectations because no Admin API call uses it.** Shopify’s App Store requirements say an app must request only scopes necessary for functionality and may require proof: [Shopify App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements). Remove it or make the actual feature requiring it concrete before submission; Liquid product access does not justify an Admin scope.
- **[Medium SHOP-04] `app/scopes_update` does not reconcile the stored scope snapshot.** OAuth stores `granted.scope` with the encrypted token (`apps/web-next/app/api/shopify/oauth/callback/route.ts:49-71`), and order lookup gates on that stored snapshot (`lib/messenger/orders.ts:129-134`). The scopes webhook merely updates “last seen” (`app/api/shopify/webhooks/route.ts:34-35`) and never parses/persists current scopes. After scope changes, the application can keep attempting a revoked capability or keep reporting `no_scope` for a newly granted one until OAuth is repeated.
- **[High SHOP-05 — external launch gate, unverified] Protected-customer-data approval cannot be confirmed from the repository or current tools.** The app requests `read_orders` and queries order email plus shipping location (`apps/web-next/lib/messenger/orders.ts:98-108`), which Shopify classifies as protected customer data, including level-2 email access. Public apps must request and pass that review in Partner Dashboard: [Shopify protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data). Partner Dashboard state was unavailable, so this is not asserted as missing; it is a must-verify gate. If approval is absent, Shopify can redact fields or return GraphQL errors, and the anonymous email-match order lookup at `orders.ts:166-177` will fail.

The guaranteed App Store rejection visible in code today is **SHOP-01**. Protected-data approval/listing/privacy-policy state lives outside this repository and remains unverified rather than guessed.

## 9. Error / empty / loading states

Both contexts reuse `MessengerTabs`, so tab bodies are the same; their initial data loaders differ. Dashboard has a route skeleton (`apps/web-next/app/dashboard/messenger/loading.tsx:1-29`) and a localized segment error boundary with retry (`app/dashboard/error.tsx:21-86`). Embedded Store Chat has localized initial loading and fatal error copy (`components/shopify/store-chat-embedded.tsx:38-47`, `store-chat-embedded.tsx:146-147`).

| Tab | Dashboard | Embedded Shopify | Audit result |
|---|---|---|---|
| Installation | Domain-less stores get real explanatory copy (`install-card.tsx:116-124`) | Same shared empty copy; initial state failure is visible | Partial detection failures are silently converted to “Never/waiting”; enable failure is silent (**ERR-01**, **ERR-02**) |
| Overview | Zero conversations gets explicit no-data copy (`overview.tsx:157-171`); publish errors use `role=alert` (`overview.tsx:137-150`) | Same shared body; initial state failure is visible | Stats failure is indistinguishable from zero data (**ERR-01**) |
| Appearance | Config comes from the required site read; fatal loader errors reach the dashboard boundary; save result is displayed | Initial state failure is visible; same editor displays save result | Loading/error/normal-empty behavior reviewed clean, except silent embedded refresh after a successful mutation (**ERR-03**) |
| AI | Zero entries has real guidance (`ai-knowledge-editor.tsx:255-257`) | Same shared empty state; initial failure visible | Knowledge list failure looks like zero entries (**ERR-01**); feedback semantics are wrong (**ERR-04**) |
| Behaviour | Config comes from the required site read; editor and Support Desk show action results | Same shared body; initial failure visible | A normal action rejection is visible, but the lost-write race reports Saved (**DATA-01**); embedded refresh can remain stale (**ERR-03**) |
| Conversations | Zero conversations has explicit copy (`conversations-panel.tsx:186-192`); per-thread load failure shows an alert (`conversations-panel.tsx:145-157`, `conversations-panel.tsx:317-321`) | Same tab is currently rendered because `StoreChatEmbedded` does not disable it (`store-chat-embedded.tsx:151-169`) | Conversation-list failure looks like zero conversations (**ERR-01**); individual thread errors are handled correctly |

### Findings

- **[High ERR-01] Four independent data failures are deliberately masked as legitimate empty/not-live states in both contexts.** Dashboard uses `Promise.allSettled`, initializes stats to null and lists to empty, logs rejected promises only, and renders those fallback values (`apps/web-next/app/dashboard/messenger/page.tsx:125-152`, `page.tsx:182-205`). Embedded state repeats the same mapping (`app/api/shopify/store-chat/state/route.ts:34-53`). Reproduction: fail only the stats, conversations, knowledge, or shop-detection query. The merchant respectively sees “no data,” “no conversations,” “no knowledge,” or “Never/waiting,” with no retry or error marker. A degraded panel should stay isolated, but it needs an explicit error discriminator rather than using the valid empty value.
- **[Medium ERR-02] Installation ignores enable/disable action failure.** `apps/web-next/components/dashboard/messenger/install-card.tsx:125-128` fires `actions.setMessengerEnabled(...)` and discards the returned `ActionResult`; there is no status/error state in the card. Reproduction: make `/enable` return 500 or the dashboard action return `{ok:false}` and click **Turn on Store Chat**. The spinner stops with no explanation. This affects both contexts because they share the component.
- **[Medium ERR-03] Embedded post-mutation refresh failures are silent and leave stale data on screen.** Each wrapper calls `void loadState()` after a successful mutation and ignores its boolean result (`apps/web-next/components/shopify/store-chat-embedded.tsx:78-139`). Reproduction: let the mutation succeed, then fail the following `/state` request; the control reports success while status/config/version remains stale, and `failed` is not set because that flag is only used on initial mount (`store-chat-embedded.tsx:67-76`).
- **[Medium ERR-04] AI knowledge action feedback can announce errors as successful status text.** `apps/web-next/components/dashboard/messenger/ai-knowledge-editor.tsx:247-250` always uses `role="status"`; its success color heuristic calls `formNote.startsWith(locale === 'ar' ? 'أ' : '')`. In English, every string starts with the empty string, so every error is green. In Arabic, errors beginning with `أ` are also green. Reproduction: make Add Knowledge return an English error; it is visually styled as success and is not announced as an alert. Track `{ok,text}` as the other editors do.

## 10. Overall production-readiness verdict

| Dimension | Status | Single most important driver |
|---|---|---|
| Responsive / layout integrity | **Needs fix before launch** | **High PR-01:** the 300px mobile preview overflows a 320px viewport/card |
| RTL / i18n | **Needs fix before launch** | **Medium I18N-01:** Arabic embedded Try-On installation and error guidance remains English |
| Auth boundary consistency | **Needs fix before launch** | **Blocker AUTH-01:** dashboard-first/embedded-first sequences can resolve the same store to different site rows |
| Data/config consistency | **Needs fix before launch** | **High DATA-01:** one Support Desk Save loses up to three of four sections while reporting success |
| Installation UX parity | **Needs fix before launch** | **High INSTALL-01:** “Live” measures Try-On lifecycle activity, not whether Store Chat is actually live |
| Security / tenant isolation | **Needs fix before launch** | **High SEC-01:** URL knowledge import can reach private addresses through DNS resolution |
| Supabase RLS/schema safety | **Needs fix before launch** | **High RLS-01:** the core `tryon_shops` ownership schema is absent from migrations and live RLS/advisors could not be verified |
| Shopify platform compliance | **Needs fix before launch** | **Blocker SHOP-01:** mandatory GDPR webhooks are neither registered nor implemented |
| Error/empty/loading states | **Needs fix before launch** | **High ERR-01:** query failures are shown as valid empty/not-live states in both contexts |

### Ranked top-10 punch list

1. **[Blocker]** `apps/web-next/app/dashboard/messenger/page.tsx:70-107` / `apps/web-next/lib/messenger/shop-provisioning.ts:55-65` — implement one explicit, reachable, atomic store-link/reconciliation flow that merges or removes a prior domain-less site and makes the canonical domain site the selected row.
2. **[Blocker]** `apps/grindctrl-tryon/shopify.app.toml:17-26` / `apps/web-next/app/api/shopify/webhooks/route.ts:24-42` — register all three compliance topics and implement authenticated data export/customer redaction/shop redaction against Messenger and Try-On data.
3. **[Blocker]** `apps/web-next/app/claim/page.tsx:77-99` — require owner-grade authorization for external account binding and add an audited recovery/unclaim path before exposing claim UX.
4. **[High]** `apps/web-next/components/dashboard/messenger/support-desk-settings.tsx:140-157` / `apps/web-next/lib/messenger/actions-core.ts:49-54` — replace four concurrent whole-JSON writes with one atomic merged draft mutation or database-side per-section update.
5. **[High]** `apps/web-next/lib/messenger/knowledge.ts:118-155` — resolve and reject all private/reserved A and AAAA targets, pin the approved address for fetch, and repeat the check on redirects.
6. **[High]** `apps/web-next/app/dashboard/messenger/page.tsx:133-145` / `apps/web-next/app/api/messenger/config/route.ts:40-45` — base Installation status on a recent site-scoped Messenger `config_served` heartbeat, not `tryon_shops.last_seen_at`.
7. **[High]** `apps/web-next/lib/shopify/admin.ts:3-8` / `apps/grindctrl-tryon/shopify.app.toml:17-18` — pin Admin GraphQL and webhooks to stable `2026-07` until `2026-10` is released and verified.
8. **[High]** `apps/web-next/app/dashboard/messenger/page.tsx:125-152` / `apps/web-next/app/api/shopify/store-chat/state/route.ts:34-53` — return per-panel error discriminators and render retryable error states instead of null/empty fallbacks.
9. **[High]** `apps/web-next/lib/messenger/provisioning.ts:43-62` / `apps/web-next/lib/messenger/notify.ts:40-60` — synchronize a changed Clerk primary email and prevent notifications from using an obsolete address.
10. **[High]** `apps/web-next/lib/shopify/shops.ts:45-77` / `supabase/shopify_tryon_foundation.sql:137-175` — create a reviewed migration/source of truth for the actual `tryon_shops` ownership model, then verify live RLS/advisors and collision queries against the confirmed production project.

**Unique finding counts:** Blocker **3** · High **11** · Medium **14** · Low **2**.
