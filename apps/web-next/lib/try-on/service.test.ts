import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const {
  beginTryOnJobMock,
  finalizeTryOnJobMock,
  loadAuthorizedDurableTryOnJobMock,
  persistGeneratedTryOnResultMock,
  persistTryOnJobMock,
  runImageGenerationMock,
} = vi.hoisted(() => ({
  beginTryOnJobMock: vi.fn(),
  finalizeTryOnJobMock: vi.fn(),
  loadAuthorizedDurableTryOnJobMock: vi.fn(),
  persistGeneratedTryOnResultMock: vi.fn(),
  persistTryOnJobMock: vi.fn(),
  runImageGenerationMock: vi.fn(),
}));

vi.mock('./persistence', () => ({
  beginTryOnJob: (...args: unknown[]) => beginTryOnJobMock(...args),
  finalizeTryOnJob: (...args: unknown[]) => finalizeTryOnJobMock(...args),
  loadAuthorizedDurableTryOnJob: (...args: unknown[]) =>
    loadAuthorizedDurableTryOnJobMock(...args),
  persistGeneratedTryOnResult: (...args: unknown[]) =>
    persistGeneratedTryOnResultMock(...args),
  persistTryOnJob: (...args: unknown[]) => persistTryOnJobMock(...args),
}));
vi.mock('./image-runner', () => ({
  runImageGeneration: (...args: unknown[]) => runImageGenerationMock(...args),
}));

import {
  generateTryOn,
  getJob,
  getTryOnMode,
  TryOnFinalizationPendingError,
  TryOnResultSchemaNotReadyError,
  TryOnResultUnavailableError,
} from './service';
import type { VerifiedTryOnSession } from './storefront-context';
import type { TryOnJob } from './types';

function authorization(
  overrides: Partial<VerifiedTryOnSession> = {},
): VerifiedTryOnSession {
  return {
    iss: 'grindctrl-tryon',
    aud: 'tryon-generation-api',
    purpose: 'public-demo',
    sessionId: 'ts_abcdefghijklmnopqrstuvwx',
    shop: null,
    productId: 'premium-ringer-tee',
    variantId: null,
    productGid: null,
    variantGid: null,
    canonicalGarmentUrl: null,
    garmentUrlDigest: null,
    nonce: 'abcdefghijklmnopqrstuvwx',
    requestKey: '11111111-1111-4111-8111-111111111111',
    iat: 2_000_000_000,
    exp: 2_000_000_600,
    jti: 'abcdefghijklmnop',
    ...overrides,
  };
}

function storefrontAuthorization(
  overrides: Partial<VerifiedTryOnSession> = {},
): VerifiedTryOnSession {
  return authorization({
    purpose: 'storefront',
    shop: 'store-one.myshopify.com',
    variantId: '123',
    productGid: 'gid://shopify/Product/99',
    variantGid: 'gid://shopify/ProductVariant/123',
    canonicalGarmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
    garmentUrlDigest: 'uF4fFAKE-will-not-be-runtime-verified-in-service-fixture',
    ...overrides,
  });
}

function legacyCompatAuthorization(
  overrides: Partial<VerifiedTryOnSession> = {},
): VerifiedTryOnSession {
  return storefrontAuthorization({
    purpose: 'legacy-compat',
    shop: null,
    ...overrides,
  });
}

