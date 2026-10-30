// apps/web-next/lib/shopify/session-token.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateShopifyRequest, verifySessionTokenResolved } from './session-token';
import { createHmac } from 'node:crypto';

const activeInstallation = vi.hoisted(() => vi.fn(async () => true));
vi.mock('./tokens', () => ({ isActiveShopifyInstallation: activeInstallation }));

const SECRET = 'test-secret';
const CLIENT_ID = 'fc095fe656d9029fdc249a4af2315f19';

function makeToken(
  secret: string,
  overrides: Partial<{ aud: string; dest: string; iss: string; sub: string; exp: number; nbf: number; iat: number }> = {},
): string {
  const b64url = (input: string) => Buffer.from(input).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      aud: CLIENT_ID,
      dest: 'https://demo.myshopify.com',
      iss: 'https://demo.myshopify.com/admin', sub: '42',
      exp: now + 60,
      nbf: now - 5,
      ...overrides,
    }),
  );
  const body = `${header}.${payload}`;
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function req(headers?: Record<string, string>): NextRequest {
  return new NextRequest(new Request('https://grindctrl.cloud/api/shopify/store-chat/state', { headers }));
}

beforeEach(() => {
  process.env.SHOPIFY_API_KEY = CLIENT_ID;
  process.env.SHOPIFY_API_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.SHOPIFY_API_KEY;
  delete process.env.SHOPIFY_API_SECRET;
  delete process.env.SHOPIFY_APPS;
});

describe('authenticateShopifyRequest', () => {
  it('accepts a valid Bearer token', async () => {
    const session = await authenticateShopifyRequest(req({ authorization: `Bearer ${makeToken(SECRET)}` }));
    expect(session).toEqual({ shop: 'demo.myshopify.com', appClientId: CLIENT_ID, subject: '42' });
  });

  it('accepts a lowercase bearer prefix', async () => {
    const session = await authenticateShopifyRequest(req({ authorization: `bearer ${makeToken(SECRET)}` }));
    expect(session).toEqual({ shop: 'demo.myshopify.com', appClientId: CLIENT_ID, subject: '42' });
  });

  it('rejects a missing Authorization header', async () => {
    expect(await authenticateShopifyRequest(req())).toBeNull();
  });

  it('rejects a header with no token after the prefix', async () => {
    expect(await authenticateShopifyRequest(req({ authorization: 'Bearer ' }))).toBeNull();
  });

  it('rejects an invalid signature', async () => {
    const session = await authenticateShopifyRequest(req({ authorization: `Bearer ${makeToken(SECRET)}xx` }));
    expect(session).toBeNull();
  });
});

describe('verifySessionTokenResolved (multi-app)', () => {
  beforeEach(() => {
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    process.env.SHOPIFY_APPS = JSON.stringify([
      { clientId: 'app-a', secret: 'secret-a' },
      { clientId: 'app-b', secret: 'secret-b' },
    ]);
  });

  it('verifies a token against the app named by its own aud, not the first configured one', () => {
    const token = makeToken('secret-b', { aud: 'app-b' });
    const resolved = verifySessionTokenResolved(token);
    expect(resolved).toEqual({ shop: 'demo.myshopify.com', appClientId: 'app-b', subject: '42', app: { clientId: 'app-b', secret: 'secret-b' } });
  });

  it('rejects a token whose aud names no configured app', () => {
    const token = makeToken('secret-a', { aud: 'unknown-app' });
    expect(verifySessionTokenResolved(token)).toBeNull();
  });

  it('rejects a token signed with a different app`s secret than its aud claims', () => {
    // Payload says app-a, but it was signed with app-b's secret.
    const token = makeToken('secret-b', { aud: 'app-a' });
    expect(verifySessionTokenResolved(token)).toBeNull();
  });
});

describe('required Shopify ID token claims', () => {
  it.each([
    { iss: 'https://other.myshopify.com/admin' },
    { iss: 'http://demo.myshopify.com/admin' },
    { dest: 'https://demo.myshopify.com/other' },
    { dest: 'https://evil@demo.myshopify.com' },
    { iss: 'https://demo.myshopify.com:8443/admin' },
    { sub: '' }, { sub: 'not-a-user' },
    { exp: 0 }, { nbf: Number.MAX_SAFE_INTEGER },
  ])('rejects invalid claims %j', (claims) => {
    expect(verifySessionTokenResolved(makeToken(SECRET, claims))).toBeNull();
  });
  it('rejects a token explicitly declaring a different algorithm', () => {
    const valid = makeToken(SECRET);
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const body = `${header}.${valid.split('.')[1]}`;
    const signed = `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
    expect(verifySessionTokenResolved(signed)).toBeNull();
  });
});

it('rejects a signed session when its own installation is inactive', async () => {
  activeInstallation.mockResolvedValueOnce(false);
  expect(await authenticateShopifyRequest(req({ authorization: `Bearer ${makeToken(SECRET)}` }))).toBeNull();
  expect(activeInstallation).toHaveBeenCalledWith('demo.myshopify.com', CLIENT_ID);
});
