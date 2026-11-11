// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: vi.fn(), context: vi.fn(), paste: vi.fn(), hosts: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => {
    const builder: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order']) builder[name] = vi.fn(() => builder);
    builder.limit = mocks.rows;
    return { from: vi.fn(() => builder) };
  },
}));
vi.mock('@/lib/woo/connection', () => ({ getActiveWooSiteContext: mocks.context }));
vi.mock('@/lib/paste/store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/paste/store')>()),
  getPasteConnection: mocks.paste,
  pasteTryOnHosts: mocks.hosts,
}));

import { previewOriginFor, previewUrl } from './preview-url';

const KEY = 'site:11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rows.mockResolvedValue({ data: [], error: null });
  mocks.context.mockResolvedValue(null);
  mocks.paste.mockResolvedValue(null);
  mocks.hosts.mockResolvedValue([]);
});

const pasted = (over: Record<string, unknown> = {}) => ({
  widget_site_id: '11111111-1111-4111-8111-111111111111', platform: 'shopify', shop_domain: 'alpha.myshopify.com',
  status: 'active', shop_proven_at: '2026-11-10T00:00:00Z', app_installed: false, ...over,
});

describe('previewOriginFor', () => {
  it('uses the myshopify address for a shop', async () => {
    await expect(previewOriginFor('alpha.myshopify.com')).resolves.toBe('https://alpha.myshopify.com/');
  });

  it('uses the first verified domain of a WooCommerce store', async () => {
    mocks.rows.mockResolvedValue({ data: [{ domain: '*.bad', pattern: null }, { domain: 'Shop.Example.com', pattern: null }], error: null });
    await expect(previewOriginFor(KEY)).resolves.toBe('https://shop.example.com/');
  });

  it('falls back to the paired home address, and to null with neither', async () => {
    mocks.context.mockResolvedValue({ homeUrl: 'https://example.com/store', timezone: null });
    await expect(previewOriginFor(KEY)).resolves.toBe('https://example.com/store/');
    mocks.context.mockResolvedValue(null);
    await expect(previewOriginFor(KEY)).resolves.toBeNull();
  });
});

describe('previewOriginFor, pasted code', () => {
  it('opens a confirmed domain of a pasted store before its shop host', async () => {
    mocks.paste.mockResolvedValue(pasted());
    mocks.hosts.mockResolvedValue(['alpha.myshopify.com', 'brand.com', 'www.brand.com']);
    await expect(previewOriginFor(KEY)).resolves.toBe('https://brand.com/');
    expect(mocks.rows).not.toHaveBeenCalled();
  });

  it('opens the proven shop host when the store has no confirmed domain', async () => {
    mocks.paste.mockResolvedValue(pasted());
    mocks.hosts.mockResolvedValue(['alpha.myshopify.com']);
    await expect(previewOriginFor(KEY)).resolves.toBe('https://alpha.myshopify.com/');
  });

  it('has no address while the shop is being confirmed, or a website has no confirmed domain', async () => {
    mocks.paste.mockResolvedValue(pasted({ status: 'pending', shop_proven_at: null }));
    await expect(previewOriginFor(KEY)).resolves.toBeNull();
    expect(mocks.hosts).not.toHaveBeenCalled();
    mocks.paste.mockResolvedValue(pasted({ platform: 'website', shop_domain: null }));
    await expect(previewOriginFor(KEY)).resolves.toBeNull();
    expect(mocks.context).not.toHaveBeenCalled();
  });
});

describe('previewUrl', () => {
  it('puts the encoded token in gc_preview', () => {
    expect(previewUrl('https://shop.example.com/', 'a.b+c')).toBe('https://shop.example.com/?gc_preview=a.b%2Bc');
  });
});
