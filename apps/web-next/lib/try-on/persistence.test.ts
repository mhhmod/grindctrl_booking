import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TryOnJob } from './types';

const { insertMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: insertMock })),
  })),
}));

import { persistTryOnJob } from './persistence';

function job(shop: string | null): TryOnJob {
  return {
    jobId: 'tryon_test',
    sessionId: 'sess_test',
    productId: 'premium-ringer-tee',
    shop,
    status: 'completed',
    createdAt: '2026-07-17T00:00:00.000Z',
    meta: {
      runtime: 'live',
      provider: 'openrouter',
      costEstimate: 0.01,
    },
  };
}

describe('persistTryOnJob', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    insertMock.mockReset().mockResolvedValue({ error: null });
  });

  it('records the normalized storefront shop', async () => {
    await persistTryOnJob(job('store-one.myshopify.com'));

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ shop: 'store-one.myshopify.com' }),
    );
  });

  it('records null for a public demo job', async () => {
    await persistTryOnJob(job(null));

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ shop: null }));
  });

  it('rejects a bogus shop to null before insertion', async () => {
    await persistTryOnJob(job('https://attacker.example'));

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ shop: null }));
  });
});
