// @vitest-environment node
import { NextRequest } from 'next/server';
vi.mock('@/lib/assistant/store-instance', async () => {
  const { InMemoryStore } = await import('@/lib/assistant/rate-limiter-store');
  return { store: new InMemoryStore() };
});
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

const transcribeMock = vi.fn();
vi.mock('@/lib/assistant/groq-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assistant/groq-client')>();
  return {
    ...actual,
    getGroqClient: () => ({ audio: { transcriptions: { create: transcribeMock } } }),
  };
});

import { POST } from './route';

function makeRequest(audio: Blob | null, cookieHeader?: string, locale?: string) {
  const form = new FormData();
  if (audio) form.set('audio', audio, 'clip.webm');
  if (locale) form.set('locale', locale);
  const headers: Record<string, string> = {};
  // Separate test callers have distinct network identities. Cookies are not
  // an enforcement identity in production, even when cleared or rotated.
  headers['x-real-ip'] = `test-network:${cookieHeader ?? 'default'}`;
  if (cookieHeader) headers.cookie = cookieHeader;
  return new NextRequest('http://localhost/api/assistant/stt', { method: 'POST', body: form, headers });
}

describe('POST /api/assistant/stt', () => {
  it('rejects oversized or unsupported audio before spending a budget or invoking Groq', async () => {
    authMock.mockResolvedValue({ userId: null });
    expect((await POST(makeRequest(new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'audio/webm' })))).status).toBe(413);
    expect((await POST(makeRequest(new Blob(['text'], { type: 'text/plain' })))).status).toBe(415);
    expect(transcribeMock).not.toHaveBeenCalled();
  });
  afterEach(() => {
    authMock.mockReset();
    transcribeMock.mockReset();
  });

  it('rejects with bad_input when no audio is provided, without calling Groq', async () => {
    authMock.mockResolvedValue({ userId: null });

    const response = await POST(makeRequest(null, 'gc_assistant_sid=sess_a'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('bad_input');
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('rejects with rate_limited and never calls Groq once the stt budget is exhausted', async () => {
    authMock.mockResolvedValue({ userId: null });
    transcribeMock.mockResolvedValue({ text: 'hello' });

    for (let i = 0; i < 3; i++) {
      await POST(makeRequest(new Blob(['x'], { type: 'audio/webm' }), 'gc_assistant_sid=sess_b'));
    }
    transcribeMock.mockReset();

    const response = await POST(makeRequest(new Blob(['x'], { type: 'audio/webm' }), 'gc_assistant_sid=sess_b'));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('rate_limited');
    expect(body.resetSeconds).toBeGreaterThan(0);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('returns the transcript on success', async () => {
    authMock.mockResolvedValue({ userId: null });
    transcribeMock.mockResolvedValue({ text: 'try on the blue shirt' });

    const response = await POST(makeRequest(new Blob(['audio bytes'], { type: 'audio/webm' }), 'gc_assistant_sid=sess_c'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.transcript).toBe('try on the blue shirt');
  });

  it('passes the locale to Groq as a language hint, defaulting to English', async () => {
    authMock.mockResolvedValue({ userId: null });
    transcribeMock.mockResolvedValue({ text: 'hi' });

    await POST(makeRequest(new Blob(['audio'], { type: 'audio/webm' }), 'gc_assistant_sid=sess_e'));
    expect(transcribeMock).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }), { signal: expect.any(AbortSignal) });

    await POST(makeRequest(new Blob(['audio'], { type: 'audio/webm' }), 'gc_assistant_sid=sess_f', 'ar'));
    expect(transcribeMock).toHaveBeenCalledWith(expect.objectContaining({ language: 'ar' }), { signal: expect.any(AbortSignal) });
  });

  it('reports provider_unavailable distinctly when Groq fails', async () => {
    authMock.mockResolvedValue({ userId: null });
    transcribeMock.mockImplementation(() => {
      throw new Error('boom');
    });

    const response = await POST(makeRequest(new Blob(['audio bytes'], { type: 'audio/webm' }), 'gc_assistant_sid=sess_d'));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('provider_unavailable');
  });
});
