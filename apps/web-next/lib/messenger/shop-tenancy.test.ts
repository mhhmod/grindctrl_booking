// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';
import { findSiteByDomain, shopProfileId, isShopProfileId } from './shop-tenancy';

type Row = Record<string, unknown>;
type Recorded = Array<[string, unknown]>;

/** `recorded` is exposed so a test can assert the *filter itself* was sent —
 *  a `.eq()` call that's silently dropped or renamed still leaves an
 *  unfiltered stub table matching by coincidence, which a data-only
 *  assertion can't catch. Every test seeds a second, non-matching row so an
 *  unfiltered query returns the wrong site instead of the right one. */
function stubClient(tables: Record<string, Row[]>, opts: { error?: { message: string } } = {}) {
  const recorded: Recorded = [];
  function builder(table: string) {
    const filters: Recorded = [];
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => {
        filters.push([c, v]);
        recorded.push([c, v]);
        return api;
      },
      maybeSingle: () => {
        if (opts.error) return Promise.resolve({ data: null, error: opts.error });
        const match = (tables[table] ?? []).find((r) => filters.every(([c, v]) => r[c] === v));
        return Promise.resolve({ data: match ?? null, error: null });
      },
    };
    return api;
  }
  const client = { from: (t: string) => builder(t) } as unknown as SupabaseClient;
  return { client, recorded };
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
    const { client, recorded } = stubClient({
      widget_sites: [
        { id: 's-other', domain: 'other.myshopify.com', workspace_id: 'w-x' },
        { id: 's-1', domain: 'demo.myshopify.com', workspace_id: 'w-someone-else' },
      ],
    });
    setMessengerServiceClientForTests(client);
    await expect(findSiteByDomain('demo.myshopify.com')).resolves.toMatchObject({
      id: 's-1',
      workspace_id: 'w-someone-else',
    });
    // Proves the match came from an actual domain filter, not from being the
    // only (or first) row in the table.
    expect(recorded).toEqual([['domain', 'demo.myshopify.com']]);
  });

  it('is null when no store matches', async () => {
    const { client } = stubClient({
      widget_sites: [{ id: 's-other', domain: 'other.myshopify.com', workspace_id: 'w-x' }],
    });
    setMessengerServiceClientForTests(client);
    await expect(findSiteByDomain('demo.myshopify.com')).resolves.toBeNull();
  });

  it('normalises case and whitespace, matching the btrim(lower(domain)) index', async () => {
    const { client } = stubClient({
      widget_sites: [
        { id: 's-other', domain: 'other.myshopify.com', workspace_id: 'w-x' },
        { id: 's-1', domain: 'demo.myshopify.com', workspace_id: 'w-1' },
      ],
    });
    setMessengerServiceClientForTests(client);
    await expect(findSiteByDomain('  DEMO.MyShopify.COM  ')).resolves.toMatchObject({ id: 's-1' });
  });

  it('treats a blank domain as no store, without querying a real row', async () => {
    // '' is legal under both the CHECK and the partial unique index (it only
    // applies "where domain is not null"), so without this guard a blank
    // param would match a genuinely blank-domain row instead of resolving null.
    const { client } = stubClient({
      widget_sites: [{ id: 's-blank', domain: '', workspace_id: 'w-0' }],
    });
    setMessengerServiceClientForTests(client);
    await expect(findSiteByDomain('   ')).resolves.toBeNull();
  });

  it('throws on a query error instead of reporting a real store as "no such store"', async () => {
    // Swallowing this would send a live merchant's lookup down the "create a
    // new site" path in ensureMessengerSite, which then dies on the
    // uq_widget_sites_domain unique index with a raw Postgres 23505 instead
    // of the readable StoreOwnedByAnotherAccountError message.
    const { client } = stubClient(
      { widget_sites: [{ id: 's-1', domain: 'demo.myshopify.com', workspace_id: 'w-1' }] },
      { error: { message: 'connection reset' } },
    );
    setMessengerServiceClientForTests(client);
    await expect(findSiteByDomain('demo.myshopify.com')).rejects.toThrow(
      'site lookup by domain failed: connection reset',
    );
  });

  it('reads the owner out of a nested object, not an array', async () => {
    // workspace_id and workspaces.owner_profile_id are both single NOT NULL
    // FKs, so PostgREST embeds `workspaces: { profiles: { clerk_user_id } }`
    // as an object. Indexing [0] on that (treating it as an array) reads
    // undefined silently — the exact bug that once showed every shopper as
    // "anonymous" (see notify.ts's resolveRecipients).
    const { client } = stubClient({
      widget_sites: [
        { id: 's-other', domain: 'other.myshopify.com', workspace_id: 'w-x' },
        {
          id: 's-1',
          domain: 'demo.myshopify.com',
          workspace_id: 'w-1',
          workspaces: { profiles: { clerk_user_id: 'user_abc123' } },
        },
      ],
    });
    setMessengerServiceClientForTests(client);
    await expect(findSiteByDomain('demo.myshopify.com')).resolves.toMatchObject({
      id: 's-1',
      ownerClerkUserId: 'user_abc123',
    });
  });
});
