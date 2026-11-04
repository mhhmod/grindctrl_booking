// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isActiveTenant,
  setShopTokenClientForTests,
} from '@/lib/shopify/tokens';

const shop = 'demo.myshopify.com';
const siteId = '019a4f0c-2d31-7b6e-8f45-123456789abc';
const siteKey = `site:${siteId}`;

type Row = Record<string, unknown>;

function testClient(rowsByTable: Record<string, Row[]>): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      let selectedRows = rowsByTable[table] ?? [];
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          selectedRows = selectedRows.filter((row) => row[field] === value);
          return query;
        },
        limit: async (limit: number) => ({ data: selectedRows.slice(0, limit), error: null }),
      };
      return query;
    }),
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.stubEnv('SHOPIFY_APPS', JSON.stringify([
    { clientId: 'app-a', secret: 'secret-a' },
  ]));
  vi.stubEnv('SHOPIFY_API_KEY', '');
  vi.stubEnv('SHOPIFY_API_SECRET', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  setShopTokenClientForTests(null);
});

describe('isActiveTenant', () => {
  it('delegates a Shopify key to the app-scoped installation check', async () => {
    setShopTokenClientForTests(testClient({
      shopify_installations: [{
        app_client_id: 'app-a',
        shop_domain: shop,
        status: 'active',
      }],
    }));

    await expect(isActiveTenant(shop, 'app-a')).resolves.toBe(true);
    await expect(isActiveTenant(shop)).resolves.toBe(false);
    await expect(isActiveTenant(shop, 'unknown-app')).resolves.toBe(false);
  });

  it('requires an active connection row for a site tenant', async () => {
    setShopTokenClientForTests(testClient({
      woo_site_connections: [{ widget_site_id: siteId, status: 'active' }],
    }));
    await expect(isActiveTenant(siteKey)).resolves.toBe(true);
    await expect(isActiveTenant(siteKey, 'irrelevant-shopify-app')).resolves.toBe(true);

    setShopTokenClientForTests(testClient({
      woo_site_connections: [{ widget_site_id: siteId, status: 'disconnected' }],
    }));
    await expect(isActiveTenant(siteKey)).resolves.toBe(false);
  });

  it('denies unknown tenants and storage failures', async () => {
    setShopTokenClientForTests(testClient({ woo_site_connections: [] }));
    await expect(isActiveTenant(siteKey)).resolves.toBe(false);
    await expect(isActiveTenant('not-a-tenant')).resolves.toBe(false);

    setShopTokenClientForTests({
      from: vi.fn(() => { throw new Error('database unavailable'); }),
    } as unknown as SupabaseClient);
    await expect(isActiveTenant(siteKey)).resolves.toBe(false);
  });
});
