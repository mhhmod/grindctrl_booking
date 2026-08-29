# GRINDCTRL — one Shopify app, two separated products

**Date:** 2026-08-30
**Status:** Approved design, not yet implemented
**Scope:** Bring Store Chat into the embedded Shopify app alongside Try-On, with the two features cleanly separated, one shared configuration across both surfaces, and the app renamed to `GRINDCTRL`.

---

## 1. Why

Store Chat is fully built and live, but a merchant can only configure it at `grindctrl.cloud/dashboard/messenger`. Inside Shopify they see an app called "GrindCTRL Try-On" that knows nothing about it. Two consequences:

1. **The product looks like one feature.** A merchant who installs from the App Store has no way to discover Store Chat exists.
2. **Configuration lives somewhere they are not.** Shopify merchants work in the Shopify admin. Sending them to another domain to change a greeting is where they stop.

### Success criteria

- A merchant installs the app and configures **both** products without leaving the Shopify admin.
- The two products read as separate things inside one app, matching how the web dashboard already separates them.
- A change made in Shopify appears on grindctrl.cloud, and the reverse, because **there is one configuration, not two copies**.
- A merchant who never visits grindctrl.cloud still gets a working Store Chat.

### Non-goals

- A second Shopify app, a second listing, or a second install flow.
- Changing Try-On's behaviour, settings, or storage. It is moved, not modified.
- Billing or plan changes.
- Merging two *existing* real accounts that both claim one store. Refused with a clear message; resolved by support.

---

## 2. Decisions locked

| Question | Decision |
|---|---|
| One app or two | **One app**, two top-level sections, mirroring the dashboard's split |
| App name | **`GRINDCTRL`** — an umbrella that survives a third product |
| Who owns a store's config | **The store.** The account is how you reach it, not what identifies it |
| Account required to start | **No.** Provision from the shop; claiming is deferred and optional |
| Same settings in both places | **Guaranteed structurally**, by one row per store — not by convention |
| Embedded UI | **The same components the dashboard renders**, not a parallel implementation |

---

## 3. The core problem: two tenancy models

The two products are tenanted differently, and this is the whole difficulty.

| | Tenant key | Account needed |
|---|---|---|
| Try-On | `tryon_settings.shop` (primary key) | No — shop alone |
| Store Chat | `widget_sites.workspace_id` **NOT NULL**, `created_by_profile_id` **NOT NULL** | Yes — a Clerk profile must exist |

The embedded app proves exactly one thing: *which shop*, via the Shopify session token. It has no Clerk user. So today a Store Chat configuration **cannot exist** for a merchant who installs from the App Store and never signs up.

Worse, and verified against production: **`widget_sites` has no unique constraint on `domain`** — only `id` and `embed_key`. And `ensureMessengerSite` searches for a site by domain *only within the caller's own workspace*. So a second account touching the same store silently creates a second configuration with a second embed key. One is live on the storefront; the other is the one being edited. Nothing today prevents this, and no amount of account-linking fixes it — linking only postpones it until a second person links.

### The rule

**One `widget_sites` row per Shopify store, enforced by the database.**

```sql
create unique index if not exists uq_widget_sites_domain
  on public.widget_sites (lower(domain))
  where domain is not null;
```

Partial on purpose: rows with `domain is null` are the real "no store connected yet" state and stay unconstrained. Verified safe to add — the two existing sites have distinct domains.

This index is the load-bearing piece. "Same settings in both places" is a property of there being one row, not of two code paths agreeing to be careful.

---

## 4. Provisioning without an account

`workspace_id` and `created_by_profile_id` are NOT NULL, so a shop-owned site still needs a profile and a workspace. It gets a synthetic pair, created on first open of the embedded app:

- `profiles.clerk_user_id = 'shop:<domain>'` — the column is free text with a unique index, so this is legal and collision-free against real Clerk ids (`user_…`).
- `profiles.email` = the existing noreply placeholder form.
- A workspace owned by that profile, and the site inside it.

