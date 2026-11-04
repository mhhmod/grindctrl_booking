// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: vi.fn((table: string) => {
      expect(table).toBe('woo_site_connections');
      const builder = {
        select: vi.fn(() => builder),
        eq: mocks.eq.mockImplementation(() => builder),
        maybeSingle: mocks.maybeSingle,
      };
      return builder;
    }),
  }),
}));

import { deriveWooSiteSecret } from './site-secret';
import {
  WOO_NONCE_HEADER,
  WOO_SIGNATURE_HEADER,
  setWooReplayStoreForTests,
  signWooRequest,
  verifyWooSignedRequest,
  wooSignatureCanonicalString,
  type WooReplayStore,
} from './signed-request';

const SITE_ID = '123e4567-e89b-12d3-a456-426614174000';
const CORE = 'test-only-independent-core-signing-key-2026';
const PATH = '/api/woo/heartbeat';
const NOW = 1_799_999_999;
const NONCE = Buffer.alloc(16, 7).toString('base64url');
const BODY = JSON.stringify({ pluginVersion: '0.2.0' });

const replayStore: WooReplayStore = { claim: vi.fn() };
let restoreReplayStore: () => void;

function connection(overrides: Record<string, unknown> = {}) {
  return {
    secret_version: 1,
    status: 'active',
    home_url: 'https://shop.example.com',
    ...overrides,
  };
}

