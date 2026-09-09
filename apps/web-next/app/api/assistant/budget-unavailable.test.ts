// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ draw: vi.fn(), provider: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'verified_user' }) }));
vi.mock('@/lib/assistant/store-instance', () => ({ store: { atomicDraw: mocks.draw } }));
vi.mock('@/lib/assistant/groq-client', async (original) => ({
  ...await original<typeof import('@/lib/assistant/groq-client')>(), getGroqClient: mocks.provider,
}));
import { POST as chat } from './chat/route';
import { POST as tts } from './tts/route';
import { POST as stt } from './stt/route';
import { GET as session } from './session/route';

const jsonRequest = (body: unknown) => new NextRequest('https://grindctrl.cloud/api/assistant/test', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.draw.mockRejectedValue(new Error('private backend failure')); });

describe('assistant distributed-budget outage', () => {
  it.each([[chat, { message: 'hello' }], [tts, { text: 'hello' }]] as const)('keeps SSE recovery and never invokes a provider (%#)', async (route, body) => {
    const response = await route(jsonRequest(body));
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    const text = await response.text();
    expect(text).toContain('event: error');
    expect(text).not.toContain('private');
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it('returns a safe STT error and never invokes transcription', async () => {
    const body = new FormData();
    body.set('audio', new Blob(['audio'], { type: 'audio/webm' }));
    const response = await stt(new NextRequest('https://grindctrl.cloud/api/assistant/stt', { method: 'POST', body }));
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it('never advertises full/fake budgets when the authoritative store is unavailable', async () => {
    const response = await session(new NextRequest('https://grindctrl.cloud/api/assistant/session'));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('budgets');
  });

  it('validates oversized contexts and TTS types before any budget spend', async () => {
    const largeHistory = Array.from({ length: 20 }, () => ({ role: 'user', content: 'ع'.repeat(4000) }));
    expect((await chat(jsonRequest({ message: 'hello', history: largeHistory }))).status).toBe(400);
    expect((await tts(jsonRequest({ text: 123 }))).status).toBe(400);
    expect(mocks.draw).not.toHaveBeenCalled();
  });
});
