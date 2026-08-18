# Connect Your Store — Design Spec

**Status:** Design approved by user (2026-08-18), ready for an implementation plan.
**Builds on:** commit `b463935` (multi-tenancy data-isolation fix), which added the nullable `tryon_shops.owner_clerk_user_id` column but left it write-only-by-hand — this spec is the missing write path.

## Problem

`tryon_shops.owner_clerk_user_id` decides whose dashboard sees a shop's data. Today the only way to set it is a manual database update. There is no way for a merchant to link their own Shopify shop to their own dashboard account. Every new sign-up sees the "no shop connected" empty state forever, with no path out of it.

## Goal

A signed-in dashboard user can link a real Shopify shop they control to their own account, ending with `tryon_shops.owner_clerk_user_id` set correctly, without any manual database step.

## Non-goals (explicitly out of scope for this design)

- **Persisting a Shopify Admin API access token.** Nothing in this codebase calls the Shopify Admin/GraphQL API today (confirmed by a full repo grep — no `access_token` storage, no OAuth code anywhere). Token exchange is real and available when a feature actually needs Admin API access, but building that storage now would be speculative infrastructure for a caller that doesn't exist. Add it when a feature needs it.
- **Unlinking a shop, transferring ownership between accounts, or any admin/support tooling for ownership disputes.** A manual database update remains the escape hatch for those, same as today.
- **The embedded-app-first flow** (merchant opens the app cold from Shopify admin with no prior dashboard visit). The user has already confirmed dashboard-first is the intended flow, and `middleware.ts` already treats the embedded iframe as a cookie-less third-party context — building a popup-based sign-in for a flow nobody uses yet is not justified.
- **GDPR compliance webhooks** (`customers/redact`, `shop/redact`, `customers/data_request`). Only enforced for public Shopify App Store listings; this app is custom-distribution only.
- **Rate-limiting infrastructure for the code-consumption endpoint.** The code space (see Security) already makes brute force infeasible within the code's lifetime. Flagged as a future hardening step, not a blocker.

## Existing building blocks this reuses, unchanged

- **Embedded admin auth** — `lib/shopify/session-token.ts`'s `verifySessionToken()` verifies the App Bridge JWT (HMAC against `SHOPIFY_API_SECRET`, checks `aud`/`exp`/`nbf`, extracts `shop` from the `dest` claim). This is the only source of truth for "which shop is this embedded request coming from" and nothing in this design changes it.
- **Dashboard auth** — Clerk's `auth()`, used the same way `lib/shopify/shops.ts` and `app/dashboard/try-on/plan-actions.ts` already use it.
- **Server-action pattern** — `app/dashboard/try-on/plan-actions.ts` is the template: a `'use server'` file, functions that call into a `lib/` module, `revalidatePath` after a write.
- **Embedded API route pattern** — `app/api/shopify/admin/settings/route.ts`'s `authenticate(request)` helper (Bearer token → `verifySessionToken`) is the template for the new embedded-side route.

## The mechanism: a dashboard-issued, human-typed linking code

The merchant, already signed into the dashboard, generates a short code. They switch to their Shopify admin, open the embedded app, and type the code into a new field there. The embedded side — which independently knows the real `shop` from the verified session token — looks up the code and writes the link.