The placeholder email composes with behaviour already shipped: `isPlaceholderEmail` makes the handoff notifier skip unsendable addresses and record `handoff_notify_skipped`. That is the correct behaviour for an unclaimed store — there is nobody to email until a human claims it or sets explicit recipients. **The Store Chat settings UI must therefore surface the recipients field prominently for unclaimed stores**, or the merchant gets escalations they are never told about.

Implemented as `ensureShopOwnedSite(shopDomain)` in `lib/messenger/provisioning.ts`, reusing the same conflict-safe patterns as `ensureProfile`/`ensureWorkspace` — including the bounded retry added after the 2026-08-29 first-visit race, since two concurrent embedded loads race identically.

---

## 5. Claiming a store

Claiming transfers a shop-owned site into a real workspace. It is a one-click adopt, never a setup wizard, and it happens when the merchant wants something from an account — not before they have seen the product work.

**Authority:** whoever can open the embedded app has proven they control that Shopify admin. That, and only that, may mint a claim. It must never be possible to claim a store by typing its domain on the web.

**Flow:**

1. Embedded app shows "Open full dashboard".
2. `GET /api/shopify/claim/start` — verifies the session token via `verifySessionToken`, mints a short-lived HS256 token (5 minutes) carrying `shop` and a nonce, signed with `SHOPIFY_API_SECRET`. Modelled directly on `signShopperToken` in `lib/messenger/identity.ts`, which is the same shape and the same threat.
3. Redirect to `grindctrl.cloud/claim?token=…`.
4. The merchant signs in with Clerk. The server verifies the token, then adopts: the site's `workspace_id` and `created_by_profile_id` move to their workspace.
5. The synthetic profile is deleted if it now owns nothing.

**Outcomes, all explicit:**

| State of the site | Result |
|---|---|
| Owned by the synthetic shop profile | Adopted |
| Already owned by *this* merchant's workspace | No-op, success |
| Owned by a *different real* account | **Refused**, with "This store is already connected to another GRINDCTRL account." Transferring a live storefront between accounts is a support action, not a URL click |
| Token expired or bad signature | Refused, restart from the embedded app |

**`ensureMessengerSite` changes too.** Today it creates a site when it finds none in the caller's workspace, which is how a duplicate is born. It must first look up the domain globally and adopt-or-refuse. Without this the new unique index turns a silent duplicate into a raw database error surfaced to the merchant.

---

## 6. One component tree, two hosts

This is what makes "same everything" true rather than intended: the embedded app renders **the same `MessengerTabs` component** the dashboard renders. Not a copy, not a port.

The only real difference is authorization:

- **Dashboard:** Clerk session → server actions → `requireOwnedSite(userId, siteId)`.
- **Embedded:** Shopify session token, arriving as a header on an App Bridge `fetch` → route handler → `verifySessionToken` → shop → site by domain.

A server action cannot read that header cleanly, and `/api/shopify/admin/settings` already established the route-handler pattern for exactly this on the Try-On side.

**So the editors stop importing server actions directly and take an `onSave` prop.** Six components import `@/app/dashboard/messenger/actions` today and all six change:

```
components/dashboard/messenger/
  appearance-editor.tsx
  behaviour-editor.tsx
  ai-knowledge-editor.tsx
  support-desk-settings.tsx
  conversations-panel.tsx
  install-card.tsx
```

The dashboard injects the existing server actions; the embedded host injects fetches to route handlers. Rejected alternatives: duplicating the editors (guarantees drift — the exact failure this spec exists to prevent), and passing a Shopify token into server actions (awkward, and easy to get wrong in a way that is a cross-tenant write).

New route handlers, each authenticating by session token and resolving shop → site:

```
POST /api/shopify/store-chat/draft      save a settings section
POST /api/shopify/store-chat/publish    publish the draft
GET  /api/shopify/store-chat/state      site + config + conversations
POST /api/shopify/store-chat/knowledge  knowledge CRUD
POST /api/shopify/store-chat/thread     staff reply, takeover, resolve
```

