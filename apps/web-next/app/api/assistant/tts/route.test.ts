// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

const speechMock = vi.fn();
vi.mock('@/lib/assistant/groq-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assistant/groq-client')>();
  return {
    ...actual,
    getGroqClient: () => ({ audio: { speech: { create: speechMock } } }),
  };
});

import { POST } from './route';

function makeRequest(text: string, cookieHeader?: string, locale?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookieHeader) headers.cookie = cookieHeader;
  return new NextRequest('http://localhost/api/assistant/tts', {
    method: 'POST',
    body: JSON.stringify({ text, locale }),
    headers,
  });
}

async function readSseEvents(response: Response): Promise<{ event: string; data: unknown }[]> {
  const raw = await response.text();
  return raw
    .split('\n\n')
    .filter(Boolean)
    .map((frame) => {
      const eventLine = frame.split('\n').find((l) => l.startsWith('event: ')) ?? '';
      const dataLine = frame.split('\n').find((l) => l.startsWith('data: ')) ?? '';
      return { event: eventLine.replace('event: ', ''), data: JSON.parse(dataLine.replace('data: ', '')) };
    });
}

function fakeAudioResponse(bytes: string) {
  return { arrayBuffer: async () => new TextEncoder().encode(bytes).buffer };
}

describe('POST /api/assistant/tts', () => {
  afterEach(() => {
    authMock.mockReset();
    speechMock.mockReset();
  });

  it('rejects with rate_limited and never calls Groq when over budget', async () => {
    authMock.mockResolvedValue({ userId: null });
    speechMock.mockResolvedValue(fakeAudioResponse('wav'));

    for (let i = 0; i < 9; i++) {
      // anon tts:requests capacity is 9
      await POST(makeRequest('Short reply.', 'gc_assistant_sid=sess_a'));
    }
    speechMock.mockReset();

    const response = await POST(makeRequest('One more.', 'gc_assistant_sid=sess_a'));
    const events = await readSseEvents(response);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('rate_limited');
    expect(speechMock).not.toHaveBeenCalled();
  });

  it('emits one chunk event per sentence, in order, then done', async () => {
    authMock.mockResolvedValue({ userId: null });
    speechMock.mockImplementation(async ({ input }: { input: string }) => fakeAudioResponse(`audio-for:${input}`));

    const response = await POST(makeRequest('Sure. I can help. What size?', 'gc_assistant_sid=sess_b'));
    const events = await readSseEvents(response);

    expect(events.at(-1)?.event).toBe('done');
    const chunkEvents = events.filter((e) => e.event === 'chunk');
    expect(chunkEvents.length).toBeGreaterThanOrEqual(1);
    expect((chunkEvents[0].data as { index: number }).index).toBe(0);
    expect((chunkEvents[0].data as { audioBase64: string }).audioBase64).toBeTruthy();
  });

  it('uses the English Orpheus model and voice when no locale is given', async () => {
    authMock.mockResolvedValue({ userId: null });
    speechMock.mockResolvedValue(fakeAudioResponse('wav'));

    await POST(makeRequest('Hello there.', 'gc_assistant_sid=sess_en'));

    expect(speechMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'canopylabs/orpheus-v1-english', voice: 'autumn', response_format: 'wav' }),
    );
  });

  it('switches to the Arabic Orpheus model and a valid Arabic voice when locale is ar', async () => {
    authMock.mockResolvedValue({ userId: null });
    speechMock.mockResolvedValue(fakeAudioResponse('wav'));

    await POST(makeRequest('مرحبا بك.', 'gc_assistant_sid=sess_ar', 'ar'));

    expect(speechMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'canopylabs/orpheus-arabic-saudi', voice: 'noura', response_format: 'wav' }),
    );
  });

  it('emits done with no chunks for empty text, without calling Groq', async () => {
    authMock.mockResolvedValue({ userId: null });

    const response = await POST(makeRequest('', 'gc_assistant_sid=sess_c'));
    const events = await readSseEvents(response);

    expect(events).toEqual([{ event: 'done', data: {} }]);
    expect(speechMock).not.toHaveBeenCalled();
  });

  it('emits a distinct error event when Groq is unavailable', async () => {
    authMock.mockResolvedValue({ userId: null });
    speechMock.mockImplementation(() => {
      throw new Error('boom');
    });

    const response = await POST(makeRequest('Hello there.', 'gc_assistant_sid=sess_d'));
    const events = await readSseEvents(response);

    expect(events.some((e) => e.event === 'error' && (e.data as { type: string }).type === 'provider_unavailable')).toBe(
      true,
    );
  });
});
