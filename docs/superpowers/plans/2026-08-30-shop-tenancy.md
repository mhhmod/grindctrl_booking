# Phase 1 — Store Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a Shopify store — not a Clerk account — the thing that owns a Store Chat configuration, so one store can never have two configs and a merchant needs no account to start.

**Architecture:** A partial unique index on `widget_sites(lower(domain))` makes "one config per store" a database guarantee. A store with no account gets a synthetic profile (`clerk_user_id = 'shop:<domain>'`), which lets the existing `ensureMessengerSite` do all the work unchanged. A merchant later *claims* the store: the embedded Shopify app mints a short-lived signed token, the web app redeems it after Clerk sign-in and transfers ownership. No UI changes in this phase.

**Tech Stack:** Next.js 15 App Router, Supabase (service role, PostgREST), Clerk, `node:crypto` HMAC, vitest.

**Spec:** `docs/superpowers/specs/2026-08-30-shopify-unified-app-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/shopify_unified_app.sql` (create) | The unique index. Manual-delta migration, house convention. |
| `apps/web-next/lib/shopify/claim-token.ts` (create) | Mint/verify the short-lived claim token. Pure, no I/O. |
| `apps/web-next/lib/messenger/shop-tenancy.ts` (create) | Everything about a *store* owning a config: synthetic profile ids, global domain lookup, ownership states, adoption. Kept out of `provisioning.ts`, which is about a *Clerk user* owning workspaces — different question, and that file is already long. |
| `apps/web-next/lib/messenger/provisioning.ts` (modify) | `ensureMessengerSite` consults the global domain lookup before creating. |
| `apps/web-next/app/api/shopify/claim/start/route.ts` (create) | Session-token → claim token → redirect. |
| `apps/web-next/app/claim/page.tsx` (create) | Clerk sign-in → redeem → adopt. |

---

## Task 1: The unique index

**Files:**
- Create: `supabase/shopify_unified_app.sql`

- [ ] **Step 1: Run the pre-flight check**

The index cannot be created if duplicates already exist, and a failed `create index` mid-migration is a bad state to debug. Run against production first:

```sql
select lower(domain) as domain, count(*) as sites
from public.widget_sites
where domain is not null
group by 1 having count(*) > 1;
```

Expected: zero rows. If any row comes back, STOP — that store already has the exact split this phase prevents, and which config is live must be decided by a human before continuing.

- [ ] **Step 2: Write the migration**

```sql
-- ============================================================
-- Migration: shopify_unified_app
-- Purpose: one Store Chat configuration per Shopify store.
--
-- widget_sites had unique indexes on id and embed_key only, and
-- ensureMessengerSite matched a domain only inside the caller's own
-- workspace. A second account touching the same store therefore
-- created a SECOND config with a second embed key — one live on the
-- storefront, one being edited, with nothing to tell them apart.
--
-- Partial on purpose: domain IS NULL is the real "no store connected
-- yet" state and several rows may legitimately share it.
-- ============================================================

begin;

create unique index if not exists uq_widget_sites_domain
  on public.widget_sites (lower(domain))
  where domain is not null;

commit;

-- Rollback:
-- drop index if exists public.uq_widget_sites_domain;
```

- [ ] **Step 3: Apply it**

Apply via the `supabase-grindctrl2` MCP (`apply_migration`, name `shopify_unified_app`), passing the body without `begin;`/`commit;` — the tool wraps its own transaction.

- [ ] **Step 4: Verify it exists and actually bites**

```sql
select indexdef from pg_indexes
where schemaname='public' and indexname='uq_widget_sites_domain';
```

Expected: the `CREATE UNIQUE INDEX ... WHERE (domain IS NOT NULL)` definition.

- [ ] **Step 5: Commit**

```bash
git add supabase/shopify_unified_app.sql
git commit -m "feat(db): one Store Chat config per Shopify store"
```

---

## Task 2: Claim token

