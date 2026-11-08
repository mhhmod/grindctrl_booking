// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ connection: vi.fn(), domains: vi.fn() }));
vi.mock('@/lib/paste/store', async (original) => ({
  pasteShopHost: (await original<typeof import('@/lib/paste/store')>()).pasteShopHost,
  getPasteConnection: m.connection,
}));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({
  from: (table: string) => {
    const b = {
      select: () => b, eq: () => b,
      maybeSingle: async () => ({ data: { id: SITE, name: 'Merchant', embed_key: 'gc_public_key_42', status: 'active',
        settings_json: {}, settings_version: 1, workspace_id: 'workspace-a', domain: null }, error: null }),
      then: (resolve: (value: unknown) => void) => resolve(table === 'widget_domains' ? m.domains() : { data: [], error: null }),
    };
    return b;
  },
}) }));

import { loadPublicSite, originAllowed } from './public-api';

const SITE = '11111111-1111-4111-8111-111111111111';
const shop = { widget_site_id: SITE, platform: 'shopify', shop_domain: 'merchant.myshopify.com', status: 'active', secret_version: 1,
  shop_proven_at: '2026-11-08T00:00:00.000Z', disconnected_reason: null, app_installed: false };

beforeEach(() => {
  vi.resetAllMocks();
  m.domains.mockReturnValue({ data: [], error: null });
});

describe('public site resolution for a Shopify paste store', () => {
  it('admits the connection shop host with no widget_domains row', async () => {
    m.connection.mockResolvedValue(shop);
    const site = (await loadPublicSite('gc_public_key_42'))!;
    expect(site.pasteShopDomain).toBe('merchant.myshopify.com');
    expect(originAllowed(site, 'https://merchant.myshopify.com', { trusted: true })).toBe(true);
    expect(originAllowed(site, 'https://other.myshopify.com', { trusted: true })).toBe(false);
  });

  it('withholds only the shop host when the connection is disconnected, a website, pending, app-held or unreadable', async () => {
    m.domains.mockReturnValue({ data: [{ pattern: 'merchant.example', verification_status: 'trusted',
      verification_method: 'paste_trusted', environment: 'production' }], error: null });
    for (const connection of [{ ...shop, status: 'disconnected' }, { ...shop, platform: 'website', shop_domain: null },
      // Typing a shop name is not proof, and the Shopify app wins the shop.
      { ...shop, status: 'pending', shop_proven_at: null }, { ...shop, app_installed: true }]) {
      m.connection.mockResolvedValue(connection);
      const site = (await loadPublicSite('gc_public_key_42'))!;
      expect(site.pasteShopDomain).toBeNull();
      expect(originAllowed(site, 'https://merchant.myshopify.com', { trusted: true })).toBe(false);
      expect(originAllowed(site, 'https://merchant.example', { trusted: true })).toBe(true);
    }
    m.connection.mockRejectedValue(new Error('unavailable'));
    const site = (await loadPublicSite('gc_public_key_42'))!;
    expect(site.pasteShopDomain).toBeNull();
    expect(originAllowed(site, 'https://merchant.example', { trusted: true })).toBe(true);
  });
});