describe('try-on service', () => {
  beforeEach(() => {
    delete process.env.TRYON_MODE;
    beginTryOnJobMock.mockReset();
    finalizeTryOnJobMock.mockReset();
    loadAuthorizedDurableTryOnJobMock.mockReset().mockResolvedValue(null);
    persistGeneratedTryOnResultMock.mockReset().mockResolvedValue({
      storagePath: 'jobs/tryon_test/result.png',
      persistedAt: '2026-08-31T00:00:00.000Z',
      expiresAt: '2026-08-31T00:30:00.000Z',
    });
    persistTryOnJobMock.mockReset().mockResolvedValue(undefined);
    runImageGenerationMock.mockReset();
  });

  afterEach(() => {
    delete process.env.TRYON_MODE;
    vi.restoreAllMocks();
  });

  describe('getTryOnMode', () => {
    it('defaults to mock when TRYON_MODE is not set', () => {
      const original = process.env.TRYON_MODE;
      delete process.env.TRYON_MODE;
      expect(getTryOnMode()).toBe('mock');
      if (original !== undefined) process.env.TRYON_MODE = original;
    });
  });

  describe('generateTryOn', () => {
    it('requires photoSource parameter', async () => {
      await expect(
        generateTryOn(authorization(), '' as never),
      ).rejects.toThrow('photoSource');
    });

    it('generates a mock job with photoSource=upload', async () => {
      const job = await generateTryOn(
        storefrontAuthorization(),
        'upload',
      );
      expect(job).toBeDefined();
      expect(job.status).toBe('completed');
      expect(job.shop).toBe('store-one.myshopify.com');
      expect(job.meta.runtime).toBe('mock');
      expect(job.resultImageUrl).toBeTruthy();
    });

    it('generates a mock job with photoSource=mock', async () => {
      const job = await generateTryOn(authorization(), 'mock');
      expect(job).toBeDefined();
      expect(job.status).toBe('completed');
      expect(job.shop).toBeNull();
      expect(job.meta.runtime).toBe('mock');
    });

    it('uses the shop bound to the verified authorization', async () => {
      const job = await generateTryOn(
        storefrontAuthorization(),
        'mock',
      );
      expect(job.shop).toBe('store-one.myshopify.com');
    });

    it('replays the completed in-memory result, including resultImageUrl', async () => {
      process.env.TRYON_MODE = 'live';
      let reservedJobId = '';
      beginTryOnJobMock.mockImplementation((input: { jobId: string }) => {
        if (!reservedJobId) {
          reservedJobId = input.jobId;
          return Promise.resolve({
            jobId: reservedJobId,
            created: true,
            status: 'queued',
            modelKey: 'model-v1',
            message: null,
            provider: null,
            costUsd: null,
            durationMs: null,
            createdAt: '2026-08-31T00:00:00.000Z',
          });
        }
        return Promise.resolve({
          jobId: reservedJobId,
          created: false,
          status: 'completed',
          modelKey: 'model-v1',
          message: 'already generated',
          provider: 'provider-v1',
          costUsd: 0.01,
          durationMs: 100,
          createdAt: '2026-08-31T00:00:00.000Z',
        });
      });
      const auth = storefrontAuthorization();
      runImageGenerationMock.mockResolvedValue({
        jobId: 'provider-job',
        sessionId: auth.sessionId,
        productId: auth.productId,
        shop: auth.shop,
        status: 'completed',
        resultImageUrl: 'data:image/png;base64,RESULT_ONE',
        createdAt: '2026-08-31T00:00:00.000Z',
        meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
      });

      const first = await generateTryOn(auth, 'upload', 'data:image/png;base64,AAAA');
      const replay = await generateTryOn(auth, 'upload', 'data:image/png;base64,AAAA');

      expect(replay.jobId).toBe(first.jobId);
      expect(replay.resultImageUrl).toBe('data:image/png;base64,RESULT_ONE');
      expect(first.requestKey).toBe(auth.requestKey);
      expect(replay.requestKey).toBe(auth.requestKey);
      expect(beginTryOnJobMock).toHaveBeenCalledTimes(2);
      expect(runImageGenerationMock).toHaveBeenCalledTimes(1);
      expect(finalizeTryOnJobMock).toHaveBeenCalledTimes(1);
      expect(runImageGenerationMock.mock.invocationCallOrder[0]).toBeLessThan(
        persistGeneratedTryOnResultMock.mock.invocationCallOrder[0],
      );
      expect(persistGeneratedTryOnResultMock.mock.invocationCallOrder[0]).toBeLessThan(
        finalizeTryOnJobMock.mock.invocationCallOrder[0],
      );
      for (const [input] of beginTryOnJobMock.mock.calls) {
        expect(input).toMatchObject({
          shop: 'store-one.myshopify.com',
          requestKey: auth.requestKey,
          sessionId: auth.sessionId,
          productId: auth.productId,
        });
      }
    });

    it('creates a second render for a new-photo attempt with a distinct request key', async () => {
      process.env.TRYON_MODE = 'live';
      beginTryOnJobMock.mockImplementation((input: { jobId: string; requestKey: string }) =>
        Promise.resolve({
          jobId: input.jobId,
          created: true,
          status: 'queued',
          modelKey: 'model-v1',
          message: null,
          provider: null,
          costUsd: null,
          durationMs: null,
          createdAt: '2026-08-31T00:00:00.000Z',
        }),
      );
      runImageGenerationMock
        .mockResolvedValueOnce({
          jobId: 'provider-one',
          sessionId: 'ts_abcdefghijklmnopqrstuvwx',
          productId: 'premium-ringer-tee',
          shop: 'store-one.myshopify.com',
          status: 'completed',
          resultImageUrl: 'data:image/png;base64,FIRST',
          createdAt: '2026-08-31T00:00:00.000Z',
          meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
        })
        .mockResolvedValueOnce({
          jobId: 'provider-two',
          sessionId: 'ts_abcdefghijklmnopqrstuvwx',
          productId: 'premium-ringer-tee',
          shop: 'store-one.myshopify.com',
          status: 'completed',
          resultImageUrl: 'data:image/png;base64,SECOND',
          createdAt: '2026-08-31T00:00:01.000Z',
          meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
        });
      const firstAuth = storefrontAuthorization();
      const secondAuth = storefrontAuthorization({
        requestKey: '22222222-2222-4222-8222-222222222222',
        jti: 'zyxwvutsrqponmlk',
      });

      const first = await generateTryOn(firstAuth, 'upload', 'data:image/png;base64,FIRST');
      const second = await generateTryOn(secondAuth, 'upload', 'data:image/png;base64,SECOND');

      expect(first.resultImageUrl).toContain('FIRST');
      expect(second.resultImageUrl).toContain('SECOND');
      expect(beginTryOnJobMock.mock.calls.map(([input]) => input.requestKey)).toEqual([
        firstAuth.requestKey,
        secondAuth.requestKey,
      ]);
      expect(runImageGenerationMock).toHaveBeenCalledTimes(2);
    });

    it('returns a pollable processing job for an overlapping request without a second provider call', async () => {
      process.env.TRYON_MODE = 'live';
      const auth = storefrontAuthorization({
        requestKey: '33333333-3333-4333-8333-333333333333',
      });
      let reservedJobId = '';
      let resolveProvider!: (job: TryOnJob) => void;
      const providerResult = new Promise<TryOnJob>((resolve) => {
        resolveProvider = resolve;
      });
      beginTryOnJobMock
        .mockImplementationOnce((input: { jobId: string }) => {
          reservedJobId = input.jobId;
          return Promise.resolve({
            jobId: input.jobId,
            created: true,
            status: 'processing',
            modelKey: 'model-v1',
            message: null,
            provider: null,
            costUsd: null,
            durationMs: null,
            createdAt: '2026-08-31T00:00:00.000Z',
          });
        })
        .mockImplementationOnce(() => Promise.resolve({
          jobId: reservedJobId,
          created: false,
          status: 'processing',
          modelKey: 'model-v1',
          message: null,
          provider: null,
          costUsd: null,
          durationMs: null,
          createdAt: '2026-08-31T00:00:00.000Z',
        }));
      runImageGenerationMock.mockReturnValue(providerResult);

      const firstPromise = generateTryOn(
        auth,
        'upload',
        'data:image/png;base64,PHOTO',
        auth.canonicalGarmentUrl ?? undefined,
      );
      await vi.waitFor(() => expect(runImageGenerationMock).toHaveBeenCalledOnce());

      const overlap = await generateTryOn(
        auth,
        'upload',
        'data:image/png;base64,PHOTO',
        auth.canonicalGarmentUrl ?? undefined,
      );
      expect(overlap).toMatchObject({
        jobId: reservedJobId,
        status: 'processing',
        requestKey: auth.requestKey,
      });

      resolveProvider({
        jobId: 'provider-overlap',
        sessionId: auth.sessionId,
        productId: auth.productId,
        shop: auth.shop,
        status: 'completed',
        resultImageUrl: 'data:image/png;base64,OVERLAP',
        createdAt: '2026-08-31T00:00:01.000Z',
        meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
      });
      const completed = await firstPromise;

      expect(completed.jobId).toBe(reservedJobId);
      expect(getJob(reservedJobId)?.resultImageUrl).toContain('OVERLAP');
      expect(runImageGenerationMock).toHaveBeenCalledTimes(1);
    });

    it('replays a durable completed result after an in-memory restart without invoking the provider', async () => {
      process.env.TRYON_MODE = 'live';
      const auth = storefrontAuthorization({
        requestKey: '66666666-6666-4666-8666-666666666666',
      });
      beginTryOnJobMock.mockResolvedValue({
        jobId: 'tryon_durable_replay',
        created: false,
        status: 'processing',
        modelKey: 'model-v1',
        message: null,
        provider: null,
        costUsd: null,
        durationMs: null,
        createdAt: '2026-08-31T00:00:00.000Z',
      });
      loadAuthorizedDurableTryOnJobMock.mockResolvedValue({
        jobId: 'tryon_durable_replay',
        sessionId: auth.sessionId,
        productId: auth.productId,
        shop: auth.shop,
        requestKey: auth.requestKey,
        status: 'completed',
        resultImageUrl: 'https://storage.example/signed-result',
        createdAt: '2026-08-31T00:00:00.000Z',
        meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
      });

      const replay = await generateTryOn(
        auth,
        'upload',
        'data:image/png;base64,PHOTO',
        auth.canonicalGarmentUrl ?? undefined,
      );

      expect(replay.resultImageUrl).toBe('https://storage.example/signed-result');
      expect(loadAuthorizedDurableTryOnJobMock).toHaveBeenCalledWith(
        auth,
        'tryon_durable_replay',
      );
      expect(runImageGenerationMock).not.toHaveBeenCalled();
      expect(finalizeTryOnJobMock).not.toHaveBeenCalled();
    });

    it('fails closed before finalization when durable result schema or storage is unavailable', async () => {
      process.env.TRYON_MODE = 'live';
      const auth = storefrontAuthorization({
        requestKey: '77777777-7777-4777-8777-777777777777',
      });
      beginTryOnJobMock.mockImplementation((input: { jobId: string }) => Promise.resolve({
        jobId: input.jobId,
        created: true,
        status: 'processing',
        modelKey: 'model-v1',
        message: null,
        provider: null,
        costUsd: null,
        durationMs: null,
        createdAt: '2026-08-31T00:00:00.000Z',
      }));
      runImageGenerationMock.mockResolvedValue({
        jobId: 'provider-schema-not-ready',
        sessionId: auth.sessionId,
        productId: auth.productId,
        shop: auth.shop,
        status: 'completed',
        resultImageUrl: 'data:image/png;base64,RESULT',
        createdAt: '2026-08-31T00:00:01.000Z',
        meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
      });
      persistGeneratedTryOnResultMock.mockImplementation((generated: TryOnJob) =>
        Promise.reject(new TryOnResultSchemaNotReadyError(generated.jobId)),
      );

      await expect(
        generateTryOn(
          auth,
          'upload',
          'data:image/png;base64,PHOTO',
          auth.canonicalGarmentUrl ?? undefined,
        ),
      ).rejects.toBeInstanceOf(TryOnResultSchemaNotReadyError);

      expect(runImageGenerationMock).toHaveBeenCalledTimes(1);
      expect(persistGeneratedTryOnResultMock).toHaveBeenCalledTimes(1);

      /* The credit is debited by reserve_tryon_credit at RESERVATION time, not
         at finalize (verified against the deployed function body). If nothing
         released it here, an unmigrated or storage-broken database would leave
         a real debit standing against the merchant for a result that was never
         delivered, until the 10-minute reconciliation sweep. So the failure
         path must finalize the job as failed — releasing the credit — while
         still surfacing the schema error to the caller. */
      expect(finalizeTryOnJobMock).toHaveBeenCalledTimes(1);
      expect(finalizeTryOnJobMock.mock.calls[0][0]).toMatchObject({
        status: 'failed',
      });
    });

    it('keeps a generated result pollable when entitlement finalization fails', async () => {
      process.env.TRYON_MODE = 'live';
      const auth = storefrontAuthorization({
        requestKey: '44444444-4444-4444-8444-444444444444',
      });
      let reservedJobId = '';
      beginTryOnJobMock.mockImplementation((input: { jobId: string }) => {
        reservedJobId ||= input.jobId;
        return Promise.resolve({
          jobId: reservedJobId,
          created: beginTryOnJobMock.mock.calls.length === 1,
          status: 'processing',
          modelKey: 'model-v1',
          message: null,
          provider: null,
          costUsd: null,
          durationMs: null,
          createdAt: '2026-08-31T00:00:00.000Z',
        });
      });
      runImageGenerationMock.mockResolvedValue({
        jobId: 'provider-finalization',
        sessionId: auth.sessionId,
        productId: auth.productId,
        shop: auth.shop,
        status: 'completed',
        resultImageUrl: 'data:image/png;base64,RECOVERABLE',
        createdAt: '2026-08-31T00:00:01.000Z',
        meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
      });
      finalizeTryOnJobMock.mockRejectedValueOnce(new Error('database unavailable'));
      const alert = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(
        generateTryOn(
          auth,
          'upload',
          'data:image/png;base64,PHOTO',
          auth.canonicalGarmentUrl ?? undefined,
        ),
      ).rejects.toBeInstanceOf(TryOnFinalizationPendingError);

      expect(getJob(reservedJobId)?.resultImageUrl).toContain('RECOVERABLE');
      const replay = await generateTryOn(
        auth,
        'upload',
        'data:image/png;base64,PHOTO',
        auth.canonicalGarmentUrl ?? undefined,
      );
      expect(replay.resultImageUrl).toContain('RECOVERABLE');
      expect(runImageGenerationMock).toHaveBeenCalledTimes(1);
      expect(finalizeTryOnJobMock).toHaveBeenCalledTimes(1);
      expect(alert).toHaveBeenCalledWith(
        '[try-on] reconciliation_required',
        expect.objectContaining({ reason: 'finalization_failed', jobId: reservedJobId }),
      );
      expect(JSON.stringify(alert.mock.calls)).not.toContain(auth.sessionId);
      expect(JSON.stringify(alert.mock.calls)).not.toContain('RECOVERABLE');
    });

    it('raises reconciliation instead of regenerating a completed job with no recoverable result', async () => {
      process.env.TRYON_MODE = 'live';
      const auth = storefrontAuthorization({
        requestKey: '55555555-5555-4555-8555-555555555555',
      });
      beginTryOnJobMock.mockResolvedValue({
        jobId: 'tryon_completed_without_result',
        created: false,
        status: 'completed',
        modelKey: 'model-v1',
        message: 'completed',
        provider: 'provider-v1',
        costUsd: 0.01,
        durationMs: 100,
        createdAt: '2026-08-31T00:00:00.000Z',
      });
      loadAuthorizedDurableTryOnJobMock.mockRejectedValueOnce(
        new TryOnResultUnavailableError('tryon_completed_without_result'),
      );

      await expect(
        generateTryOn(
          auth,
          'upload',
          'data:image/png;base64,PHOTO',
          auth.canonicalGarmentUrl ?? undefined,
        ),
      ).rejects.toBeInstanceOf(TryOnResultUnavailableError);

      expect(runImageGenerationMock).not.toHaveBeenCalled();
      expect(finalizeTryOnJobMock).not.toHaveBeenCalled();
    });

    it('keeps a valid legacy compatibility render platform-funded and outside merchant reservation', async () => {
      process.env.TRYON_MODE = 'live';
      const auth = legacyCompatAuthorization();
      runImageGenerationMock.mockResolvedValue({
        jobId: 'provider-compat',
        sessionId: auth.sessionId,
        productId: auth.productId,
        shop: null,
        status: 'completed',
        resultImageUrl: 'data:image/png;base64,COMPAT',
        createdAt: '2026-08-31T00:00:00.000Z',
        meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
      });

      const job = await generateTryOn(
        auth,
        'upload',
        'data:image/png;base64,PHOTO',
        auth.canonicalGarmentUrl ?? undefined,
      );

      expect(job.shop).toBeNull();
      expect(job.resultImageUrl).toContain('COMPAT');
      expect(beginTryOnJobMock).not.toHaveBeenCalled();
      expect(finalizeTryOnJobMock).not.toHaveBeenCalled();
      expect(runImageGenerationMock).toHaveBeenCalledTimes(1);
    });

    it('rejects a forged compatibility billing shop before reservation or provider invocation', async () => {
      process.env.TRYON_MODE = 'live';
      const forged = legacyCompatAuthorization({ shop: 'victim.myshopify.com' });

      await expect(
        generateTryOn(
          forged,
          'upload',
          'data:image/png;base64,PHOTO',
          forged.canonicalGarmentUrl ?? undefined,
        ),
      ).rejects.toThrow('cannot authorize a billing shop');

      expect(beginTryOnJobMock).not.toHaveBeenCalled();
      expect(finalizeTryOnJobMock).not.toHaveBeenCalled();
      expect(persistTryOnJobMock).not.toHaveBeenCalled();
      expect(runImageGenerationMock).not.toHaveBeenCalled();
    });
  });
});
