// apps/web-next/lib/shopify/session-token.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authenticateShopifyRequest, verifySessionTokenResolved } from './session-token';
import { createHmac } from 'node:crypto';

const SECRET = 'test-secret';
const CLIENT_ID = 'fc095fe656d9029fdc249a4af2315f19';

function makeToken(
  secret: string,
  overrides: Partial<{ aud: string; dest: string; exp: number; nbf: number }> = {},
): string {
  const b64url = (input: string) => Buffer.from(input).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      aud: CLIENT_ID,
      dest: 'https://demo.myshopify.com',
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
  it('accepts a valid Bearer token', () => {
    const session = authenticateShopifyRequest(req({ authorization: `Bearer ${makeToken(SECRET)}` }));
    expect(session).toEqual({ shop: 'demo.myshopify.com' });
  });

  it('accepts a lowercase bearer prefix', () => {
    const session = authenticateShopifyRequest(req({ authorization: `bearer ${makeToken(SECRET)}` }));
    expect(session).toEqual({ shop: 'demo.myshopify.com' });
  });

  it('rejects a missing Authorization header', () => {
    expect(authenticateShopifyRequest(req())).toBeNull();
  });

  it('rejects a header with no token after the prefix', () => {
    expect(authenticateShopifyRequest(req({ authorization: 'Bearer ' }))).toBeNull();
  });

  it('rejects an invalid signature', () => {
    const session = authenticateShopifyRequest(req({ authorization: `Bearer ${makeToken(SECRET)}xx` }));
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
    expect(resolved).toEqual({ shop: 'demo.myshopify.com', app: { clientId: 'app-b', secret: 'secret-b' } });
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
