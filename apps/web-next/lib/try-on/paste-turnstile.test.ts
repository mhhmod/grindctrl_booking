// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pasteTurnstileConfig, pasteTurnstileBinding, verifyPasteTurnstile } from '@/lib/paste/turnstile';
import type { VerifiedTryOnSession } from './storefront-context';

// Cloudflare documented dummy keys. Every siteverify call here is mocked.
const PASS_SECRET = '1x0000000000000000000000000000000AA';
const FAIL_SECRET = '2x0000000000000000000000000000000AA';
const PASS_SITE = '1x00000000000000000000AA';
const authorization = { platform: 'paste-website', shop: 'site:11111111-1111-4111-8111-111111111111', requestKey: '11111111-1111-4111-8111-111111111111' } as VerifiedTryOnSession;
const token = 'XXXX.DUMMY.TOKEN.XXXX';
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const valid = () => ({ success: true, hostname: 'grindctrl.cloud', action: 'paste_tryon', cdata: pasteTurnstileBinding(authorization) });
beforeEach(() => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', PASS_SECRET); vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', PASS_SITE);
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud');
  fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => Response.json({ ...valid(),
    success: new URLSearchParams(init?.body as URLSearchParams).get('secret') === PASS_SECRET }));
});
afterEach(() => vi.unstubAllEnvs());

describe('paid website look Turnstile gate', () => {
  it('passes with the always-pass test key, action, own iframe hostname and attempt binding', async () => {
    expect(await verifyPasteTurnstile({ token, authorization, remoteIp: '203.0.113.10' }, fetcher)).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith('https://challenges.cloudflare.com/turnstile/v0/siteverify', expect.objectContaining({ method: 'POST', redirect: 'error', cache: 'no-store' }));
    expect(pasteTurnstileConfig()).toEqual({ siteKey: PASS_SITE, action: 'paste_tryon' });
    expect(JSON.stringify(pasteTurnstileConfig())).not.toContain(PASS_SECRET);
  });
  it('fails with the always-fail test key', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', FAIL_SECRET);
    expect(await verifyPasteTurnstile({ token, authorization }, fetcher)).toEqual({ ok: false, code: 'turnstile_failed' });
  });
  it('fails closed on missing secret or token', async () => {
    expect(await verifyPasteTurnstile({ token: '', authorization }, fetcher)).toEqual({ ok: false, code: 'turnstile_required' });
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect(await verifyPasteTurnstile({ token, authorization }, fetcher)).toEqual({ ok: false, code: 'turnstile_not_configured' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([{ hostname: 'merchant.example' }, { action: 'another-action' }, { cdata: 'another-attempt' }, { success: 'true' }])('rejects misbound response %j', async (patch) => {
    fetcher.mockResolvedValue(Response.json({ ...valid(), ...patch }));
    expect(await verifyPasteTurnstile({ token, authorization }, fetcher)).toEqual({ ok: false, code: 'turnstile_failed' });
  });
  it.each(['network', 'timeout', 'malformed', 'http'])('fails closed on %s failure', async (kind) => {
    if (kind === 'http') fetcher.mockResolvedValue(new Response('', { status: 503 }));
    else if (kind === 'malformed') fetcher.mockResolvedValue(new Response('not JSON'));
    else fetcher.mockRejectedValue(new Error(kind));
    expect(await verifyPasteTurnstile({ token, authorization }, fetcher)).toEqual({ ok: false, code: 'turnstile_unavailable' });
  });
  it.each(['paste-shopify', 'woocommerce', undefined] as const)('leaves %s generation unchanged without a Turnstile secret', async (platform) => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect(await verifyPasteTurnstile({ token: null, authorization: { ...authorization, platform } }, fetcher)).toEqual({ ok: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('exempts only the signed test-look flag and binds a different paid attempt differently', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect(await verifyPasteTurnstile({ token: null, authorization: { ...authorization, test: true } }, fetcher)).toEqual({ ok: true });
    expect(pasteTurnstileBinding({ ...authorization, requestKey: 'different' })).not.toBe(pasteTurnstileBinding(authorization));
  });
});
