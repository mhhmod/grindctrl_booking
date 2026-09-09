// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
const constructor = vi.hoisted(() => vi.fn());
vi.mock('groq-sdk', () => ({ default: class { constructor(options: unknown) { constructor(options); } } }));
import { getGroqClient, withGroqCall } from './groq-client';

afterEach(() => vi.restoreAllMocks());
describe('bounded Groq provider calls', () => {
  it('uses one attempt with an explicit timeout', () => {
    getGroqClient();
    expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 30_000, maxRetries: 0 }));
  });
  it('logs usage numbers, without logging prompt/result bodies', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = { choices: [{ content: 'private shopper content' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
    expect(await withGroqCall('test', async () => result)).toBe(result);
    expect(log).toHaveBeenCalledWith('[groq] completion', expect.objectContaining({ promptTokens: 10, completionTokens: 5, totalTokens: 15 }));
    expect(JSON.stringify(log.mock.calls)).not.toContain('private');
  });
  it('logs safe status instead of arbitrary provider error content', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('secret customer and provider detail'), { status: 429 });
    await expect(withGroqCall('test', async () => { throw error; })).rejects.toMatchObject({ name: 'ProviderUnavailableError', cause: error });
    expect(log).toHaveBeenCalledWith('[groq] failure', expect.objectContaining({ status: 429 }));
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
  });
  it('aborts a response body that stalls after headers, without a completion log', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let observedSignal: AbortSignal | undefined;
    let readStarted = false;
    await expect(withGroqCall('body', async (signal) => {
      observedSignal = signal;
      const response = new Response(new ReadableStream({
        start(controller) {
          signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        },
      }));
      readStarted = true;
      return response.json();
    }, { timeoutMs: 20 })).rejects.toMatchObject({ name: 'ProviderUnavailableError' });
    expect(readStarted).toBe(true);
    expect(observedSignal?.aborted).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });
  it('does not start provider work for an already cancelled request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const callback = vi.fn();
    await expect(withGroqCall('cancelled', callback, { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'ProviderUnavailableError' });
    expect(callback).not.toHaveBeenCalled();
  });
});
