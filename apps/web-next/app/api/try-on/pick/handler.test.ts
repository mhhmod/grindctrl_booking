// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ ip: vi.fn(), shop: vi.fn(), check: vi.fn(), save: vi.fn(), settings: vi.fn() }));
vi.mock('@/lib/ratelimit', () => ({ clientIp: () => '203.0.113.9', publicApiRatelimit: { limit: m.ip }, proxyShopReadRatelimit: { limit: m.shop } }));
vi.mock('@/lib/try-on/pick-token', async (original) => ({ ...await original<object>(), checkPickToken: m.check, savePickedSpot: m.save }));
vi.mock('@/lib/try-on/settings', () => ({ getTryOnSettings: m.settings }));
vi.mock('server-only', () => ({}));
import { POST as verify } from './verify/route';
import { POST as save } from './save/route';

const ORIGIN = 'https://shop.example';
const SHOP = 'site:11111111-1111-4111-8111-111111111111';
const body = { token: 'tok', claim: 'c'.repeat(43) };
const spot = { selector: 'form[action*="cart"]', position: 'after', label: 'Add to cart', pathHint: '/products/dress' };
const request = (path: string, payload: unknown, origin: string | null = ORIGIN) => new NextRequest(`https://grindctrl.cloud/api/try-on/pick/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', ...(origin ? { origin } : {}) }, body: JSON.stringify(payload),
});

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of [m.ip, m.shop]) fn.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
  m.check.mockResolvedValue({ ok: true, id: 'id', shop: SHOP, preset: null });
  m.save.mockResolvedValue({ ok: true, id: 'id', shop: SHOP, preset: null });
  m.settings.mockResolvedValue({ buttonLabel: 'Try it on', buttonLabelAr: 'جرّبها', accentBg: '#c2410c', accentFg: '#fff', radiusPx: 999,
    iconBgFrom: '#ff9a3d', iconBgTo: '#ffd76e', buttonIconPx: 28, catalogLabel: 'Try on', catalogLabelAr: null });
});

describe('POST /api/try-on/pick/verify', () => {
  it('answers only the signed store origin, with the owner button look in the page language', async () => {
    const res = await verify(request('verify', { ...body, locale: 'ar' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true, preset: null, button: expect.objectContaining({ buttonLabel: 'جرّبها', accentBg: '#c2410c' }) });
    expect(m.check).toHaveBeenCalledWith('tok', ORIGIN, body.claim);
    expect(m.ip).toHaveBeenCalledWith('pick:ip:203.0.113.9');
    expect(m.shop).toHaveBeenCalledWith(`pick:shop:${SHOP}`);
  });

  it.each([null, 'http://shop.example', 'null', 'https://shop.example/path'])('refuses origin %s before reading the link', async (origin) => {
    const res = await verify(request('verify', body, origin));
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(m.check).not.toHaveBeenCalled();
  });

  it('lets the signed origin read that its link expired, and nobody else', async () => {
    m.check.mockResolvedValueOnce({ ok: false, cors: true });
    let res = await verify(request('verify', body));
    expect([res.status, res.headers.get('access-control-allow-origin')]).toEqual([410, ORIGIN]);
    m.check.mockResolvedValueOnce({ ok: false, cors: false });
    res = await verify(request('verify', body, 'https://evil.example'));
    expect([res.status, res.headers.get('access-control-allow-origin')]).toEqual([410, null]);
  });

  it('fails closed on rate limits and outages, with no CORS grant', async () => {
    m.ip.mockResolvedValueOnce({ success: false, reset: Date.now() + 5000 });
    let res = await verify(request('verify', body));
    expect([res.status, res.headers.get('access-control-allow-origin')]).toEqual([429, null]);
    expect(m.check).not.toHaveBeenCalled();
    m.check.mockRejectedValueOnce(new Error('pick storage unavailable'));
    res = await verify(request('verify', body));
    expect([res.status, res.headers.get('access-control-allow-origin')]).toEqual([503, null]);
  });
});

describe('POST /api/try-on/pick/save', () => {
  it('verifies, rate limits the store, then consumes and saves the spot', async () => {
    const res = await save(request('save', { ...body, ...spot }));
    expect([res.status, res.headers.get('access-control-allow-origin')]).toEqual([200, ORIGIN]);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.check).toHaveBeenCalledWith('tok', ORIGIN, body.claim);
    expect(m.save).toHaveBeenCalledWith('tok', ORIGIN, body.claim, spot);
    expect(m.shop.mock.invocationCallOrder[0]).toBeLessThan(m.save.mock.invocationCallOrder[0]);
  });

  it.each([
    { ...spot, selector: 'a[title="x"],script' },
    { ...spot, selector: "a[href='javascript:alert(1)']" },
    { ...spot, selector: 'div.' + 'a'.repeat(300) },
    { ...spot, position: 'inside' },
    { ...spot, pathHint: 'https://evil.example' },
    { ...spot, label: '<b>x</b>' },
  ])('refuses an invalid spot without spending the link %#', async (bad) => {
    const res = await save(request('save', { ...body, ...bad }));
    expect([res.status, res.headers.get('access-control-allow-origin')]).toEqual([400, ORIGIN]);
    expect(m.save).not.toHaveBeenCalled();
  });

  it('reports a spent or expired link as expired', async () => {
    m.save.mockResolvedValueOnce({ ok: false, cors: true });
    const res = await save(request('save', { ...body, ...spot }));
    expect([res.status, res.headers.get('access-control-allow-origin')]).toEqual([410, ORIGIN]);
    expect(await res.json()).toEqual({ code: 'expired' });
  });

  it('refuses an oversized body', async () => {
    const res = await save(request('save', { ...body, ...spot, padding: 'x'.repeat(5000) }));
    expect(res.status).toBe(400);
    expect(m.check).not.toHaveBeenCalled();
  });
});