function signedRequest(body = BODY, options: { timestamp?: number; nonce?: string; path?: string } = {}) {
  const secret = deriveWooSiteSecret(SITE_ID, 1);
  if (!secret) throw new Error('test secret missing');
  const path = options.path ?? PATH;
  const headers = signWooRequest({
    secret,
    siteId: SITE_ID,
    method: 'POST',
    path,
    body,
    timestamp: options.timestamp ?? NOW,
    nonce: options.nonce ?? NONCE,
  });
  return new Request(`https://grindctrl.cloud${PATH}`, { method: 'POST', headers, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GRINDCTRL_CAPABILITY_SECRET = CORE;
  mocks.maybeSingle.mockResolvedValue({ data: connection(), error: null });
  vi.mocked(replayStore.claim).mockResolvedValue(true);
  restoreReplayStore = setWooReplayStoreForTests(replayStore);
});

afterEach(() => {
  restoreReplayStore();
  delete process.env.GRINDCTRL_CAPABILITY_SECRET;
});

describe('Woo signed requests', () => {
  it('builds the exact canonical string and protocol headers', () => {
    const canonical = wooSignatureCanonicalString({
      method: 'post',
      path: PATH,
      timestamp: NOW,
      nonce: NONCE,
      body: BODY,
    });
    expect(canonical).toBe(
      `POST\n${PATH}\n${NOW}\n${NONCE}\n${createHash('sha256').update(BODY).digest('hex')}`,
    );

    const request = signedRequest();
    expect(request.headers.get(WOO_NONCE_HEADER)).toBe(NONCE);
    expect(request.headers.get(WOO_SIGNATURE_HEADER)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  // The same vector is quoted in the plugin's grindctrl_sc_signed_headers().
  // If either side changes the canonical string, this and the PHP must change
  // together, or every signed call from an installed plugin fails.
  it('signs the cross-language known-answer vector', () => {
    const secret = 'A'.repeat(43);
    const nonce = 'AAECAwQFBgcICQoLDA0ODxAR';
    const body = '{"pluginVersion":"0.2.0"}';

    expect(wooSignatureCanonicalString({
      method: 'POST',
      path: PATH,
      timestamp: 1_799_999_999,
      nonce,
      body,
    })).toBe(
      'POST\n/api/woo/heartbeat\n1799999999\nAAECAwQFBgcICQoLDA0ODxAR\n'
      + 'e510b690f211bbc1137804e5bb0bec8cdb902d516a3f125542270e4943f5fcde',
    );
    expect(signWooRequest({
      secret,
      siteId: SITE_ID,
      method: 'POST',
      path: PATH,
      body,
      timestamp: 1_799_999_999,
      nonce,
    })).toEqual({
      'X-GC-Site': SITE_ID,
      'X-GC-Timestamp': '1799999999',
      'X-GC-Nonce': nonce,
      'X-GC-Signature': 'vxmbLCq5jIPVvzPOqL5kALGMKfA47r-PaVdXOHPD6A8',
    });
  });

  it('accepts a valid signature and claims the nonce for 600 seconds', async () => {
    const result = await verifyWooSignedRequest(signedRequest(), BODY, { nowSeconds: NOW });

    expect(result).toEqual({
      ok: true,
      siteId: SITE_ID,
      secretVersion: 1,
      connectionStatus: 'active',
      homeUrl: 'https://shop.example.com',
    });
    expect(replayStore.claim).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^gc-woo:nonce:v1:${SITE_ID}:[0-9a-f]{64}$`)),
      600,
    );
  });

  it('rejects a wrong signature before claiming a nonce', async () => {
    const request = signedRequest();
    const headers = new Headers(request.headers);
    const signature = headers.get(WOO_SIGNATURE_HEADER)!;
    headers.set(WOO_SIGNATURE_HEADER, `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`);
    const tampered = new Request(request.url, { method: 'POST', headers, body: BODY });

    await expect(verifyWooSignedRequest(tampered, BODY, { nowSeconds: NOW })).resolves.toMatchObject({
      ok: false,
      code: 'bad_signature',
    });
    expect(replayStore.claim).not.toHaveBeenCalled();
  });

  it('binds the signature to the exact body', async () => {
    await expect(
      verifyWooSignedRequest(signedRequest(BODY), `${BODY} `, { nowSeconds: NOW }),
    ).resolves.toMatchObject({ ok: false, code: 'bad_signature' });
    expect(replayStore.claim).not.toHaveBeenCalled();
  });

  it.each([
    ['stale', NOW - 301],
    ['future', NOW + 301],
  ])('rejects a %s timestamp and returns server time', async (_label, timestamp) => {
    const result = await verifyWooSignedRequest(signedRequest(BODY, { timestamp }), BODY, {
      nowSeconds: NOW,
    });

    expect(result).toEqual({
      ok: false,
      code: 'stale_timestamp',
      status: 401,
      siteId: SITE_ID,
      serverTime: NOW,
    });
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
    expect(replayStore.claim).not.toHaveBeenCalled();
  });

  it('rejects a nonce that was already claimed', async () => {
    vi.mocked(replayStore.claim).mockResolvedValue(false);

    await expect(verifyWooSignedRequest(signedRequest(), BODY, { nowSeconds: NOW })).resolves.toEqual({
      ok: false,
      code: 'replayed',
      status: 409,
      siteId: SITE_ID,
    });
  });

  it('denies when Redis is unavailable', async () => {
    vi.mocked(replayStore.claim).mockRejectedValue(new Error('redis down'));

    await expect(verifyWooSignedRequest(signedRequest(), BODY, { nowSeconds: NOW })).resolves.toEqual({
      ok: false,
      code: 'unavailable',
      status: 503,
      siteId: SITE_ID,
    });
  });

  it('denies when no replay store is configured at all', async () => {
    restoreReplayStore();
    restoreReplayStore = setWooReplayStoreForTests(null);

    await expect(verifyWooSignedRequest(signedRequest(), BODY, { nowSeconds: NOW })).resolves.toEqual({
      ok: false,
      code: 'unavailable',
      status: 503,
      siteId: SITE_ID,
    });
  });

  it('denies when the connection lookup fails', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'db down' } });

    await expect(verifyWooSignedRequest(signedRequest(), BODY, { nowSeconds: NOW })).resolves.toEqual({
      ok: false,
      code: 'unavailable',
      status: 503,
      siteId: SITE_ID,
    });
    expect(replayStore.claim).not.toHaveBeenCalled();
  });

  it('denies a disconnected site before claiming its nonce', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: connection({ status: 'disconnected' }),
      error: null,
    });

    await expect(verifyWooSignedRequest(signedRequest(), BODY, { nowSeconds: NOW })).resolves.toEqual({
      ok: false,
      code: 'site_disconnected',
      status: 403,
      siteId: SITE_ID,
    });
    expect(replayStore.claim).not.toHaveBeenCalled();
  });

  it('allows only the idempotent disconnect path to authenticate a disconnected site', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: connection({ status: 'disconnected' }),
      error: null,
    });

    await expect(
      verifyWooSignedRequest(signedRequest(), BODY, { nowSeconds: NOW, allowDisconnected: true }),
    ).resolves.toMatchObject({ ok: true, connectionStatus: 'disconnected' });
  });

  it('answers an unknown site like a bad signature', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(verifyWooSignedRequest(signedRequest(), BODY, { nowSeconds: NOW })).resolves.toEqual({
      ok: false,
      code: 'bad_signature',
      status: 401,
      siteId: SITE_ID,
    });
    expect(replayStore.claim).not.toHaveBeenCalled();
  });
});
