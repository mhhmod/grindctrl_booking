import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/try-on/generate/route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/try-on/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

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
});