Every one re-derives the site from the verified shop. **A site id from the request body is never trusted** — that would be a cross-tenant write, and it is the single most important rule in this section.

---

## 7. Embedded shell

`app/shopify/app/[[...rest]]/page.tsx` grows a tab layer:

```
GRINDCTRL                                    [☀/☾]
──────────────────────────────────────────────────
  Try-On  │  Store Chat
══════════ ╵
```

- Header: `GRINDCTRL`. The "AI try-on, managed for you" subtitle goes — it is an umbrella now.
- **Try-On tab:** today's `ShopifyAdminSettings` content, moved unchanged.
- **Store Chat tab:** the dashboard's messenger tabs.
- Tab state in the URL (`?tab=`) so Shopify's back button behaves.
- Locale continues to come from Shopify's `?locale`, and RTL continues through `getDir(locale)`.

---

## 8. Rename

- `shopify.app.toml`: `name = "GRINDCTRL"`.
- `app/shopify/app/[[...rest]]/page.tsx`: `metadata.title`.
- The theme extension keeps handle `grindctrl-tryon-block` and its `uid`. **Renaming or replacing it would read as an uninstall to merchants who have the block enabled.** The handle is internal; merchants see block names, which are already correct.
- The App Store listing subtitle carries discovery ("AI try-on and support chat for your store") since the name no longer does.

---

## 9. Data model changes

```
widget_sites   + unique index on lower(domain) where domain is not null
profiles         synthetic rows, clerk_user_id = 'shop:<domain>'  (no schema change)
```

One migration, `supabase/shopify_unified_app.sql`, following the manual-delta convention. No new tables. No new environment variables — the claim token reuses `SHOPIFY_API_SECRET`.

**Pre-flight check, required before applying:** assert there are no existing duplicate domains, since the index creation fails otherwise and the failure mode is a half-applied migration.

```sql
select lower(domain), count(*) from public.widget_sites
where domain is not null group by 1 having count(*) > 1;
```

---

## 10. Phasing

Each phase ships and deploys independently.

### Phase 1 — Tenancy (no UI change)

Unique index, `ensureShopOwnedSite`, adopt-or-refuse in `ensureMessengerSite`, claim mint and redeem.

Ships alone deliberately: it changes ownership semantics on live data, and it should be settled in production before any UI depends on it.

### Phase 2 — Shell, rename, Store Chat config

The `onSave` refactor across six components, the route handlers, the tab shell, the rename, and `shopify app deploy`.

### Phase 3 — Conversations in the embedded app

The staff inbox: the 15s poll, takeover and release, signed attachment URLs.

Heaviest, and the only piece worth reconsidering on evidence. The argument for doing it: making a merchant leave Shopify to answer a shopper undercuts the entire point. The argument for waiting: it is the largest surface and the least certain demand.

---

## 11. Testing

**Unit** — claim token mint/verify (expiry, wrong signature, wrong shop); adopt-or-refuse across all four ownership states; `ensureShopOwnedSite` under the concurrent-first-open race, using the same "committed but not yet visible" stub that reproduced the 2026-08-29 production failure.

**Integration** — every route handler rejects a missing, expired, and foreign-shop session token; a site id supplied in a request body is ignored in favour of the token's shop (the cross-tenant write test); a draft saved through the embedded route is byte-identical to one saved through the server action.

**Security** — a valid session token for shop A cannot read or write shop B's configuration; a claim token for shop A cannot adopt shop B; a claim cannot be minted from the web.

**E2E** — install → open app → both tabs render → change a Store Chat setting in Shopify → it appears on grindctrl.cloud.

---

## 12. Known limitations

- Two existing *real* accounts claiming one store is refused, not merged. Deliberate: merging live configurations silently is worse than a support conversation.
- Unclaimed stores have no reachable email, so handoff alerts are skipped until recipients are set. Mitigated by surfacing the recipients field, not by code.
- The embedded app is an iframe: the Conversations poll pauses when the Shopify tab is hidden, same as the dashboard.
- Store Chat's merchant-facing emails remain English-only; that is tracked separately and unchanged here.
