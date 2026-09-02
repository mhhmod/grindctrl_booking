// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
  clientIp: () => 'test-ip',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}));

import { POST } from './route';
import {
  signTryOnSession,
  verifyTryOnAttempt,
  verifyTryOnSession,
} from '@/lib/try-on/storefront-context';

const SECRET = 'test-shopify-secret';
const ATTEMPT_NONCE = 'abcdefghijklmnopqrstuvwx';
const OTHER_ATTEMPT_NONCE = 'zyxwvutsrqponmlkjihgfedc';

function request(sessionId: string, attemptNonce = ATTEMPT_NONCE) {
  return new NextRequest('https://app.example.com/api/try-on/attempt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      productId: 'premium-ringer-tee',
      attemptNonce,
    }),
  });
}

describe('POST /api/try-on/attempt', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_SECRET;
  });

  it('reuses one signed attempt for an exact HTTP retry', async () => {
    const session = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const first = await (await POST(request(session.token))).json();
    const retry = await (await POST(request(session.token))).json();
    const verifiedSession = verifyTryOnSession(SECRET, session.token)!;
    const firstClaims = verifyTryOnAttempt(SECRET, first.data.attemptId, verifiedSession);
    const retryClaims = verifyTryOnAttempt(SECRET, retry.data.attemptId, verifiedSession);

    expect(retry.data.attemptId).toBe(first.data.attemptId);
    expect(retryClaims?.requestKey).toBe(firstClaims?.requestKey);
  });

  it('mints a new request key for a new explicit generation nonce', async () => {
    const session = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const first = await (await POST(request(session.token))).json();
    const second = await (
      await POST(request(session.token, OTHER_ATTEMPT_NONCE))
    ).json();
    const verifiedSession = verifyTryOnSession(SECRET, session.token)!;

    expect(
      verifyTryOnAttempt(SECRET, second.data.attemptId, verifiedSession)?.requestKey,
    ).not.toBe(
      verifyTryOnAttempt(SECRET, first.data.attemptId, verifiedSession)?.requestKey,
    );
  });

  it('rejects an attempt for an expired session and client authority fields', async () => {
    const expired = signTryOnSession(
      SECRET,
      { purpose: 'public-demo', productId: 'premium-ringer-tee' },
      Math.floor(Date.now() / 1000) - 601,
    );
    expect((await POST(request(expired.token))).status).toBe(401);

    const current = signTryOnSession(SECRET, {
      purpose: 'public-demo',
      productId: 'premium-ringer-tee',
    });
    const injected = new NextRequest('https://app.example.com/api/try-on/attempt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: current.token,
        productId: 'premium-ringer-tee',
        attemptNonce: ATTEMPT_NONCE,
        shop: 'victim.myshopify.com',
      }),
    });
    expect((await POST(injected)).status).toBe(400);
  });
});