This is the same trust pattern as a device-pairing code (Stripe Connect manual linking, `gh auth login`'s device flow): the two contexts (dashboard browser tab, Shopify admin iframe) never need to talk to each other directly. The human is the transport.

**Why not a URL-embedded token instead** (the variant sketched during scoping): that would mean encoding the `clerk_user_id` into a query parameter and hoping Shopify's admin-apps URL forwards it through to the embedded iframe load. That behavior isn't something this codebase currently depends on or has verified, and it's exactly the kind of undocumented-protocol-detail dependency that's risky to build a security-relevant linking step on. The code-based approach depends on nothing but the two auth mechanisms this app already has proven working. One extra manual step (read a code, switch tabs, type it) is a small price for removing that uncertainty.

**Why not classic OAuth or token exchange for this:** both get you a Shopify Admin API access token. Neither gets you a `clerk_user_id`. They solve a different problem than the one this app actually has right now (see Non-goals).

## Data model

New table, reversible:

```sql
create table public.tryon_shop_links (
  code text primary key,
  clerk_user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_shop_domain text
);
```

```sql
-- rollback
drop table public.tryon_shop_links;
```

No RLS policy needed beyond what's already standard in this project (RLS enabled, zero policies, service-role key bypasses it — the established pattern for every `tryon_*` table per the earlier Supabase advisor check). All access goes through the service-role client from server-only code, same as `tryon_shops`.

`consumed_shop_domain` is write-only audit data (which shop actually got linked with this code) — never read back by application logic, only useful if someone needs to investigate a linking dispute later.

## Components

### 1. `lib/shopify/shop-links.ts` (new)

Mirrors `lib/shopify/shops.ts`'s structure and its private `requireDashboardOwner()` pattern (duplicated per-file, matching the existing convention in `shops.ts` and `overview-data.ts` rather than introducing a new shared auth helper).

```ts
export type ShopLinkCode = { code: string; expiresAt: string };

export async function createShopLinkCode(): Promise<ShopLinkCode>;

export type ConsumeShopLinkResult = 'linked' | 'invalid' | 'expired' | 'already_owned';

export async function consumeShopLinkCode(
  code: string,
  shopDomain: string,
): Promise<ConsumeShopLinkResult>;
```

`createShopLinkCode()`:
1. Requires a signed-in Clerk user (throws `'Unauthorized'` if not, same as `shops.ts`).
2. Deletes any existing unconsumed rows for this `clerk_user_id` (at most one active code per user at a time — avoids confusion from double-clicking "generate" and keeps the table from growing unbounded).
3. Generates an 8-character code from the alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (uppercase, excludes `0/O`, `1/I/L` to avoid transcription mistakes), using `node:crypto`'s `randomInt` (already the only crypto primitive this codebase uses for anything security-adjacent — no new dependency).
4. Inserts `{ code, clerk_user_id, expires_at: now + 10 minutes }`.
5. Returns `{ code, expiresAt }`.

`consumeShopLinkCode(code, shopDomain)` — `shopDomain` here is always the value `verifySessionToken()` already validated, never client input:
1. Normalizes the input code (strip whitespace/hyphens, uppercase) before lookup.
2. Looks up the row. No row → `'invalid'`.
3. `expires_at < now` → `'expired'`.
4. `consumed_at` already set → `'invalid'` (a code is one-shot; a second use of an already-consumed code is indistinguishable from a wrong code to the caller).
5. Reads the current `owner_clerk_user_id` for `shopDomain` in `tryon_shops`:
   - If null → set it to the code's `clerk_user_id`, mark the code consumed with `consumed_shop_domain = shopDomain`, return `'linked'`.
   - If equal to the code's `clerk_user_id` → no-op (already linked to the same account), mark consumed, return `'linked'` (idempotent — clicking the button twice isn't an error).
   - If set to a *different* `clerk_user_id` → return `'already_owned'`, do **not** consume the code and do **not** touch `tryon_shops` (never silently reassign ownership).

### 2. `app/dashboard/connect-shop/actions.ts` (new)

```ts
'use server';
export async function generateShopLinkCode(): Promise<ShopLinkCode>;
```

Thin wrapper over `createShopLinkCode()`. No `revalidatePath` needed — nothing on the dashboard changes until the code is actually consumed from the Shopify side.

### 3. Dashboard UI — `components/dashboard/connect-shop-panel.tsx` (new)

Rendered inside the existing "no shop connected" empty state in `app/dashboard/try-on/page.tsx` (the `shops.length === 0` branch of the Merchant shops card, which today just shows `c.noShopsYet` as plain text) — this is the natural home for it; no new page needed.

Client component: a "Connect a store" button. On click, calls `generateShopLinkCode()`, then displays:
- The code, formatted as `XXXX-XXXX` for readability (hyphen is cosmetic only, stripped before the merchant needs to type anything into Shopify — actually the merchant reads it, so formatting is purely for their own copying/reading, not re-entered anywhere by them into this UI).
- A live countdown to expiry (reuses the same "seconds remaining" countdown pattern already built in `rate-limit-banner.tsx`).
- Instructions: "Open the GrindCTRL app from your Shopify admin, and enter this code where it asks you to link your account."
- A "Generate a new code" action once expired, calling `generateShopLinkCode()` again (which will invalidate the old one per step 2 above).

### 4. `app/api/shopify/admin/link/route.ts` (new)

Same `authenticate(request)` pattern as `app/api/shopify/admin/settings/route.ts`.

```ts
export async function POST(request: NextRequest) {
  const session = authenticate(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as { code?: string };
  const outcome = await consumeShopLinkCode(String(body.code ?? ''), session.shop);
  return NextResponse.json({ outcome });
}
```

### 5. `app/api/shopify/admin/settings/route.ts` — extend the existing `GET` (modify)

The embedded admin needs to know whether the current shop is already linked, to decide whether to show the code-entry form or a "connected" confirmation. Add one lookup and one field to the existing response:

```ts
// inside GET, alongside the existing settings/entitlement fetch:
const linked = await isShopLinked(session.shop); // new export from lib/shopify/shop-links.ts
// ...
return NextResponse.json({ shop: session.shop, settings, plan: {...}, linked });
```

