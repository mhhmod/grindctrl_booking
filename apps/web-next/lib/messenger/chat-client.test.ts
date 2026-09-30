import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groq = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@/lib/assistant/groq-client', () => ({
  CHAT_MODEL: 'openai/gpt-oss-120b',
  getGroqClient: () => ({ chat: { completions: { create: groq.create } } }),
  withGroqCall: (_label: string, fn: (signal: AbortSignal) => Promise<unknown>) => fn(new AbortController().signal),
}));
import { ProviderUnavailableError } from '@/lib/assistant/errors';
import {
  STORE_CHAT_BACKUP_MODEL,
  STORE_CHAT_MODEL,
  StoreChatNotConfiguredError,
  storeChatComplete,
} from './chat-client';

const request = {
  temperature: 0.3,
  maxTokens: 400,
  messages: [
    { role: 'system' as const, content: 'You are the store assistant.' },
    { role: 'user' as const, content: 'Do you ship to Cairo?' },
  ],
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('Store Chat completions', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_API_KEY;
    groq.create.mockReset();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks OpenRouter for gpt-oss-120b, then the backup model, from providers that keep no prompts', async () => {
    fetchMock.mockResolvedValue(reply({ model: STORE_CHAT_MODEL, choices: [{ message: { content: 'Yes, in 3 days.' } }] }));

    await expect(storeChatComplete('messenger.chat', request)).resolves.toBe('Yes, in 3 days.');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(init.body)).toEqual({
      models: ['openai/gpt-oss-120b', 'google/gemini-2.5-flash-lite'],
      provider: { data_collection: 'deny' },
      temperature: 0.3,
      max_tokens: 400,
      messages: request.messages,
    });
    expect(STORE_CHAT_BACKUP_MODEL).toBe('google/gemini-2.5-flash-lite');
  });

  it('logs who answered and the usage, never the prompt or the reply', async () => {
    fetchMock.mockResolvedValue(reply({
      model: STORE_CHAT_MODEL,
      provider: 'DeepInfra',
      choices: [{ message: { content: 'Yes, in 3 days.' } }],
      usage: { prompt_tokens: 900, completion_tokens: 120, cost: 0.00006 },
    }));

    await storeChatComplete('messenger.chat', request);

    expect(console.info).toHaveBeenCalledWith('[store-chat] completion', expect.objectContaining({
      operation: 'messenger.chat',
      model: STORE_CHAT_MODEL,
      provider: 'DeepInfra',
      promptTokens: 900,
      completionTokens: 120,
      costUsd: 0.00006,
    }));
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toMatch(/Cairo|3 days/);
  });

  it('fails as provider unavailable without calling anyone when the key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const failure = await storeChatComplete('messenger.chat', request).catch((error) => error);

    expect(failure).toBeInstanceOf(ProviderUnavailableError);
    expect(failure.cause).toBeInstanceOf(StoreChatNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails as provider unavailable on an HTTP error, keeping the status as the cause', async () => {
    fetchMock.mockResolvedValue(reply({ error: { message: 'Insufficient credits' } }, 402));

    const failure = await storeChatComplete('messenger.chat', request).catch((error) => error);

    expect(failure).toBeInstanceOf(ProviderUnavailableError);
    expect(String(failure.cause.message)).toMatch(/^402 /);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('treats a 200 carrying an error as a failure, not an empty reply', async () => {
    fetchMock.mockResolvedValue(reply({ error: { message: 'No endpoints found matching your data policy' } }));

    const failure = await storeChatComplete('messenger.chat', request).catch((error) => error);

    expect(failure).toBeInstanceOf(ProviderUnavailableError);
    expect(failure.cause.message).toBe('No endpoints found matching your data policy');
  });

  it('fails as provider unavailable when the request never completes', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

    await expect(storeChatComplete('messenger.chat', request)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('answers through Groq when OpenRouter cannot, for example out of credit', async () => {
    process.env.GROQ_API_KEY = 'groq-key';
    fetchMock.mockResolvedValue(reply({ error: { message: 'Insufficient credits' } }, 402));
    groq.create.mockResolvedValue({ choices: [{ message: { content: 'نعم، نوصل للإسكندرية.' } }] });

    await expect(storeChatComplete('messenger.chat', request)).resolves.toBe('نعم، نوصل للإسكندرية.');
    expect(groq.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-oss-120b', max_tokens: 400, messages: request.messages }),
      expect.anything(),
    );
    expect(console.warn).toHaveBeenCalledWith('[store-chat] fallback', { operation: 'messenger.chat', to: 'groq' });
  });

  it('does not call Groq when OpenRouter answers', async () => {
    process.env.GROQ_API_KEY = 'groq-key';
    fetchMock.mockResolvedValue(reply({ choices: [{ message: { content: 'ok' } }] }));
    await storeChatComplete('messenger.chat', request);
    expect(groq.create).not.toHaveBeenCalled();
  });

  it('fails as before when neither provider is available', async () => {
    fetchMock.mockResolvedValue(reply({ error: { message: 'Insufficient credits' } }, 402));
    await expect(storeChatComplete('messenger.chat', request)).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(groq.create).not.toHaveBeenCalled();
  });
});
