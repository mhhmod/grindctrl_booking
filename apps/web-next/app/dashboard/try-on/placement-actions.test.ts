// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ tenant: vi.fn(), auth: vi.fn(), limit: vi.fn(), origin: vi.fn(), read: vi.fn(), write: vi.fn(), create: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: m.auth }));
vi.mock('@/lib/tenancy/managed-tenant', () => ({ requireManagedTenant: m.tenant }));
vi.mock('@/lib/launch/preview-url', () => ({ previewOriginFor: m.origin }));
vi.mock('@/lib/try-on/placement-store', () => ({ readButtonPlacement: m.read, writeButtonPlacement: m.write }));
vi.mock('@/lib/try-on/pick-token', async (original) => ({ ...await original<object>(), createPickToken: m.create }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/request-rate-limit', async (original) => ({
  ...await original<typeof import('@/lib/request-rate-limit')>(), requireMerchantRateLimit: m.limit,
}));
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { RequestRateLimitError } from '@/lib/request-rate-limit';
import { createPickLinkAction, readPlacementAction, setPlacementAction } from './placement-actions';

const SITE = 'site:11111111-1111-4111-8111-111111111111';
const SPOT = { selector: 'form[action*="cart"]', position: 'after' as const, label: 'Add to cart', pathHint: '/products/blue-dress' };

beforeEach(() => {
  vi.resetAllMocks();
  m.tenant.mockResolvedValue(SITE);
  m.auth.mockResolvedValue({ userId: 'user_owner' });
  m.origin.mockResolvedValue('https://shop.example/');
  m.read.mockResolvedValue({ placement: 'auto' });
  m.write.mockResolvedValue(undefined);
  m.create.mockResolvedValue({ token: 'tok', expiresAt: '2026-11-11T10:30:00.000Z' });
});

describe('Pick a spot link', () => {
  it('is made only after the settings right on that store, for its trusted origin, by the signed-in person', async () => {
    const result = await createPickLinkAction({ shop: SITE });
    expect(m.tenant).toHaveBeenCalledWith(SITE, { capability: 'settings' });
    expect(m.create).toHaveBeenCalledWith({ shop: SITE, origin: 'https://shop.example', createdBy: 'user_owner', preset: null });
    expect(result).toEqual({ ok: true, url: 'https://shop.example/?gc_pick=tok', expiresAt: '2026-11-11T10:30:00.000Z' });
  });

  it('opens the product page the saved spot was picked on', async () => {
    m.read.mockResolvedValue({ placement: 'spot', spot: SPOT });
    expect(await createPickLinkAction({ shop: SITE })).toMatchObject({ url: 'https://shop.example/products/blue-dress?gc_pick=tok' });
  });

  it('refuses a member without the settings right, and makes no link', async () => {
    m.tenant.mockRejectedValueOnce(new RoleNotAllowedError('settings'));
    expect(await createPickLinkAction({ shop: SITE })).toMatchObject({ ok: false, code: 'forbidden' });
    expect(m.create).not.toHaveBeenCalled();
  });

  it('refuses a Shopify app store, whose block is placed in the theme editor', async () => {
    m.tenant.mockResolvedValueOnce('shop.myshopify.com');
    expect(await createPickLinkAction({ shop: 'shop.myshopify.com' })).toMatchObject({ ok: false, code: 'forbidden' });
    expect(m.create).not.toHaveBeenCalled();
  });

  it('needs a trusted https store address', async () => {
    for (const address of [null, 'http://shop.example/']) {
      m.origin.mockResolvedValueOnce(address);
      expect(await createPickLinkAction({ shop: SITE })).toMatchObject({ ok: false, reason: 'no_store_address' });
    }
    expect(m.create).not.toHaveBeenCalled();
  });

  it('carries a valid advanced selector to the store tab inside the link, never in the address', async () => {
    const advanced = { selector: '#ProductInfo button.add', position: 'before' as const };
    const result = await createPickLinkAction({ shop: SITE, advanced });
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ preset: advanced }));
    expect(result).toMatchObject({ url: 'https://shop.example/?gc_pick=tok' });
    expect(await createPickLinkAction({ shop: SITE, advanced: { selector: 'a[href*="javascript:x"]', position: 'after' } }))
      .toMatchObject({ ok: false, reason: 'invalid_selector' });
  });

  it('returns rate limits as a result, not a thrown error', async () => {
    m.limit.mockRejectedValueOnce(new RequestRateLimitError(429, 9));
    expect(await createPickLinkAction({ shop: SITE })).toMatchObject({ ok: false, code: 'rate_limited', retryAfterSeconds: 9 });
  });
});

describe('placement mode', () => {
  it('reads with the read budget', async () => {
    m.read.mockResolvedValue({ placement: 'floating' });
    expect(await readPlacementAction({ shop: SITE })).toEqual({ ok: true, placement: { placement: 'floating' } });
    expect(m.limit).toHaveBeenCalledWith(`shop:${SITE}`, 'read');
  });

  it('switches modes and keeps the saved spot for later', async () => {
    m.read.mockResolvedValue({ placement: 'spot', spot: SPOT });
    expect(await setPlacementAction({ shop: SITE, placement: 'auto' })).toEqual({ ok: true, placement: { placement: 'auto', spot: SPOT } });
    expect(m.write).toHaveBeenCalledWith(SITE, { placement: 'auto', spot: SPOT });
  });

  it('cannot choose a spot that was never saved, or an unknown mode', async () => {
    expect(await setPlacementAction({ shop: SITE, placement: 'spot' })).toMatchObject({ ok: false, reason: 'no_spot' });
    expect(await setPlacementAction({ shop: SITE, placement: 'sideways' as never })).toMatchObject({ ok: false });
    expect(m.write).not.toHaveBeenCalled();
  });

  it('refuses members', async () => {
    m.tenant.mockRejectedValue(new RoleNotAllowedError('settings'));
    expect(await setPlacementAction({ shop: SITE, placement: 'floating' })).toMatchObject({ ok: false, code: 'forbidden' });
    expect(await readPlacementAction({ shop: SITE })).toMatchObject({ ok: false, code: 'forbidden' });
    expect(m.write).not.toHaveBeenCalled();
  });
});
