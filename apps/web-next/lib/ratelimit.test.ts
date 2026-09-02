import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { constructorConfigs, limitMock, slidingWindowMock } = vi.hoisted(() => ({
  constructorConfigs: [] as Array<Record<string, unknown>>,
  limitMock: vi.fn(),
  slidingWindowMock: vi.fn((requests: number, window: string) => ({ requests, window })),
}));

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: vi.fn(() => ({ kind: 'redis' })) },
}));

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    static slidingWindow = slidingWindowMock;
    constructor(config: Record<string, unknown>) {
      constructorConfigs.push(config);
    }
    limit(id: string) {
      return limitMock(id);
    }
  }
  return { Ratelimit: MockRatelimit };
});

describe('rate-limit configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    constructorConfigs.length = 0;
    slidingWindowMock.mockClear();
    limitMock.mockReset().mockResolvedValue({ success: true, reset: Date.now() + 1_000 });
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.restoreAllMocks();
  });

  it('uses a separately prefixed realistic poll budget', async () => {
    const policy = await import('@/lib/try-on/poll-policy');
    const { tryOnPollRatelimit } = await import('./ratelimit');

    expect(slidingWindowMock).toHaveBeenCalledWith(
      policy.TRYON_POLL_RATE_LIMIT_REQUESTS,
      policy.TRYON_POLL_RATE_LIMIT_WINDOW,
    );
    expect(constructorConfigs).toEqual(expect.arrayContaining([
      expect.objectContaining({ prefix: 'gc-ratelimit' }),
      expect.objectContaining({ prefix: 'gc-ratelimit:tryon-poll' }),
    ]));

    await tryOnPollRatelimit.limit('203.0.113.7');
    expect(limitMock).toHaveBeenCalledWith('203.0.113.7');
  });
});
