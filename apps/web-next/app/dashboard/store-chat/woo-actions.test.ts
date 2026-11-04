// @vitest-environment node
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    auth: vi.fn(),
    requireSiteAccess: vi.fn(),
    requireMerchantRateLimit: vi.fn(),
    insert: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/messenger/provisioning', () => ({
  requireSiteAccess: mocks.requireSiteAccess,
  UnauthorizedError: mocks.UnauthorizedError,
}));
vi.mock('@/lib/request-rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/request-rate-limit')>()),
  requireMerchantRateLimit: mocks.requireMerchantRateLimit,
}));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: vi.fn((table: string) => {
      expect(table).toBe('woo_pairing_codes');
      return { insert: mocks.insert };
    }),
  }),
}));

import { RequestRateLimitError } from '@/lib/request-rate-limit';
import { createWooPairingCodeAction } from './woo-actions';

const SITE = { id: '11111111-1111-4111-8111-111111111111' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.auth.mockResolvedValue({ userId: 'user-owner' });
  mocks.requireSiteAccess.mockResolvedValue(SITE);
  mocks.insert.mockResolvedValue({ error: null });
});

describe('createWooPairingCodeAction', () => {
  it('stores only a hash and returns an eight-character code once', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T10:00:00.000Z'));

    const result = await createWooPairingCodeAction(SITE.id);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected a pairing code');
    expect(result.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(result.expiresAt).toBe('2026-11-04T10:15:00.000Z');
    expect(mocks.requireSiteAccess).toHaveBeenCalledWith('user-owner', SITE.id, 'settings');
    expect(mocks.requireMerchantRateLimit).toHaveBeenCalledWith(`site:${SITE.id}`, 'write');
    expect(mocks.insert).toHaveBeenCalledWith({
      code_hash: createHash('sha256').update(result.code, 'utf8').digest('hex'),
      widget_site_id: SITE.id,
      created_by: 'user-owner',
      expires_at: result.expiresAt,
    });
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain(result.code);
  });

  it('refuses signed-out and unauthorized callers before writing', async () => {
    mocks.auth.mockResolvedValueOnce({ userId: null });
    await expect(createWooPairingCodeAction(SITE.id)).resolves.toMatchObject({
      ok: false,
      code: 'forbidden',
    });
    expect(mocks.requireSiteAccess).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();

    mocks.requireSiteAccess.mockRejectedValueOnce(new mocks.UnauthorizedError());
    await expect(createWooPairingCodeAction('another-site')).resolves.toMatchObject({
      ok: false,
      code: 'forbidden',
    });
    expect(mocks.requireMerchantRateLimit).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('fails closed when rate enforcement is limited or unavailable', async () => {
    mocks.requireMerchantRateLimit.mockRejectedValueOnce(new RequestRateLimitError(429, 12));
    await expect(createWooPairingCodeAction(SITE.id)).resolves.toMatchObject({
      ok: false,
      code: 'rate_limited',
      retryAfterSeconds: 12,
    });
    expect(mocks.insert).not.toHaveBeenCalled();

    mocks.requireMerchantRateLimit.mockRejectedValueOnce(new RequestRateLimitError(503, 30));
    await expect(createWooPairingCodeAction(SITE.id)).resolves.toMatchObject({
      ok: false,
      code: 'unavailable',
      retryAfterSeconds: 30,
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('never returns database internals', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.insert.mockResolvedValueOnce({ error: { message: 'relation woo_pairing_codes missing' } });
    const result = await createWooPairingCodeAction(SITE.id);
    expect(result).toMatchObject({ ok: false, code: 'unavailable' });
    expect(JSON.stringify(result)).not.toContain('relation');
  });
});