`isShopLinked(shopDomain)`: one `select owner_clerk_user_id from tryon_shops where shop_domain = ...`, returns `owner_clerk_user_id !== null`.

### 6. `components/shopify/admin-settings.tsx` — new card (modify)

A new `<Card>` added to the existing stack (same position as `MerchantPlanCard` — near the top, since linking is the first thing an unlinked merchant needs to do):

- If `linked` (from the extended GET response) is `true`: a small "Connected to your GrindCTRL dashboard account" status line, no form.
- If `false`: a text input + submit button. On submit, `POST /api/shopify/admin/link` with `{ code }` (same `withToken()`-sourced Bearer auth as the existing `save()` function). On `'linked'`, show a success message and flip local state so the form disappears without needing a full reload. On `'invalid'`/`'expired'`/`'already_owned'`, show the matching error copy below the field.

## Data flow, end to end

1. Shop installs the app (existing, unchanged) → webhook → `tryon_shops` row appears, unowned.
2. Merchant signs into (or up for) the dashboard (existing, unchanged).
3. Dashboard's try-on page shows the empty state with the new "Connect a store" button.
4. Click → `generateShopLinkCode()` → dashboard shows the code + 10-minute countdown + instructions.
5. Merchant switches to Shopify admin, opens the GrindCTRL app (existing embedded route, unchanged auth) → sees the new "Link to dashboard" field (since `linked` is `false`) → types the code → submits.
6. `POST /api/shopify/admin/link` verifies the session token (trusted `shop`), calls `consumeShopLinkCode`.
7. Success: embedded admin shows "Connected." Merchant returns to the dashboard tab and refreshes (or next navigation triggers a fresh server-render) to see their real data — the try-on page's server component re-fetches `listManagedTryOnShops()` on every request already, so no cache invalidation is needed on the dashboard side.

## Error handling

| Outcome | Embedded-admin message |
|---|---|
| `expired` | "This code has expired. Generate a new one from your dashboard." |
| `invalid` | "That code doesn't match. Check it and try again." |
| `already_owned` | "This store is already connected to a different account." |
| network/DB failure | Generic retry message, matching the existing `saveFailed`-style copy convention in `dashboard-copy.ts`. |

All four states are terminal from the merchant's perspective (no auto-retry) — they either fix the input and resubmit, or go back to the dashboard for a new code.

## i18n

Every new user-facing string (dashboard button/code display/instructions/countdown, embedded-admin field/success/error copy) gets EN + AR entries, following the existing bilingual module pattern (`dashboard-copy.ts` for the dashboard side, `settings-copy.ts` for the embedded-admin side — matching which module the surrounding existing copy in each surface already uses).

## Security considerations

- **Code entropy vs. lifetime:** 8 characters from a 32-symbol alphabet is 32⁸ ≈ 1.1 trillion combinations. Combined with a 10-minute expiry and single-use consumption, brute force is infeasible even without a dedicated rate limiter (see Non-goals).
- **No cross-origin cookie dependency.** The only thing that crosses between the dashboard tab and the Shopify iframe is the code itself, carried by the human. This sidesteps the third-party-cookie fragility that already rules out the embedded-app-first flow (see Non-goals) and avoids depending on unverified Shopify URL-forwarding behavior (see "why not a URL-embedded token").
- **Never silently reassign ownership.** `already_owned` is a distinct, non-destructive outcome — an already-linked shop is never overwritten by a second code from a different account.
- **`shopDomain` is never client-supplied** in `consumeShopLinkCode` — it always comes from `verifySessionToken()`, which independently HMAC-verifies it against `SHOPIFY_API_SECRET`. A malicious embedded-admin request could submit an arbitrary `code`, but not an arbitrary `shop`.

## Testing

- `lib/shopify/shop-links.test.ts` — same fluent Supabase-builder mock pattern established in `lib/shopify/shops.test.ts` this session. Cases: successful link (unowned shop), idempotent re-link (same owner), rejected link (different owner, `tryon_shops` untouched), expired code, invalid/unknown code, already-consumed code rejected on second use, generating a new code invalidates a prior unconsumed one.
- `components/dashboard/connect-shop-panel.test.tsx` — code display, countdown, regenerate-after-expiry.
- Extend `components/shopify/admin-settings` test coverage (or add one if none exists yet — confirm during planning) for both the `linked: true` and `linked: false` render paths, and the four submit outcomes.

## Migration

```sql
create table public.tryon_shop_links (
  code text primary key,
  clerk_user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_shop_domain text
);
```

Reversible via `drop table public.tryon_shop_links;`. No changes to any existing table — `tryon_shops.owner_clerk_user_id` already exists from the prior fix.
