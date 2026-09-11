// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  signStorefrontContext,
  signTryOnAttempt,
  signTryOnSession,
  verifyTryOnSession,
} from '@/lib/try-on/storefront-context';

/* Regression for a real leak: four persistence/reconciliation error classes
   carry internal ops language in their .message ("awaiting billing
   reconciliation", "storage is not ready") and used to be echoed verbatim
   to the shopper, bypassing lib/try-on/shopper-errors.ts's whole reason for
   existing. These must always resolve to a plain, safe sentence instead. */

const rateLimitMock = vi.fn();
vi.mock('@/lib/ratelimit', () => ({
  publicApiRatelimit: { configured: true, limit: (...args: unknown[]) => rateLimitMock(...args) },
  clientIp: () => 'test-ip',
}));

const generateTryOnMock = vi.fn();
vi.mock('@/lib/try-on/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/try-on/service')>();
  return { ...actual, generateTryOn: (...args: unknown[]) => generateTryOnMock(...args) };
});

import { POST } from '@/app/api/try-on/generate/route';
import {
  TryOnFinalizationPendingError,
  TryOnResultPersistenceError,
  TryOnResultSchemaNotReadyError,
  TryOnResultUnavailableError,
} from '@/lib/try-on/result-errors';

const SECRET = 'test-shopify-secret';

function demoSession(productId = 'premium-ringer-tee', now = Math.floor(Date.now() / 1000)) {
  return signTryOnSession(SECRET, { purpose: 'public-demo', productId }, now).token;
}

function attemptFor(sessionToken: string, attemptNonce = 'zyxwvutsrqponmlkjihgfedc') {
  const session = verifyTryOnSession(SECRET, sessionToken);
  if (!session) throw new Error('bad fixture');
  return signTryOnAttempt(SECRET, { session, attemptNonce }).token;
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/try-on/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  process.env.SHOPIFY_API_SECRET = SECRET;
  rateLimitMock.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
});

afterEach(() => {
  delete process.env.SHOPIFY_API_SECRET;
  vi.clearAllMocks();
});

describe('POST /api/try-on/generate — shopper-safe persistence errors', () => {
  const cases: Array<[string, () => Error, number]> = [
    ['TryOnFinalizationPendingError', () => new TryOnFinalizationPendingError('job-1'), 503],
    ['TryOnResultUnavailableError', () => new TryOnResultUnavailableError('job-1'), 409],
    ['TryOnResultSchemaNotReadyError', () => new TryOnResultSchemaNotReadyError('job-1'), 503],
    ['TryOnResultPersistenceError', () => new TryOnResultPersistenceError('job-1'), 503],
  ];

  it.each(cases)('never echoes %s\'s internal message to the shopper', async (_name, makeError, expectedStatus) => {
    generateTryOnMock.mockRejectedValue(makeError());
    const sessionId = demoSession();

    const response = await POST(
      makeRequest({
        sessionId,
        attemptId: attemptFor(sessionId),
        productId: 'premium-ringer-tee',
        photoSource: 'mock',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(expectedStatus);
    expect(body.ok).toBe(false);
    expect(body.message).not.toMatch(/billing reconciliation|storage is not ready|stored safely/i);
    expect(body.error).not.toMatch(/billing reconciliation|storage is not ready|stored safely/i);
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });
});