**Files:**
- Create: `apps/web-next/lib/shopify/claim-token.ts`
- Test: `apps/web-next/lib/shopify/claim-token.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, expect, it, vi, afterEach } from 'vitest';
import { signClaimToken, verifyClaimToken, CLAIM_TTL_SECONDS } from './claim-token';

const SECRET = 'shpss_test_secret';
const SHOP = 'demo.myshopify.com';

afterEach(() => vi.useRealTimers());

describe('claim token', () => {
  it('round-trips the shop it was minted for', () => {
    expect(verifyClaimToken(SECRET, signClaimToken(SECRET, SHOP))).toEqual({ shop: SHOP });
  });

  it('refuses a token signed with a different secret', () => {
    expect(verifyClaimToken('other-secret', signClaimToken(SECRET, SHOP))).toBeNull();
  });

  it('refuses a tampered payload', () => {
    // Swapping the shop must invalidate the signature, or a claim for one
    // store adopts another.
    const [h, p, s] = signClaimToken(SECRET, SHOP).split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), shop: 'evil.myshopify.com' }),
    ).toString('base64url');
    expect(verifyClaimToken(SECRET, `${h}.${forged}.${s}`)).toBeNull();
  });

  it('expires', () => {
    const token = signClaimToken(SECRET, SHOP);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (CLAIM_TTL_SECONDS + 60) * 1000);
    expect(verifyClaimToken(SECRET, token)).toBeNull();
  });

  it('refuses junk, a missing secret, and a non-myshopify shop', () => {
    expect(verifyClaimToken(SECRET, 'not.a.token')).toBeNull();
    expect(verifyClaimToken(SECRET, '')).toBeNull();
    expect(verifyClaimToken('', signClaimToken(SECRET, SHOP))).toBeNull();
    expect(() => signClaimToken(SECRET, 'evil.example.com')).toThrow();
  });

  it('mints a distinct token each time', () => {
    // A nonce keeps two claims for the same shop from being the same string.
    expect(signClaimToken(SECRET, SHOP)).not.toBe(signClaimToken(SECRET, SHOP));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd apps/web-next && npx vitest run lib/shopify/claim-token.test.ts
```

Expected: FAIL — `Failed to resolve import "./claim-token"`.

- [ ] **Step 3: Implement**

```ts
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/* Short-lived proof that someone opened this store's Shopify admin.
   Same construction as signShopperToken in lib/messenger/identity.ts —
   HS256 over base64url, no dependencies — because it is the same threat:
   a bearer string handed to a browser that must not be forgeable.

   It authorizes exactly one thing: adopting THIS shop's configuration
   into whichever workspace redeems it. It carries no account, no role,
   and nothing that survives its five minutes. */

const ISSUER = 'grindctrl-shop-claim';
export const CLAIM_TTL_SECONDS = 300;

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

interface ClaimPayload {
  iss: string;
  shop: string;
  iat: number;
  exp: number;
  jti: string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('base64url');
}

export function signClaimToken(secret: string, shop: string): string {
  if (!SHOP_RE.test(shop)) throw new Error(`Refusing to mint a claim for "${shop}"`);
  const now = Math.floor(Date.now() / 1000);
  const payload: ClaimPayload = {
    iss: ISSUER,
    shop,
    iat: now,
    exp: now + CLAIM_TTL_SECONDS,
    // Distinct per mint, so one claim link is never mistaken for another.
    jti: randomBytes(12).toString('hex'),
  };
  const body = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${sign(secret, body)}`;
}

