import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyTryOnCompleted } from './webhook';
import type { TryOnJob } from './types';

const ORIGINAL_ENV = {
  TRYON_COMPLETED_WEBHOOK_URL: process.env.TRYON_COMPLETED_WEBHOOK_URL,
  TRYON_COMPLETED_WEBHOOK_TOKEN: process.env.TRYON_COMPLETED_WEBHOOK_TOKEN,
  NODE_ENV: process.env.NODE_ENV,
};

function makeJob(overrides: Partial<TryOnJob> = {}): TryOnJob {
  return {
    jobId: 'tryon_test_123',
    sessionId: 'sess_test',
    productId: 'premium-ringer-tee',
    status: 'completed',
    resultImageUrl: '/try-on/mock-result.png',
    message: 'Demo preview generated.',
    createdAt: '2026-05-06T12:00:00.000Z',
    completedAt: '2026-05-06T12:00:01.000Z',
    meta: {
      runtime: 'mock',
      provider: 'mock',
      costEstimate: 0,
    },
    ...overrides,
  };
}

function restoreEnv() {
  if (ORIGINAL_ENV.TRYON_COMPLETED_WEBHOOK_URL === undefined) {
    delete process.env.TRYON_COMPLETED_WEBHOOK_URL;
  } else {
    process.env.TRYON_COMPLETED_WEBHOOK_URL = ORIGINAL_ENV.TRYON_COMPLETED_WEBHOOK_URL;
  }

  if (ORIGINAL_ENV.TRYON_COMPLETED_WEBHOOK_TOKEN === undefined) {
    delete process.env.TRYON_COMPLETED_WEBHOOK_TOKEN;
  } else {
    process.env.TRYON_COMPLETED_WEBHOOK_TOKEN = ORIGINAL_ENV.TRYON_COMPLETED_WEBHOOK_TOKEN;
  }

  process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  restoreEnv();
});

describe('notifyTryOnCompleted', () => {
  it('skips safely when no webhook URL is configured', async () => {
    delete process.env.TRYON_COMPLETED_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await notifyTryOnCompleted(makeJob(), {
      hasPhoto: true,
      cta: 'none',
    });

    expect(result).toEqual({ ok: true, skipped: true, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a safe completion payload when webhook URL is configured', async () => {
    process.env.TRYON_COMPLETED_WEBHOOK_URL = 'https://n8n.example.test/webhook/try-on';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await notifyTryOnCompleted(makeJob(), {
      hasPhoto: true,
      cta: 'none',
      userAgent: 'vitest-agent',
    });

    expect(result).toEqual({ ok: true, skipped: false, status: 204 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://n8n.example.test/webhook/try-on',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string);
    expect(payload).toMatchObject({
      source: 'grindctrl_tryon',
      event: 'tryon_completed',
      jobId: 'tryon_test_123',
      productId: 'premium-ringer-tee',
      productName: 'Premium Ringer Tee',
      status: 'completed',
      lead: {
        hasPhoto: true,
        cta: 'none',
      },
      meta: {
        runtime: 'mock',
        provider: 'mock',
        userAgent: 'vitest-agent',
      },
    });
    expect(payload.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sends the optional token as a server-side auth header', async () => {
    process.env.TRYON_COMPLETED_WEBHOOK_URL = 'https://n8n.example.test/webhook/try-on';
    process.env.TRYON_COMPLETED_WEBHOOK_TOKEN = 'server-only-token';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await notifyTryOnCompleted(makeJob(), { hasPhoto: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'x-grindctrl-tryon-token': 'server-only-token',
    });
  });

  it('returns an internal failure result when the webhook request rejects', async () => {
    process.env.TRYON_COMPLETED_WEBHOOK_URL = 'https://n8n.example.test/webhook/try-on';
    process.env.NODE_ENV = 'production';
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await notifyTryOnCompleted(makeJob(), { hasPhoto: true });

    expect(result).toEqual({ ok: false, skipped: false, reason: 'request_failed' });
  });

  it('does not include photo bytes, preview URLs, result URLs, secrets, or client config', async () => {
    process.env.TRYON_COMPLETED_WEBHOOK_URL = 'https://n8n.example.test/webhook/try-on';
    process.env.TRYON_COMPLETED_WEBHOOK_TOKEN = 'server-only-token';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await notifyTryOnCompleted(makeJob(), { hasPhoto: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const serializedPayload = init.body as string;
    expect(serializedPayload).not.toContain('data:image');
    expect(serializedPayload).not.toContain('base64');
    expect(serializedPayload).not.toContain('photoReference');
    expect(serializedPayload).not.toContain('customerPhotoDataUrl');
    expect(serializedPayload).not.toContain('resultImageUrl');
    expect(serializedPayload).not.toContain('server-only-token');
    expect(serializedPayload).not.toContain('TRYON_COMPLETED_WEBHOOK_URL');
    expect(serializedPayload).not.toContain('TRYON_COMPLETED_WEBHOOK_TOKEN');
  });

  it('does not send a completed webhook for failed jobs', async () => {
    process.env.TRYON_COMPLETED_WEBHOOK_URL = 'https://n8n.example.test/webhook/try-on';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await notifyTryOnCompleted(makeJob({ status: 'failed' }), {
      hasPhoto: true,
    });

    expect(result).toEqual({ ok: true, skipped: true, reason: 'job_not_completed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
