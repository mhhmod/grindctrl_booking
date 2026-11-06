import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc, from }) }));

import { reserveCredit } from './entitlement';

const INPUT = {
  shop: 'store.myshopify.com',
  jobId: 'tryon_model',
  requestKey: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session',
  productId: 'product',
  modelKey: 'meta/muse-image',
};
const ROW = {
  job_id: INPUT.jobId, created: true, job_status: 'processing',
  recorded_model_key: 'google/gemini-3.1-flash-image', job_message: null,
  job_provider: null, job_cost_usd: null, job_duration_ms: null,
  job_created_at: '2026-11-06T00:00:00Z', model_fallback_reason: null,
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  vi.stubEnv('TRYON_MODEL', 'meta/muse-image');
  rpc.mockReset();
  from.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('atomic plan-model reservations', () => {
  it.each(['store.myshopify.com', 'site:123e4567-e89b-42d3-a456-426614174000'])(
    'uses the transaction model for %s without a separate plan read', async (shop) => {
      rpc.mockResolvedValue({ data: [ROW], error: null });
      await expect(reserveCredit({ ...INPUT, shop })).resolves.toMatchObject({
        modelKey: ROW.recorded_model_key, costUsd: null,
      });
      expect(rpc).toHaveBeenCalledWith('reserve_tryon_plan_credit', expect.objectContaining({
        p_shop_domain: shop, p_model_key: 'meta/muse-image',
      }));
      expect(from).not.toHaveBeenCalled();
    },
  );

  it.each(['PGRST202', '42883'])(
    'resolves the plan before the legacy reservation when the migration is absent (%s)', async (code) => {
      rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'missing function' } })
        .mockResolvedValueOnce({ data: [ROW], error: null });
      from.mockImplementation((table) => {
        const query = {
          select: () => query, eq: () => query,
          maybeSingle: async () => ({
            data: table === 'tryon_subscriptions' ? { plan_id: 'plan' } : { model_key: 'flash' },
            error: null,
          }),
        };
        return query;
      });
      await reserveCredit({ ...INPUT, shop: 'site:123e4567-e89b-42d3-a456-426614174000' });
      expect(rpc).toHaveBeenLastCalledWith('reserve_tryon_credit', expect.objectContaining({
        p_shop_domain: 'site:123e4567-e89b-42d3-a456-426614174000',
        p_model_key: 'google/gemini-3.1-flash-image',
      }));
    },
  );

  it('does not hide ordinary database errors behind legacy reservation', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'statement timeout' } });
    await expect(reserveCredit(INPUT)).rejects.toThrow('statement timeout');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it('preserves a retry model and unknown spend from the recorded reservation', async () => {
    rpc.mockResolvedValue({ data: [{ ...ROW, created: false }], error: null });
    await expect(reserveCredit(INPUT)).resolves.toMatchObject({
      created: false, modelKey: 'google/gemini-3.1-flash-image', costUsd: null,
    });
  });

  it('reports the SQL fallback reason without logging an arbitrary catalog value', async () => {
    rpc.mockResolvedValue({
      data: [{ ...ROW, recorded_model_key: 'meta/muse-image', model_fallback_reason: 'plan_model_unknown' }],
      error: null,
    });
    await reserveCredit(INPUT);
    expect(console.warn).toHaveBeenCalledWith('[try-on] model_fallback', expect.objectContaining({
      reason: 'plan_model_unknown',
    }));
  });
});
