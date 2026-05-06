import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/try-on/generate/route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/try-on/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const ORIGINAL_ENV = {
  TRYON_COMPLETED_WEBHOOK_URL: process.env.TRYON_COMPLETED_WEBHOOK_URL,
  TRYON_COMPLETED_WEBHOOK_TOKEN: process.env.TRYON_COMPLETED_WEBHOOK_TOKEN,
  TRYON_MODE: process.env.TRYON_MODE,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  restoreEnv();
});

describe('POST /api/try-on/generate', () => {
  it('rejects generation with only sessionId and productId', async () => {
    const response = await POST(
      makeRequest({
        sessionId: 'sess_test',
        productId: 'premium-ringer-tee',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.message).toMatch(/photo reference is required/i);
  });

  it('accepts generation with an uploaded photo reference', async () => {
    const response = await POST(
      makeRequest({
        sessionId: 'sess_test',
        productId: 'premium-ringer-tee',
        photoReference: 'uploaded-photo',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.jobId).toMatch(/^tryon_/);
    expect(body.status).toBe('completed');
    expect(body.resultImageUrl).toBe('/try-on/mock-result.png');
    expect(body.productId).toBe('premium-ringer-tee');
    expect(body.message).toMatch(/mock mode/i);
    expect(body.meta.runtime).toBe('mock');
    expect(body.data).toBeUndefined();
  });

  it('accepts generation with explicit mock photo flag', async () => {
    const response = await POST(
      makeRequest({
        sessionId: 'sess_test',
        productId: 'premium-ringer-tee',
        useMockPhoto: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.jobId).toMatch(/^tryon_/);
    expect(body.status).toBe('completed');
    expect(body.productId).toBe('premium-ringer-tee');
    expect(body.meta.runtime).toBe('mock');
    expect(body.data).toBeUndefined();
  });

  it('keeps generation successful when the completion webhook fails', async () => {
    process.env.TRYON_COMPLETED_WEBHOOK_URL = 'https://n8n.example.test/webhook/try-on';
    process.env.NODE_ENV = 'production';
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest({
        sessionId: 'sess_test',
        productId: 'premium-ringer-tee',
        photoReference: 'uploaded-photo',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.jobId).toMatch(/^tryon_/);
    expect(body.status).toBe('completed');
    expect(body.data).toBeUndefined();
    expect(body.webhook).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not send the completed webhook when live fallback returns a failed job', async () => {
    process.env.TRYON_MODE = 'live';
    process.env.TRYON_COMPLETED_WEBHOOK_URL = 'https://n8n.example.test/webhook/try-on';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest({
        sessionId: 'sess_test',
        productId: 'premium-ringer-tee',
        photoReference: 'uploaded-photo',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('failed');
    expect(body.message).toMatch(/live provider is not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
