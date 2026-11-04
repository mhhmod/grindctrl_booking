// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: vi.fn(), context: vi.fn() }));
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

import { previewOriginFor, previewUrl } from './preview-url';

const KEY = 'site:11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rows.mockResolvedValue({ data: [], error: null });
  mocks.context.mockResolvedValue(null);
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

describe('previewUrl', () => {
  it('puts the encoded token in gc_preview', () => {
    expect(previewUrl('https://shop.example.com/', 'a.b+c')).toBe('https://shop.example.com/?gc_preview=a.b%2Bc');
  });
});
