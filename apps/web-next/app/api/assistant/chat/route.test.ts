// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

const createMock = vi.fn();
vi.mock('@/lib/assistant/groq-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assistant/groq-client')>();
  return {
    ...actual,
    getGroqClient: () => ({ chat: { completions: { create: createMock } } }),
  };
});

import { POST } from './route';

function makeRequest(body: unknown, cookieHeader?: string, ip?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookieHeader) headers.cookie = cookieHeader;
  if (ip) headers['x-forwarded-for'] = ip;
  return new NextRequest('http://localhost/api/assistant/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

async function readSseEvents(response: Response): Promise<{ event: string; data: unknown }[]> {
  const text = await response.text();
  const frames = text.split('\n\n').filter(Boolean);
  return frames.map((frame) => {
    const eventLine = frame.split('\n').find((l) => l.startsWith('event: ')) ?? '';
    const dataLine = frame.split('\n').find((l) => l.startsWith('data: ')) ?? '';
    return { event: eventLine.replace('event: ', ''), data: JSON.parse(dataLine.replace('data: ', '')) };
  });
}

async function* fakeCompletion(chunks: string[]) {
  for (const text of chunks) {
    yield { choices: [{ delta: { content: text } }] };
  }
}

describe('POST /api/assistant/chat', () => {
  afterEach(() => {
    authMock.mockReset();
    createMock.mockReset();
  });

  it('rejects with a rate_limited SSE event and never calls Groq when over budget', async () => {
    authMock.mockResolvedValue({ userId: null });

    // Exhaust the anon chat budget first via a real request.
    createMock.mockReturnValue(fakeCompletion(['hi']));
    for (let i = 0; i < 8; i++) {
      await POST(makeRequest({ message: 'hello', history: [] }, 'gc_assistant_sid=sess_a', '203.0.113.10'));
    }
    createMock.mockReset();

    const response = await POST(makeRequest({ message: 'one more', history: [] }, 'gc_assistant_sid=sess_a', '203.0.113.10'));
    const events = await readSseEvents(response);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('rate_limited');
    expect((events[0].data as { resetSeconds: number }).resetSeconds).toBeGreaterThan(0);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('streams token events for each delta then a done event', async () => {
    authMock.mockResolvedValue({ userId: null });
    createMock.mockReturnValue(fakeCompletion(['Hel', 'lo', '!']));

    const response = await POST(makeRequest({ message: 'hi', history: [] }, 'gc_assistant_sid=sess_b', '203.0.113.11'));
    const events = await readSseEvents(response);

    expect(events.slice(0, 3)).toEqual([
      { event: 'token', data: { text: 'Hel' } },
      { event: 'token', data: { text: 'lo' } },
      { event: 'token', data: { text: '!' } },
    ]);
    expect(events[3].event).toBe('done');
  });

  it('prepends the GrindCTRL system prompt ahead of history and the new message', async () => {
    authMock.mockResolvedValue({ userId: null });
    createMock.mockReturnValue(fakeCompletion(['ok']));

    await POST(makeRequest({ message: 'hi', history: [{ role: 'user', content: 'earlier' }] }, 'gc_assistant_sid=sess_sys', '203.0.113.12'));

    const call = createMock.mock.calls[0][0] as { messages: { role: string; content: string }[] };
    expect(call.messages[0]).toEqual({ role: 'system', content: expect.stringContaining('GrindCTRL') });
    expect(call.messages.slice(1)).toEqual([
      { role: 'user', content: 'earlier' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('emits a distinct error event when Groq is unavailable, not rate_limited', async () => {
    authMock.mockResolvedValue({ userId: null });
    createMock.mockImplementation(() => {
      throw new Error('network exploded');
    });

    const response = await POST(makeRequest({ message: 'hi', history: [] }, 'gc_assistant_sid=sess_c', '203.0.113.13'));
    const events = await readSseEvents(response);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('error');
    expect((events[0].data as { type: string }).type).toBe('provider_unavailable');
  });
});
