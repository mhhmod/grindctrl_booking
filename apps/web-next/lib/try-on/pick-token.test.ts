// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ insert: vi.fn(), rpc: vi.fn(), active: vi.fn(), invalidate: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: () => ({ insert: m.insert }), rpc: m.rpc }) }));
vi.mock('@/lib/shopify/tokens', () => ({ isActiveTenant: m.active }));
vi.mock('@/lib/shopify/proxy-config-cache', () => ({ invalidateProxyConfig: m.invalidate }));
import { checkPickToken, claimHash, createPickToken, PICK_TTL_MS, savePickedSpot } from './pick-token';

const ORIGIN = 'https://shop.example';
const SHOP = 'site:11111111-1111-4111-8111-111111111111';
const CLAIM = 'c'.repeat(43);
const SPOT = { selector: '#buy', position: 'after' as const, label: 'Add to cart', pathHint: '/products/dress' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 's'.repeat(40));
  m.insert.mockResolvedValue({ error: null });
  m.active.mockResolvedValue(true);
  m.rpc.mockImplementation(async (name: string) => name === 'claim_tryon_pick_token'
    ? { data: { shop: SHOP, preset: null }, error: null }
    : { data: true, error: null });
});
afterEach(() => vi.unstubAllEnvs());

async function link(now = Date.now(), origin = ORIGIN) {
  return (await createPickToken({ shop: SHOP, origin, createdBy: 'user_1', now })).token;
}

describe('pick a spot link', () => {
  it('is created for one store origin, expires in 30 minutes and stores who made it', async () => {
    const now = Date.parse('2026-11-11T10:00:00Z');
    const made = await createPickToken({ shop: SHOP, origin: ORIGIN, createdBy: 'user_1', now, preset: { selector: '#buy', position: 'before' } });
    expect(made.expiresAt).toBe(new Date(now + PICK_TTL_MS).toISOString());
    expect(made.token).toMatch(/^[0-9a-f-]{36}\.\d{13}\.[A-Za-z0-9_-]{43}$/);
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({
      shop: SHOP, origin: ORIGIN, created_by: 'user_1', preset: { selector: '#buy', position: 'before' }, expires_at: made.expiresAt,
    }));
  });

  it.each([
    ['the default tenant', { shop: 'default' }],
    ['no creator', { createdBy: '' }],
    ['an http origin', { origin: 'http://shop.example' }],
    ['an origin with a path', { origin: 'https://shop.example/x' }],
    ['an invalid preset', { preset: { selector: 'a:hover', position: 'after' as const } }],
  ])('is refused for %s', async (_, override) => {
    await expect(createPickToken({ shop: SHOP, origin: ORIGIN, createdBy: 'user_1', ...override })).rejects.toThrow();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('fails closed without the capability secret', async () => {
    vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', '');
    await expect(link()).rejects.toThrow('pick signing unavailable');
  });

  it('verifies and claims for the tab that holds the claim, with the stored preset', async () => {
    m.rpc.mockResolvedValueOnce({ data: { shop: SHOP, preset: { selector: '#buy', position: 'before' } }, error: null });
    const token = await link();
    const checked = await checkPickToken(token, ORIGIN, CLAIM);
    expect(checked).toEqual({ ok: true, id: token.split('.')[0], shop: SHOP, preset: { selector: '#buy', position: 'before' } });
    expect(m.rpc).toHaveBeenCalledWith('claim_tryon_pick_token', {
      p_id: token.split('.')[0], p_origin: ORIGIN, p_claim: createHash('sha256').update(CLAIM).digest('hex'),
    });
  });

  it('answers another store origin with nothing, not even CORS, and never reads the database', async () => {
    const token = await link();
    expect(await checkPickToken(token, 'https://evil.example', CLAIM)).toEqual({ ok: false, cors: false });
    expect(await checkPickToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), ORIGIN, CLAIM)).toEqual({ ok: false, cors: false });
    expect(await checkPickToken('not-a-token', ORIGIN, CLAIM)).toEqual({ ok: false, cors: false });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('expires after 30 minutes; the store origin may still read that it expired', async () => {
    const now = Date.now();
    const token = await link(now - PICK_TTL_MS - 1);
    expect(await checkPickToken(token, ORIGIN, CLAIM, now)).toEqual({ ok: false, cors: true });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('refuses a missing claim, a link already claimed by another tab or spent, and a store no longer connected', async () => {
    const token = await link();
    expect(await checkPickToken(token, ORIGIN, 'short')).toEqual({ ok: false, cors: true });
    m.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await checkPickToken(token, ORIGIN, CLAIM)).toEqual({ ok: false, cors: true });
    m.active.mockResolvedValueOnce(false);
    expect(await checkPickToken(token, ORIGIN, CLAIM)).toEqual({ ok: false, cors: true });
    m.rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    await expect(checkPickToken(token, ORIGIN, CLAIM)).rejects.toThrow('pick storage unavailable');
  });

  it('saves once: verifies again, consumes with the claim and clears cached configs', async () => {
    const token = await link();
    expect(await savePickedSpot(token, ORIGIN, CLAIM, SPOT)).toMatchObject({ ok: true, shop: SHOP });
    expect(m.rpc).toHaveBeenLastCalledWith('save_tryon_picked_spot', {
      p_id: token.split('.')[0], p_shop: SHOP, p_origin: ORIGIN, p_claim: claimHash(CLAIM), p_spot: SPOT,
    });
    expect(m.invalidate).toHaveBeenCalledWith(SHOP);
    // Spent: the claim no longer matches a live row.
    m.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await savePickedSpot(token, ORIGIN, CLAIM, SPOT)).toEqual({ ok: false, cors: true });
    // Consumed between the check and the save (a second tab racing).
    m.rpc.mockResolvedValueOnce({ data: { shop: SHOP, preset: null }, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect(await savePickedSpot(token, ORIGIN, CLAIM, SPOT)).toEqual({ ok: false, cors: true });
  });
});
