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
