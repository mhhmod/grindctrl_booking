// @vitest-environment node
import { NextRequest } from 'next/server';
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

function makeRequest(audio: Blob | null, cookieHeader?: string) {
  const form = new FormData();
  if (audio) form.set('audio', audio, 'clip.webm');
  const headers: Record<string, string> = {};
  if (cookieHeader) headers.cookie = cookieHeader;
  return new NextRequest('http://localhost/api/assistant/stt', { method: 'POST', body: form, headers });
}

describe('POST /api/assistant/stt', () => {
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
      await POST(makeRequest(new Blob(['x']), 'gc_assistant_sid=sess_b'));
    }
    transcribeMock.mockReset();

    const response = await POST(makeRequest(new Blob(['x']), 'gc_assistant_sid=sess_b'));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('rate_limited');
    expect(body.resetSeconds).toBeGreaterThan(0);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('returns the transcript on success', async () => {
    authMock.mockResolvedValue({ userId: null });
    transcribeMock.mockResolvedValue({ text: 'try on the blue shirt' });

    const response = await POST(makeRequest(new Blob(['audio bytes']), 'gc_assistant_sid=sess_c'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.transcript).toBe('try on the blue shirt');
  });

  it('reports provider_unavailable distinctly when Groq fails', async () => {
    authMock.mockResolvedValue({ userId: null });
    transcribeMock.mockImplementation(() => {
      throw new Error('boom');
    });

    const response = await POST(makeRequest(new Blob(['audio bytes']), 'gc_assistant_sid=sess_d'));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('provider_unavailable');
  });
});
