import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TryOnJob } from './types';
import type { VerifiedTryOnSession } from './storefront-context';

type QueryResult = { data: unknown; error: unknown };

const {
  state,
  uploadMock,
  removeMock,
  existsMock,
  listMock,
  createSignedUrlMock,
} = vi.hoisted(() => ({
  state: {
    maybeSingleResults: [] as QueryResult[],
    cleanupResult: { data: [], error: null } as QueryResult,
    activePathResult: { data: [], error: null } as QueryResult,
    events: [] as string[],
    updatePayloads: [] as Array<Record<string, unknown>>,
  },
  uploadMock: vi.fn(),
  removeMock: vi.fn(),
  existsMock: vi.fn(),
  listMock: vi.fn(),
  createSignedUrlMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => {
  class Builder {
    selected = '';
    select(columns = '') {
      this.selected = columns;
      return this;
    }
    eq() { return this; }
    in() { return this; }
    is() { return this; }
    not() { return this; }
    lte() { return this; }
    order() { return this; }
    update(payload: Record<string, unknown>) {
      state.events.push('row-update');
      state.updatePayloads.push(payload);
      return this;
    }
    async insert() { return { error: null }; }
    async maybeSingle() {
      return state.maybeSingleResults.shift() ?? { data: null, error: null };
    }
    async limit() {
      return this.selected === 'result_storage_path'
        ? state.activePathResult
        : state.cleanupResult;
    }
  }

  const bucket = {
    upload: (...args: unknown[]) => {
      state.events.push('storage-upload');
      return uploadMock(...args);
    },
    remove: (...args: unknown[]) => {
      state.events.push('storage-remove');
      return removeMock(...args);
    },
    exists: (...args: unknown[]) => existsMock(...args),
    list: (...args: unknown[]) => listMock(...args),
    createSignedUrl: (...args: unknown[]) => createSignedUrlMock(...args),
  };

  return {
    createClient: vi.fn(() => ({
      from: () => new Builder(),
      storage: { from: () => bucket },
    })),
  };
});

import {
  cleanupExpiredTryOnResults,
  loadAuthorizedDurableTryOnJob,
  persistGeneratedTryOnResult,
  sweepOrphanedTryOnResults,
  TRYON_ORPHAN_SAFETY_GRACE_MS,
  TRYON_RESULT_RETENTION_MS,
} from './persistence';
import {
  TryOnResultPersistenceError,
  TryOnResultSchemaNotReadyError,
  TryOnResultUnavailableError,
} from './result-errors';

const NOW = Date.parse('2026-08-31T12:00:00.000Z');
const JOB_ID = 'tryon_12345678-1234-4234-8234-123456789abc';
const PATH = `jobs/${JOB_ID}/result.png`;
const ORPHAN_JOB_ID = 'tryon_aaaaaaaa-1234-4234-8234-123456789abc';
const ACTIVE_JOB_ID = 'tryon_bbbbbbbb-1234-4234-8234-123456789abc';
const RECENT_JOB_ID = 'tryon_cccccccc-1234-4234-8234-123456789abc';
const ORPHAN_PATH = `jobs/${ORPHAN_JOB_ID}/result.webp`;
const ACTIVE_PATH = `jobs/${ACTIVE_JOB_ID}/result.jpg`;

function job(
  resultImageUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
): TryOnJob {
  return {
    jobId: JOB_ID,
    sessionId: 'ts_abcdefghijklmnopqrstuvwx',
    productId: 'premium-ringer-tee',
    shop: 'store-one.myshopify.com',
    requestKey: '11111111-1111-4111-8111-111111111111',
    modelKey: 'model-v1',
    status: 'completed',
    resultImageUrl,
    createdAt: new Date(NOW - 1000).toISOString(),
    meta: { runtime: 'live', provider: 'provider-v1', costEstimate: 0.01 },
  };
}

function authorization(
  overrides: Partial<VerifiedTryOnSession> = {},
): VerifiedTryOnSession {
  return {
    iss: 'grindctrl-tryon',
    aud: 'tryon-generation-api',
    purpose: 'storefront',
    sessionId: 'ts_abcdefghijklmnopqrstuvwx',
    shop: 'store-one.myshopify.com',
    productId: 'premium-ringer-tee',
    variantId: '123',
    productGid: 'gid://shopify/Product/99',
    variantGid: 'gid://shopify/ProductVariant/123',
    canonicalGarmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
    garmentUrlDigest: 'digest-is-not-checked-by-persistence',
    nonce: 'abcdefghijklmnopqrstuvwx',
    requestKey: '11111111-1111-4111-8111-111111111111',
    iat: Math.floor(NOW / 1000) - 60,
    exp: Math.floor(NOW / 1000) + 240,
    jti: 'abcdefghijklmnop',
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    session_id: 'ts_abcdefghijklmnopqrstuvwx',
    product_id: 'premium-ringer-tee',
    shop: 'store-one.myshopify.com',
    status: 'processing',
    request_key: '11111111-1111-4111-8111-111111111111',
    model_key: 'model-v1',
    provider: 'provider-v1',
    cost_usd: 0.01,
    message: null,
    created_at: new Date(NOW - 1000).toISOString(),
    result_storage_path: null,
    result_persisted_at: null,
    result_expires_at: null,
    result_deleted_at: null,
    ...overrides,
  };
}

describe('durable try-on result persistence', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    state.maybeSingleResults = [];
    state.cleanupResult = { data: [], error: null };
    state.activePathResult = { data: [], error: null };
    state.events = [];
    state.updatePayloads = [];
    uploadMock.mockReset().mockResolvedValue({ data: { path: PATH }, error: null });
    removeMock.mockReset().mockResolvedValue({ data: [], error: null });
    existsMock.mockReset().mockResolvedValue({ data: true, error: null });
    listMock.mockReset().mockResolvedValue({ data: [], error: null });
    createSignedUrlMock.mockReset().mockResolvedValue({
      data: { signedUrl: 'https://storage.example/signed-result' },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('validates and uploads the provider result before binding its lifecycle row', async () => {
    state.maybeSingleResults.push(
      { data: row(), error: null },
      { data: { id: JOB_ID }, error: null },
    );

    const result = await persistGeneratedTryOnResult(job(), NOW);

    expect(state.events).toEqual(['storage-upload', 'row-update']);
    expect(uploadMock).toHaveBeenCalledWith(
      PATH,
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/png', upsert: false }),
    );
    expect(state.updatePayloads[0]).toMatchObject({
      result_storage_path: PATH,
      result_persisted_at: new Date(NOW).toISOString(),
      result_expires_at: new Date(NOW + TRYON_RESULT_RETENTION_MS).toISOString(),
      result_deleted_at: null,
    });
    expect(result.storagePath).toBe(PATH);
  });

  it('removes the uploaded object when the lifecycle row update fails', async () => {
    state.maybeSingleResults.push(
      { data: row(), error: null },
      { data: null, error: { code: 'PGRST204', message: 'column missing from schema cache' } },
    );

    await expect(persistGeneratedTryOnResult(job(), NOW)).rejects.toBeInstanceOf(
      TryOnResultSchemaNotReadyError,
    );

    expect(state.events).toEqual(['storage-upload', 'row-update', 'storage-remove']);
    expect(removeMock).toHaveBeenCalledWith([PATH]);
  });

  it('returns an existing active lifecycle idempotently without another upload', async () => {
    state.maybeSingleResults.push({
      data: row({
        result_storage_path: PATH,
        result_persisted_at: new Date(NOW - 1000).toISOString(),
        result_expires_at: new Date(NOW + 60_000).toISOString(),
      }),
      error: null,
    });

    const result = await persistGeneratedTryOnResult(job(), NOW);

    expect(result.storagePath).toBe(PATH);
    expect(uploadMock).not.toHaveBeenCalled();
    expect(state.updatePayloads).toHaveLength(0);
  });

  it('rejects a reservation identity mismatch before upload or lifecycle binding', async () => {
    state.maybeSingleResults.push({
      data: row({ session_id: 'ts_different-owner-session' }),
      error: null,
    });

    await expect(persistGeneratedTryOnResult(job(), NOW)).rejects.toBeInstanceOf(
      TryOnResultPersistenceError,
    );
    expect(uploadMock).not.toHaveBeenCalled();
    expect(state.updatePayloads).toHaveLength(0);
  });

  it('fails closed for an unavailable bucket and invalid or oversized provider data', async () => {
    state.maybeSingleResults.push({ data: row(), error: null });
    uploadMock.mockResolvedValueOnce({ data: null, error: { message: 'Bucket not found' } });
    await expect(persistGeneratedTryOnResult(job(), NOW)).rejects.toBeInstanceOf(
      TryOnResultSchemaNotReadyError,
    );

    await expect(
      persistGeneratedTryOnResult(job('data:image/gif;base64,aGVsbG8='), NOW),
    ).rejects.toBeInstanceOf(TryOnResultPersistenceError);
    await expect(
      persistGeneratedTryOnResult(job('data:image/png;base64,aGVsbG8='), NOW),
    ).rejects.toBeInstanceOf(TryOnResultPersistenceError);
    const oversized = Buffer.alloc(16 * 1024 * 1024 + 1).toString('base64');
    await expect(
      persistGeneratedTryOnResult(job(`data:image/png;base64,${oversized}`), NOW),
    ).rejects.toBeInstanceOf(TryOnResultPersistenceError);
  });

  it('recovers a finalizer-pending durable result after restart and signs it only after full authorization', async () => {
    state.maybeSingleResults.push({
      data: row({
        status: 'processing',
        result_storage_path: PATH,
        result_persisted_at: new Date(NOW - 1000).toISOString(),
        result_expires_at: new Date(NOW + 10 * 60_000).toISOString(),
      }),
      error: null,
    });

    const recovered = await loadAuthorizedDurableTryOnJob(authorization(), JOB_ID, NOW);

    expect(recovered).toMatchObject({
      jobId: JOB_ID,
      status: 'completed',
      resultImageUrl: 'https://storage.example/signed-result',
    });
    expect(existsMock).toHaveBeenCalledWith(PATH);
    expect(createSignedUrlMock).toHaveBeenCalledWith(PATH, 240);

    for (const mismatch of [
      { sessionId: 'ts_zyxwvutsrqponmlkjihgfedc' },
      { productId: 'different-product' },
      { shop: 'victim.myshopify.com' },
    ]) {
      state.maybeSingleResults.push({
        data: row({
          status: 'completed',
          result_storage_path: PATH,
          result_persisted_at: new Date(NOW - 1000).toISOString(),
          result_expires_at: new Date(NOW + 60_000).toISOString(),
        }),
        error: null,
      });
      expect(await loadAuthorizedDurableTryOnJob(authorization(mismatch), JOB_ID, NOW)).toBeNull();
    }
    expect(existsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlMock).toHaveBeenCalledTimes(1);
  });

  it('returns a typed unavailable error when the durable object is missing', async () => {
    state.maybeSingleResults.push({
      data: row({
        status: 'completed',
        result_storage_path: PATH,
        result_persisted_at: new Date(NOW - 1000).toISOString(),
        result_expires_at: new Date(NOW + 60_000).toISOString(),
      }),
      error: null,
    });
    existsMock.mockResolvedValueOnce({
      data: false,
      error: { message: 'Object not found' },
    });

    await expect(
      loadAuthorizedDurableTryOnJob(authorization(), JOB_ID, NOW),
    ).rejects.toBeInstanceOf(TryOnResultUnavailableError);
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'expired',
      lifecycle: {
        result_storage_path: PATH,
        result_persisted_at: new Date(NOW - 60_000).toISOString(),
        result_expires_at: new Date(NOW - 1).toISOString(),
      },
    },
    {
      label: 'deleted',
      lifecycle: {
        result_storage_path: null,
        result_persisted_at: new Date(NOW - 60_000).toISOString(),
        result_expires_at: new Date(NOW + 60_000).toISOString(),
        result_deleted_at: new Date(NOW - 1000).toISOString(),
      },
    },
  ])('returns a typed unavailable error for $label results', async ({ lifecycle }) => {
    state.maybeSingleResults.push({ data: row({ status: 'completed', ...lifecycle }), error: null });

    await expect(
      loadAuthorizedDurableTryOnJob(authorization(), JOB_ID, NOW),
    ).rejects.toBeInstanceOf(TryOnResultUnavailableError);
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it('alerts on a completed row that never received a durable result', async () => {
    state.maybeSingleResults.push({ data: row({ status: 'completed' }), error: null });
    const alert = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      loadAuthorizedDurableTryOnJob(authorization(), JOB_ID, NOW),
    ).rejects.toBeInstanceOf(TryOnResultUnavailableError);
    expect(alert).toHaveBeenCalledWith(
      '[try-on] reconciliation_required',
      { reason: 'completed_result_missing', jobId: JOB_ID },
    );
    expect(JSON.stringify(alert.mock.calls)).not.toContain('store-one');
  });

  it('cleans expired objects Storage-first and is orphan-safe and idempotent', async () => {
    state.cleanupResult = {
      data: [{ id: JOB_ID, result_storage_path: PATH }],
      error: null,
    };
    state.maybeSingleResults.push({ data: { id: JOB_ID }, error: null });
    removeMock.mockResolvedValueOnce({ data: [], error: null });

    const first = await cleanupExpiredTryOnResults(500, NOW);
    expect(first).toEqual({ scanned: 1, deleted: 1, failed: 0 });
    expect(state.events).toEqual(['storage-remove', 'row-update']);

    state.cleanupResult = { data: [], error: null };
    state.events = [];
    const second = await cleanupExpiredTryOnResults(50, NOW);
    expect(second).toEqual({ scanned: 0, deleted: 0, failed: 0 });
    expect(state.events).toEqual([]);
  });

  it('consumes a missed-schedule expiry backlog in bounded successive runs', async () => {
    const secondJobId = 'tryon_dddddddd-1234-4234-8234-123456789abc';
    const secondPath = `jobs/${secondJobId}/result.png`;
    state.cleanupResult = {
      data: [{ id: JOB_ID, result_storage_path: PATH }],
      error: null,
    };
    state.maybeSingleResults.push({ data: { id: JOB_ID }, error: null });

    expect(await cleanupExpiredTryOnResults(1, NOW)).toEqual({
      scanned: 1,
      deleted: 1,
      failed: 0,
    });

    state.cleanupResult = {
      data: [{ id: secondJobId, result_storage_path: secondPath }],
      error: null,
    };
    state.maybeSingleResults.push({ data: { id: secondJobId }, error: null });
    expect(await cleanupExpiredTryOnResults(1, NOW + 1)).toEqual({
      scanned: 1,
      deleted: 1,
      failed: 0,
    });
    expect(removeMock).toHaveBeenNthCalledWith(1, [PATH]);
    expect(removeMock).toHaveBeenNthCalledWith(2, [secondPath]);
  });

  it('deletes only grace-aged unreferenced objects and preserves active or recent results', async () => {
    const old = new Date(NOW - TRYON_ORPHAN_SAFETY_GRACE_MS - 1).toISOString();
    const recent = new Date(NOW - TRYON_ORPHAN_SAFETY_GRACE_MS + 1).toISOString();
    listMock.mockImplementation(async (prefix: string) => {
      if (prefix === 'jobs') {
        return {
          data: [ORPHAN_JOB_ID, ACTIVE_JOB_ID, RECENT_JOB_ID].map((name) => ({
            name,
            id: null,
          })),
          error: null,
        };
      }
      const jobId = prefix.slice('jobs/'.length);
      const extension = jobId === ORPHAN_JOB_ID ? 'webp' : jobId === ACTIVE_JOB_ID ? 'jpg' : 'png';
      return {
        data: [{
          name: `result.${extension}`,
          id: `object-${jobId}`,
          created_at: jobId === RECENT_JOB_ID ? recent : old,
          updated_at: jobId === RECENT_JOB_ID ? recent : old,
        }],
        error: null,
      };
    });
    state.activePathResult = {
      data: [{ result_storage_path: ACTIVE_PATH }],
      error: null,
    };

    const summary = await sweepOrphanedTryOnResults(25, NOW);

    expect(summary).toEqual({
      foldersScanned: 3,
      objectsScanned: 3,
      candidates: 2,
      deleted: 1,
      skipped: 2,
      failed: 0,
    });
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith([ORPHAN_PATH]);
    expect(removeMock).not.toHaveBeenCalledWith([ACTIVE_PATH]);
  });

  it('retries orphan deletion failures safely and becomes idempotent after success', async () => {
    const old = new Date(NOW - TRYON_ORPHAN_SAFETY_GRACE_MS - 1).toISOString();
    let objectPresent = true;
    listMock.mockImplementation(async (prefix: string) => {
      if (prefix === 'jobs') {
        return {
          data: objectPresent ? [{ name: ORPHAN_JOB_ID, id: null }] : [],
          error: null,
        };
      }
      return {
        data: objectPresent
          ? [{ name: 'result.webp', id: 'orphan-object', created_at: old, updated_at: old }]
          : [],
        error: null,
      };
    });
    removeMock
      .mockResolvedValueOnce({ data: null, error: { message: 'temporary storage failure' } })
      .mockImplementationOnce(async () => {
        objectPresent = false;
        return { data: [], error: null };
      });

    expect(await sweepOrphanedTryOnResults(1, NOW)).toMatchObject({
      candidates: 1,
      deleted: 0,
      failed: 1,
    });
    expect(await sweepOrphanedTryOnResults(1, NOW + 1)).toMatchObject({
      candidates: 1,
      deleted: 1,
      failed: 0,
    });
    expect(await sweepOrphanedTryOnResults(1, NOW + 2)).toEqual({
      foldersScanned: 0,
      objectsScanned: 0,
      candidates: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    });
  });
});
