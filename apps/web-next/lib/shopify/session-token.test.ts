// apps/web-next/lib/shopify/session-token.test.ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authenticateShopifyRequest } from './session-token';
import { createHmac } from 'node:crypto';

const SECRET = 'test-secret';

function makeToken(overrides: Partial<{ aud: string; dest: string; exp: number; nbf: number }> = {}): string {
  const b64url = (input: string) => Buffer.from(input).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      aud: 'fc095fe656d9029fdc249a4af2315f19',
      dest: 'https://demo.myshopify.com',
      exp: now + 60,
      nbf: now - 5,
      ...overrides,
    }),
  );
  const body = `${header}.${payload}`;
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function req(headers?: Record<string, string>): NextRequest {
  return new NextRequest(new Request('https://grindctrl.cloud/api/shopify/store-chat/state', { headers }));
}

beforeEach(() => {
  process.env.SHOPIFY_API_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.SHOPIFY_API_SECRET;
});

describe('authenticateShopifyRequest', () => {
  it('accepts a valid Bearer token', () => {
    const session = authenticateShopifyRequest(req({ authorization: `Bearer ${makeToken()}` }));
    expect(session).toEqual({ shop: 'demo.myshopify.com' });
  });

  it('accepts a lowercase bearer prefix', () => {
    const session = authenticateShopifyRequest(req({ authorization: `bearer ${makeToken()}` }));
    expect(session).toEqual({ shop: 'demo.myshopify.com' });
  });

  it('rejects a missing Authorization header', () => {
    expect(authenticateShopifyRequest(req())).toBeNull();
  });

  it('rejects a header with no token after the prefix', () => {
    expect(authenticateShopifyRequest(req({ authorization: 'Bearer ' }))).toBeNull();
  });

  it('rejects an invalid signature', () => {
    const session = authenticateShopifyRequest(req({ authorization: `Bearer ${makeToken()}xx` }));
    expect(session).toBeNull();
  });
});
