// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGroqClient, withGroqCall } from './groq-client';
import { ProviderUnavailableError } from './errors';

describe('getGroqClient', () => {
  beforeEach(() => vi.stubEnv('GROQ_API_KEY', 'test-key'));
  afterEach(() => vi.unstubAllEnvs());

  it('returns the same client instance on repeated calls (singleton)', () => {
    const a = getGroqClient();
    const b = getGroqClient();

    expect(a).toBe(b);
  });
});

describe('withGroqCall', () => {
  it('returns the wrapped function result on success', async () => {
    const result = await withGroqCall('test-op', async () => 'ok');

    expect(result).toBe('ok');
  });

  it('wraps a thrown error as ProviderUnavailableError', async () => {
    await expect(
      withGroqCall('test-op', async () => {
        throw new Error('network exploded');
      }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});