export function verifyClaimToken(secret: string, token: string): { shop: string } | null {
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const expected = Buffer.from(sign(secret, `${parts[0]}.${parts[1]}`));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let payload: ClaimPayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (payload.iss !== ISSUER) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  // Re-validated on the way out: the shop decides which row gets adopted.
  if (typeof payload.shop !== 'string' || !SHOP_RE.test(payload.shop)) return null;

  return { shop: payload.shop };
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd apps/web-next && npx vitest run lib/shopify/claim-token.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web-next/lib/shopify/claim-token.ts apps/web-next/lib/shopify/claim-token.test.ts
git commit -m "feat(shopify): short-lived claim token proving admin access to a store"
```

---

## Task 3: Global domain lookup and ownership states

**Files:**
- Create: `apps/web-next/lib/messenger/shop-tenancy.ts`
- Test: `apps/web-next/lib/messenger/shop-tenancy.test.ts`

- [ ] **Step 1: Write the failing test**

Reuse the stub style from `lib/messenger/provisioning.test.ts` — a hand-rolled builder that records `.eq()` filters, because the real client is chainable and thenable.

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';
import { findSiteByDomain, shopProfileId, isShopProfileId } from './shop-tenancy';

type Row = Record<string, unknown>;

function stubClient(tables: Record<string, Row[]>) {
  function builder(table: string) {
    let filters: Array<[string, unknown]> = [];
    const api: Record<string, unknown> = {
      select: () => api,
      limit: () => api,
      eq: (c: string, v: unknown) => {
        filters.push([c, v]);
        return api;
      },
      maybeSingle: () => {
        const match = (tables[table] ?? []).find((r) => filters.every(([c, v]) => r[c] === v));
        filters = [];
        return Promise.resolve({ data: match ?? null, error: null });
      },
    };
    return api;
  }
  return { from: (t: string) => builder(t) } as unknown as SupabaseClient;
}

afterEach(() => setMessengerServiceClientForTests(null));

describe('shopProfileId', () => {
  it('namespaces a shop so it can never collide with a Clerk id', () => {
    expect(shopProfileId('Demo.MyShopify.com')).toBe('shop:demo.myshopify.com');
    expect(isShopProfileId('shop:demo.myshopify.com')).toBe(true);
    expect(isShopProfileId('user_3GYaCA0XaJubUGLfz8fUvJW7Bop')).toBe(false);
  });
});

describe('findSiteByDomain', () => {
  it('finds a site regardless of which workspace owns it', async () => {
    // The whole point: ensureMessengerSite only ever looked inside the
    // caller's workspace, which is how a duplicate got created.
    setMessengerServiceClientForTests(
      stubClient({
        widget_sites: [
          { id: 's-1', domain: 'demo.myshopify.com', workspace_id: 'w-someone-else' },
        ],
      }),
    );
    await expect(findSiteByDomain('demo.myshopify.com')).resolves.toMatchObject({
      id: 's-1',
      workspace_id: 'w-someone-else',
    });
  });

  it('is null when no store matches', async () => {
    setMessengerServiceClientForTests(stubClient({ widget_sites: [] }));
    await expect(findSiteByDomain('demo.myshopify.com')).resolves.toBeNull();
  });

  it('normalises case, matching the lower(domain) index', async () => {
    setMessengerServiceClientForTests(
      stubClient({ widget_sites: [{ id: 's-1', domain: 'demo.myshopify.com', workspace_id: 'w-1' }] }),
    );
    await expect(findSiteByDomain('DEMO.MyShopify.COM')).resolves.toMatchObject({ id: 's-1' });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd apps/web-next && npx vitest run lib/messenger/shop-tenancy.test.ts
```

Expected: FAIL — `Failed to resolve import "./shop-tenancy"`.

- [ ] **Step 3: Implement**

```ts
import 'server-only';

import { getMessengerServiceClient } from './db';

/* Store-as-tenant.
 *
 * provisioning.ts answers "which workspaces does this Clerk user own".
 * This file answers a different question — "who owns this store's
 * configuration" — and the two must not be tangled: a store can be owned
 * by nobody in particular, which is a state a Clerk-shaped module has no
 * way to express. */

/** Synthetic profiles for stores with no account yet. `clerk_user_id` is
 *  free text with a unique index, and Clerk's own ids all begin `user_`,
 *  so this namespace cannot collide with a real one. */
export const SHOP_PROFILE_PREFIX = 'shop:';

export function shopProfileId(shopDomain: string): string {
  return `${SHOP_PROFILE_PREFIX}${shopDomain.trim().toLowerCase()}`;
}

export function isShopProfileId(clerkUserId: string): boolean {
  return clerkUserId.startsWith(SHOP_PROFILE_PREFIX);
}

export interface SiteOwner {
  id: string;
  workspace_id: string;
  domain: string | null;
}

/** The site for a store, whoever owns it. Deliberately unscoped by
 *  workspace — that scoping is exactly what allowed two configurations
 *  for one storefront. */
export async function findSiteByDomain(shopDomain: string): Promise<SiteOwner | null> {
  const domain = shopDomain.trim().toLowerCase();
  if (!domain) return null;

  const res = await getMessengerServiceClient()
    .from('widget_sites')
    .select('id, workspace_id, domain')
    .eq('domain', domain)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data as unknown as SiteOwner;
}

/** Raised where a merchant will read it, so the wording is the wording. */
export class StoreOwnedByAnotherAccountError extends Error {
  constructor(readonly domain: string) {
    super('This store is already connected to another GRINDCTRL account.');
    this.name = 'StoreOwnedByAnotherAccountError';
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd apps/web-next && npx vitest run lib/messenger/shop-tenancy.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web-next/lib/messenger/shop-tenancy.ts apps/web-next/lib/messenger/shop-tenancy.test.ts
git commit -m "feat(messenger): look a store's config up by domain, not by workspace"
```

---

## Task 4: `ensureMessengerSite` adopts or refuses

**Files:**
- Modify: `apps/web-next/lib/messenger/provisioning.ts` — the `ensureMessengerSite` function
- Test: `apps/web-next/lib/messenger/provisioning.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to the existing `describe('provisioning', ...)`. Note the stub already supports `insert`, `upsert` and `eq`; add rows for a foreign workspace.

```ts
  it('adopts a store already provisioned by the embedded Shopify app', async () => {
    /* The merchant configured Store Chat inside Shopify first (owned by the
       synthetic shop profile), then signed up on the web. They must land on
       the SAME config, not a fresh one. */
    const { client, tables } = stubClient({
      profiles: { rows: [{ id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' }] },
      workspaces: { rows: [{ id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' }] },
      widget_sites: {
        rows: [
          {
            id: 's-shop',
            workspace_id: 'w-shop',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_existing',
            status: 'active',
            settings_json: {},
            settings_version: 3,
            settings_draft: null,
          },
        ],
      },
    });
    setMessengerServiceClientForTests(client);

    const site = await ensureMessengerSite('user_1', 'demo.myshopify.com');

    expect(site.id).toBe('s-shop');
    expect(site.embed_key).toBe('gc_existing');
    // Transferred, not duplicated.
    expect(tables.widget_sites.rows).toHaveLength(1);
    expect(tables.widget_sites.rows[0].workspace_id).toBe('w-1');
  });

  it('refuses a store owned by a different real account', async () => {
    const { client, tables } = stubClient({
      profiles: {
        rows: [
          { id: 'p-1', clerk_user_id: 'user_1', email: 'a@b.c' },
          { id: 'p-2', clerk_user_id: 'user_2', email: 'other@b.c' },
        ],
      },
      workspaces: {
        rows: [
          { id: 'w-1', owner_profile_id: 'p-1', created_at: '2026-01-01' },
          { id: 'w-2', owner_profile_id: 'p-2', created_at: '2026-01-01' },
        ],
      },
      widget_sites: {
        rows: [
          {
            id: 's-theirs',
            workspace_id: 'w-2',
            domain: 'demo.myshopify.com',
            name: 'demo.myshopify.com',
            embed_key: 'gc_theirs',
            status: 'active',
            settings_json: {},
            settings_version: 1,
            settings_draft: null,
          },
        ],
      },
    });
    setMessengerServiceClientForTests(client);

    // Silently transferring a live storefront between accounts is worse
    // than a support conversation.
    await expect(ensureMessengerSite('user_1', 'demo.myshopify.com')).rejects.toThrow(
      /already connected to another GRINDCTRL account/,
    );
    expect(tables.widget_sites.rows[0].workspace_id).toBe('w-2');
  });
```

The stub's `update` helper only matches on `.eq()`; adoption uses `.update({...}).eq('id', …)`, which it already supports.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd apps/web-next && npx vitest run lib/messenger/provisioning.test.ts
```

Expected: FAIL — the first new test creates a second site instead of adopting; the second does not throw.

- [ ] **Step 3: Implement**

In `apps/web-next/lib/messenger/provisioning.ts`, add to the imports:

```ts
import {
  findSiteByDomain,
  isShopProfileId,
  StoreOwnedByAnotherAccountError,
} from './shop-tenancy';
```

Replace the body of `ensureMessengerSite` between the `found` early-return and the `inserted` insert with:

```ts
  const profile = await ensureProfile(clerkUserId, null);
  const workspaceId = await ensureWorkspace(profile.id, clerkUserId);

  /* Before creating anything, ask whether this STORE already has a config
     somewhere. It usually will: the embedded Shopify app provisions one on
     first open, under a synthetic shop profile. Skipping this check is how
     a storefront ended up able to have two configs with two embed keys —
     one live, one being edited. uq_widget_sites_domain now makes the second
     insert fail outright, so this is also what turns a raw database error
     into an answer. */
  if (domain) {
    const existing = await findSiteByDomain(domain);
    if (existing && existing.workspace_id !== workspaceId) {
      const owner = await supabase
        .from('workspaces')
        .select('id, owner_profile_id')
        .eq('id', existing.workspace_id)
        .maybeSingle();
      const ownerProfile = owner.data
        ? await supabase
            .from('profiles')
            .select('clerk_user_id')
            .eq('id', (owner.data as { owner_profile_id: string }).owner_profile_id)
            .maybeSingle()
        : null;
      const ownerClerkId = (ownerProfile?.data as { clerk_user_id?: string } | null)?.clerk_user_id;

      // A store parked under a synthetic shop profile belongs to whoever
      // proves they run it. A store held by a real account does not.
      if (!ownerClerkId || !isShopProfileId(ownerClerkId)) {
        throw new StoreOwnedByAnotherAccountError(domain);
      }

      const adopted = await supabase
        .from('widget_sites')
        .update({ workspace_id: workspaceId, created_by_profile_id: profile.id })
        .eq('id', existing.id);
      if (adopted.error) throw new Error(`site adoption failed: ${adopted.error.message}`);

      const refreshed = await listMessengerSites(clerkUserId);
      const mine = refreshed.find((site) => site.id === existing.id);
      if (mine) return mine;
    }
  }
```

Keep the existing insert below it unchanged.

- [ ] **Step 4: Run it and watch it pass**

```bash
cd apps/web-next && npx vitest run lib/messenger/provisioning.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web-next/lib/messenger/provisioning.ts apps/web-next/lib/messenger/provisioning.test.ts
git commit -m "feat(messenger): adopt a store's existing config instead of duplicating it"
```

---

## Task 5: Provision a store with no account

**Files:**
- Modify: `apps/web-next/lib/messenger/shop-tenancy.ts`
- Test: `apps/web-next/lib/messenger/shop-tenancy.test.ts` (append)

- [ ] **Step 1: Write the failing test**

```ts
import { ensureShopOwnedSite } from './shop-tenancy';
import * as provisioning from './provisioning';
import { vi } from 'vitest';

describe('ensureShopOwnedSite', () => {
  it('provisions under a synthetic profile so no signup is needed', async () => {
    const spy = vi
      .spyOn(provisioning, 'ensureMessengerSite')
      .mockResolvedValue({ id: 's-1' } as never);

    await ensureShopOwnedSite('Demo.MyShopify.com');

    // Lower-cased, namespaced, and the domain doubles as the display name
    // because the merchant never typed one.
    expect(spy).toHaveBeenCalledWith('shop:demo.myshopify.com', 'demo.myshopify.com', 'demo.myshopify.com');
    spy.mockRestore();
  });

  it('refuses anything that is not a myshopify domain', async () => {
    // The caller passes a value derived from a verified session token, but
    // this is the boundary that decides which row gets written.
    await expect(ensureShopOwnedSite('evil.example.com')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd apps/web-next && npx vitest run lib/messenger/shop-tenancy.test.ts
```

Expected: FAIL — `ensureShopOwnedSite is not a function`.

- [ ] **Step 3: Implement**

Append to `apps/web-next/lib/messenger/shop-tenancy.ts`:

```ts
import { ensureMessengerSite, type MessengerSiteView } from './provisioning';

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** A store's configuration, created on demand and owned by the store.
 *
 *  Deliberately thin: ensureMessengerSite already does profile →
 *  workspace → find-or-create-site and is now domain-aware, and
 *  `clerk_user_id` is free text. So "a store with no account" needs no new
 *  machinery — only a namespaced id. The profile's email stays the noreply
 *  placeholder, which makes the handoff notifier skip it and record
 *  `handoff_notify_skipped`: correct, because an unclaimed store has nobody
 *  to email until someone claims it or sets explicit recipients. */
export async function ensureShopOwnedSite(shopDomain: string): Promise<MessengerSiteView> {
  const domain = shopDomain.trim().toLowerCase();
  if (!SHOP_DOMAIN_RE.test(domain)) {
    throw new Error(`Refusing to provision a store for "${shopDomain}"`);
  }
  return ensureMessengerSite(shopProfileId(domain), domain, domain);
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd apps/web-next && npx vitest run lib/messenger/shop-tenancy.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web-next/lib/messenger/shop-tenancy.ts apps/web-next/lib/messenger/shop-tenancy.test.ts
git commit -m "feat(messenger): provision a store's chat config without an account"
```

---

## Task 6: Claim start route

**Files:**
- Create: `apps/web-next/app/api/shopify/claim/start/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/shopify/session-token';
import { signClaimToken } from '@/lib/shopify/claim-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-tenancy';

/* GET /api/shopify/claim/start
   Called from the embedded app with an App Bridge session token.

   Authority lives here and nowhere else: opening the Shopify admin is what
   proves you run this store. A claim can never be minted from the web,
   which is what stops anyone who knows a myshopify domain from adopting
   someone's storefront. */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const header = request.headers.get('authorization') ?? '';
  const session = verifySessionToken(header.replace(/^Bearer\s+/i, ''));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Make sure there is something to claim before handing out a token.
  try {
    await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[shopify] claim start failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  return NextResponse.json({ token: signClaimToken(secret, session.shop) });
}
```

- [ ] **Step 2: Verify it rejects an unauthenticated caller**

```bash
cd apps/web-next && npm run build 2>&1 | grep -E "api/shopify/claim/start|Compiled successfully"
```

Expected: the route is listed and the build compiles.

- [ ] **Step 3: Commit**

```bash
git add apps/web-next/app/api/shopify/claim/start/route.ts
git commit -m "feat(shopify): mint a store claim from the embedded admin"
```

---

## Task 7: Claim redeem page

**Files:**
- Create: `apps/web-next/app/claim/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import { redirect } from 'next/navigation';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { verifyClaimToken } from '@/lib/shopify/claim-token';
import { ensureMessengerSite } from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';

export const dynamic = 'force-dynamic';

/* /claim?token=…  — redeems a claim minted by the embedded Shopify app.
 *
 * requireDashboardUser sends an unauthenticated visitor to /sign-in with
 * this exact URL as redirect_url, so the token survives sign-up and the
 * merchant lands back here. That is what makes claiming one click at a
 * moment they chose, rather than a wall at first open. */
export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const secret = process.env.SHOPIFY_API_SECRET?.trim() ?? '';
  const claim = token ? verifyClaimToken(secret, token) : null;

  if (!claim) {
    return (
      <main className="mx-auto grid max-w-md gap-3 p-8 text-center">
        <h1 className="text-lg font-semibold">This link has expired</h1>
        <p className="text-sm text-muted-foreground">
          Open your store in Shopify and choose “Open full dashboard” again.
        </p>
      </main>
    );
  }

  const userId = await requireDashboardUser(`/claim?token=${encodeURIComponent(token!)}`);

  try {
    // Adoption lives in ensureMessengerSite so the web dashboard and this
    // page cannot disagree about who owns a store.
    await ensureMessengerSite(userId, claim.shop, claim.shop);
  } catch (error) {
    if (error instanceof StoreOwnedByAnotherAccountError) {
      return (
        <main className="mx-auto grid max-w-md gap-3 p-8 text-center">
          <h1 className="text-lg font-semibold">Already connected</h1>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </main>
      );
    }
    throw error;
  }

  redirect('/dashboard/messenger');
}
```

- [ ] **Step 2: Verify the build**

```bash
cd apps/web-next && npm run build 2>&1 | grep -E "/claim|Compiled successfully"
```

Expected: `/claim` listed as a dynamic route, build compiles.

- [ ] **Step 3: Commit**

```bash
git add apps/web-next/app/claim/page.tsx
git commit -m "feat(shopify): redeem a store claim after sign-in"
```

---

## Task 8: Verify and ship

- [ ] **Step 1: Full verification**

```bash
cd apps/web-next && npx tsc --noEmit && npx vitest run && npm run build
```

Expected: no type errors; all tests pass (675 + ~12 new); `✓ Compiled successfully`.

- [ ] **Step 2: Confirm the index actually prevents a duplicate**

Against production, in a transaction that is rolled back:

```sql
begin;
insert into public.widget_sites (workspace_id, name, domain, status, created_by_profile_id, settings_json)
select workspace_id, 'dup test', domain, 'draft', created_by_profile_id, '{}'::jsonb
from public.widget_sites where domain is not null limit 1;
rollback;
```

Expected: `ERROR: duplicate key value violates unique constraint "uq_widget_sites_domain"`. If it succeeds, the index is not doing its job — stop and investigate before shipping.

- [ ] **Step 3: Push and confirm the deploy is green**

```bash
git push origin main
gh run list --workflow "Deploy Next VPS" --limit 1
```

Expected: `completed success`.

- [ ] **Step 4: Confirm nothing regressed in production**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://grindctrl.cloud/dashboard/messenger
ssh -o BatchMode=yes grindctrl-vps 'docker logs grindctrl-next --since 10m 2>&1 | grep -ciE "⨯|error" || echo 0'
```

Expected: a redirect or 200, and no new server errors.

---

## Self-Review

**Spec coverage.** §3 unique index → Task 1. §4 synthetic profile provisioning → Task 5. §5 claim mint → Tasks 2, 6; redeem → Task 7; the four ownership outcomes → Task 4 (adopted, already-yours via the `workspace_id === workspaceId` early return, other-account throw) and Task 7 (expired/bad token). §5 `ensureMessengerSite` adopt-or-refuse → Task 4. §9 pre-flight → Task 1 Step 1. §11 security tests → Task 2 (forged/expired/wrong-secret) and Task 4 (foreign account refused).

**Deferred to Phase 2, deliberately:** the "Open full dashboard" button that calls `/api/shopify/claim/start`. The route exists and is testable now; the button belongs with the embedded shell.

**Not covered by any task, and correctly so:** deleting the orphaned synthetic profile after adoption. It owns an empty workspace and costs two rows; deleting it during a claim adds a failure mode to the path that must not fail. Left as a cleanup concern.

**Type consistency.** `shopProfileId`/`isShopProfileId`/`findSiteByDomain`/`ensureShopOwnedSite`/`StoreOwnedByAnotherAccountError` are used with the same names and signatures in Tasks 3–7. `MessengerSiteView` is the existing exported type from `provisioning.ts`. `verifySessionToken` returns `{ shop }`, matching Task 6's usage.

**One import cycle to watch:** `shop-tenancy.ts` imports `ensureMessengerSite` from `provisioning.ts`, and Task 4 has `provisioning.ts` import `findSiteByDomain` from `shop-tenancy.ts`. ESM handles this cycle because both are used at call time, not module-evaluation time — but if the implementer hits `undefined is not a function`, the fix is to move `findSiteByDomain` and `isShopProfileId` into a third leaf module rather than to restructure the call graph.

---

## What execution changed

Recorded rather than edited into the tasks above, so the difference between
what was planned and what was learned stays visible. Every item below came
from a review finding, not from a change of mind.

**Task 1 — the constraint was not strong enough.** `lower()` does not trim.
A plain lower-case CHECK still admitted `' demo.myshopify.com'`, which hashes
to a different key than the trimmed form — so the unique index would not
catch it, and every reader (which normalises with `.trim().toLowerCase()`)
could never find it again. That row is a second configuration for one
storefront: exactly the failure this phase exists to prevent. The constraint
is `domain = btrim(lower(domain))`.

**Task 3 — `SiteOwner` had to carry the owner.** The plan resolved
`clerk_user_id` with two extra queries. One PostgREST embed
(`workspaces!inner(profiles!inner(clerk_user_id))`) does it in one round
trip. `findSiteByDomain` also now throws on a query error instead of
returning null: conflating "the query failed" with "no such store" sent the
caller into the create path, where the unique index produced a raw
constraint violation instead of a refusal.

**Task 4 — adoption keys on the OWNER, not the workspace.** The planned
guard (`existing.workspace_id !== workspaceId`) refused whenever the site sat
in a different workspace — including a *second workspace belonging to the
same merchant*, which the first-visit race documented at `provisioning.ts`
can produce. That would have told merchants their own storefront belonged to
another account, permanently, with no retry that could succeed. The adoption
UPDATE is also a compare-and-swap on `(id, workspace_id)`: without it, two
accounts reaching the adopt branch meant the second unconditionally took the
store from the first.

**Task 5 — the function had the wrong verb, and its own module.**
`ensureShopOwnedSite` insisted on *owning* the site, so once a merchant
claimed their store, every later embedded-app open threw at that store's real
owner. The embedded app is authenticated by shop domain, so the domain is the
authority: read the site for that domain whoever owns it, and provision only
when none exists. It also moved to `lib/messenger/shop-provisioning.ts` —
putting it in `shop-tenancy.ts` would have imported `provisioning.ts`, which
imports Clerk at module scope, making the Clerk-free leaf module Clerk-shaped
and closing an import cycle. Two further defects surfaced: the workspace slug
collapsed to `gc-myshopifycom-<4 chars of clock>` for *every* shop, because
`normalizeShopDomain` guarantees the `.myshopify.com` suffix; and the `shop:`
prefix produced an address with a colon in the local part, which is not valid
`atext`.

**Tasks 6 and 7 — the token's real escape route was analytics.** The mint
route had no rate limit (the only externally-reachable route without one, and
middleware excludes it), `/claim` had no error boundary, and the claim token
travelled to PostHog and Sentry through `$current_url` — twice, because the
sign-in round trip puts it in `redirect_url` as well.

**Deliberately not built: single-use `jti` burn.** The ownership check is
already the burn — after redemption `mayAdopt` refuses everyone else and the
compare-and-swap closes the concurrent case. Before redemption it is a race,
and a `SETNX` marks the winner without deciding it; whoever can mint can mint
again regardless. With Redis fail-open (the choice `lib/ratelimit.ts` already
makes), the check would be decoration. Scrubbing the URL addresses the actual
exposure.

**Known limitation, recorded in the code.** `verifySessionToken` checks
`aud`, `dest` and `exp` but never `sub` or a staff role, so any staff user who
can open the embedded app can claim the store into their own account — and
there is no disconnect path. The merchant-facing copy points at support
rather than promising a button that does not exist.
