// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealAssistantClient } from './real-client';

function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}

describe('createRealAssistantClient', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('fetchSession calls the session endpoint and returns the parsed JSON', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ tenantId: 't1', authenticated: false, budgets: {} })));
    const client = createRealAssistantClient();

    const session = await client.fetchSession();

    expect(fetchMock).toHaveBeenCalledWith('/api/assistant/session');
    expect(session.tenantId).toBe('t1');
  });

  it('streamChat posts the message and history, and reports each token as it streams', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['event: token\ndata: {"text":"Hi "}\n\n', 'event: token\ndata: {"text":"there"}\n\n', 'event: done\ndata: {}\n\n']),
    );
    const client = createRealAssistantClient();
    const tokens: string[] = [];

    const result = await client.streamChat('hello', [], (t) => tokens.push(t));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assistant/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'hello', history: [] }),
      }),
    );
    expect(tokens).toEqual(['Hi ', 'there']);
    expect(result).toEqual({ ok: true });
  });

  it('streamChat resolves a rate_limited result without treating it as a token', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['event: rate_limited\ndata: {"resetSeconds":42,"message":"limit","signInCta":true}\n\n']),
    );
    const client = createRealAssistantClient();

    const result = await client.streamChat('hello', [], () => {});

    expect(result).toEqual({
      ok: false,
      kind: 'rate_limited',
      info: { resetSeconds: 42, message: 'limit', signInCta: true },
    });
  });

  it('streamChat resolves provider_unavailable on an error event', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['event: error\ndata: {"type":"provider_unavailable","message":"down"}\n\n']),
    );
    const client = createRealAssistantClient();

    const result = await client.streamChat('hello', [], () => {});

    expect(result).toEqual({ ok: false, kind: 'provider_unavailable', message: 'down' });
  });

  it('transcribeAudio posts multipart form data and returns the transcript', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ transcript: 'hello world' })));
    const client = createRealAssistantClient();

    const result = await client.transcribeAudio(new Blob(['audio']));

    expect(fetchMock).toHaveBeenCalledWith('/api/assistant/stt', expect.objectContaining({ method: 'POST' }));
    const call = fetchMock.mock.calls[0][1] as RequestInit;
    expect(call.body).toBeInstanceOf(FormData);
    expect(result).toEqual({ ok: true, transcript: 'hello world' });
  });

  it('transcribeAudio maps a rate_limited error body to the rate_limited result', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate_limited', resetSeconds: 10, message: 'limit', signInCta: true }), {
        status: 429,
      }),
    );
    const client = createRealAssistantClient();

    const result = await client.transcribeAudio(new Blob(['audio']));

    expect(result).toEqual({
      ok: false,
      kind: 'rate_limited',
      info: { resetSeconds: 10, message: 'limit', signInCta: true },
    });
  });

  it('streamTts posts the text and reports each chunk with its index', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['event: chunk\ndata: {"index":0,"audioBase64":"AA"}\n\n', 'event: done\ndata: {}\n\n']),
    );
    const client = createRealAssistantClient();
    const chunks: [string, number][] = [];

    const result = await client.streamTts('hello', (audio, index) => chunks.push([audio, index]));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assistant/tts',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'hello' }) }),
    );
    expect(chunks).toEqual([['AA', 0]]);
    expect(result).toEqual({ ok: true });
  });
});
