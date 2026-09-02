import { randomUUID } from 'node:crypto';
import type { TryOnJob, TryOnJobStatus, TryOnMode, TryOnPhotoSource } from './types';
import { runMockGeneration } from './mock-runner';
import { runImageGeneration } from './image-runner';
import {
  beginTryOnJob,
  finalizeTryOnJob,
  loadAuthorizedDurableTryOnJob,
  persistGeneratedTryOnResult,
  persistTryOnJob,
} from './persistence';
import { validateProductId, validateSessionId } from './validator';
import type { VerifiedTryOnSession } from './storefront-context';
import {
  TryOnFinalizationPendingError,
  TryOnResultUnavailableError,
} from './result-errors';

export {
  TryOnFinalizationPendingError,
  TryOnResultPersistenceError,
  TryOnResultSchemaNotReadyError,
  TryOnResultUnavailableError,
} from './result-errors';

const DEFAULT_MODEL = 'google/gemini-3.1-flash-image';

/* In-memory job results are the polling fast path between generation and
   render. Entries hold the full base64 result image, so the map MUST stay
   bounded: TTL covers the poll window (generation ~10s + client rendering),
   and the cap guards against burst traffic between TTL sweeps. Billable
   storefront results also have a short-lived private durable fallback, so
   eviction or a process restart does not trigger another provider call. */
const JOB_TTL_MS = 30 * 60 * 1000;
const JOB_STORE_MAX = 1000;
const jobStore = new Map<string, TryOnJob>();

function alertReconciliationRequired(
  reason: 'completed_result_missing' | 'finalization_failed' | 'persist_refund_failed',
  jobId: string,
): void {
  // Job IDs are opaque server-generated identifiers. Never log session
  // capabilities, shopper photos, result images, or merchant domains here.
  console.error('[try-on] reconciliation_required', { reason, jobId });
}

function assertCompletedResultRecoverable(job: TryOnJob): void {
  if (job.status !== 'completed' || job.resultImageUrl) return;
  alertReconciliationRequired('completed_result_missing', job.jobId);
  throw new TryOnResultUnavailableError(job.jobId);
}

function createJobId(): string {
  return `tryon_${randomUUID()}`;
}

export function storeJob(job: TryOnJob, now: number = Date.now()): void {
  for (const [id, existing] of jobStore) {
    const createdAt = Date.parse(existing.createdAt);
    if (!Number.isFinite(createdAt) || now - createdAt > JOB_TTL_MS) {
      jobStore.delete(id);
    }
  }
  while (jobStore.size >= JOB_STORE_MAX) {
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [id, existing] of jobStore) {
      const t = Date.parse(existing.createdAt);
      const time = Number.isFinite(t) ? t : 0;
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }
    if (oldestId === null) break;
    jobStore.delete(oldestId);
  }
  jobStore.set(job.jobId, job);
}

export function getTryOnMode(): TryOnMode {
  const mode = process.env.TRYON_MODE?.toLowerCase();
  if (mode === 'live') return 'live';
  return 'mock';
}

export async function generateTryOn(
  authorization: VerifiedTryOnSession,
  photoSource: TryOnPhotoSource,
  photoData?: string,
  garmentUrl?: string,
  productName?: string,
): Promise<TryOnJob> {
  const { sessionId, productId, shop, requestKey, purpose } = authorization;
  const sessionValidation = validateSessionId(sessionId);
  if (!sessionValidation.ok) throw new Error(sessionValidation.error);

  const productValidation = validateProductId(productId);
  if (!productValidation.ok) throw new Error(productValidation.error);
  if (!photoSource) throw new Error('photoSource is required. Supply "upload" or "mock".');
  if (purpose === 'legacy-compat' && shop !== null) {
    throw new Error('Legacy compatibility sessions cannot authorize a billing shop.');
  }

  const mode = getTryOnMode();
  const startedAt = Date.now();
  const billableLiveJob =
    mode === 'live' &&
    purpose === 'storefront' &&
    shop !== null &&
    photoSource === 'upload' &&
    Boolean(photoData);

  let job: TryOnJob;

  if (billableLiveJob) {
    const modelKey = process.env.TRYON_MODEL || DEFAULT_MODEL;
    const reservedJobId = createJobId();
    const reservation = await beginTryOnJob({
      shop,
      jobId: reservedJobId,
      requestKey,
      modelKey,
      sessionId,
      productId,
    });

    if (!reservation.created) {
      const cached = jobStore.get(reservation.jobId);
      if (
        cached &&
        cached.sessionId === sessionId &&
        cached.productId === productId &&
        cached.shop === shop &&
        cached.requestKey === requestKey
      ) {
        assertCompletedResultRecoverable(cached);
        return cached;
      }
      const durableJob = await loadAuthorizedDurableTryOnJob(
        authorization,
        reservation.jobId,
      );
      if (durableJob) {
        return durableJob;
      }
      job = {
        jobId: reservation.jobId,
        sessionId,
        productId,
        shop,
        requestKey,
        modelKey: reservation.modelKey,
        status: reservation.status as TryOnJobStatus,
        message: reservation.message ?? undefined,
        createdAt: reservation.createdAt,
        meta: {
          runtime: 'live',
          provider: reservation.provider ?? reservation.modelKey,
          costEstimate: reservation.costUsd ?? 0,
        },
      };
      storeJob(job);
      return job;
    }

    let generated: TryOnJob;
    try {
      generated = await runImageGeneration(
        sessionId,
        productId,
        photoData as string,
        shop,
        garmentUrl,
        productName,
      );
    } catch (error) {
      const failedJob: TryOnJob = {
        jobId: reservedJobId,
        sessionId,
        productId,
        shop,
        requestKey,
        modelKey,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Image generation failed.',
        createdAt: reservation.createdAt,
        meta: { runtime: 'live', provider: modelKey, costEstimate: 0 },
      };
      await finalizeTryOnJob(failedJob, Date.now() - startedAt);
      storeJob(failedJob);
      throw error;
    }

    job = {
      ...generated,
      jobId: reservedJobId,
      shop,
      requestKey,
      modelKey,
      createdAt: reservation.createdAt,
    };
    if (job.status !== 'completed' || !job.resultImageUrl) {
      await finalizeTryOnJob(job, Date.now() - startedAt);
      storeJob(job);
      return job;
    }

    /* Durability is a billing prerequisite: upload + bind the private result
       to this reserved job before finalizing its credit debit.

       reserve_tryon_credit writes the ledger debit up front, at reservation —
       not at finalize. So an un-released failure here leaves a REAL debit
       standing against the merchant with nothing delivered, until the
       10-minute reconciliation sweep happens to run. Release it here instead,
       exactly as the generation-failure path above does, so the debit and the
       delivery fail together. This also makes the durable-result migration
       safe to apply after this code ships: an unmigrated database throws
       TryOnResultSchemaNotReadyError right here, and the merchant is not
       charged for a result that never existed. */
    try {
      await persistGeneratedTryOnResult(job);
    } catch (error) {
      const unpersistedJob: TryOnJob = {
        ...job,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Result could not be stored.',
        meta: { ...job.meta, costEstimate: 0 },
      };
      try {
        await finalizeTryOnJob(unpersistedJob, Date.now() - startedAt);
      } catch {
        // The release itself failed; reconciliation is now the only net left.
        alertReconciliationRequired('persist_refund_failed', job.jobId);
      }
      storeJob(unpersistedJob);
      throw error;
    }
    storeJob(job);
    try {
      await finalizeTryOnJob(job, Date.now() - startedAt);
    } catch {
      alertReconciliationRequired('finalization_failed', job.jobId);
      throw new TryOnFinalizationPendingError(job.jobId);
    }
  } else if (mode === 'live' && photoSource === 'upload' && photoData) {
    job = await runImageGeneration(
      sessionId,
      productId,
      photoData,
      shop,
      garmentUrl,
      productName,
    );
  } else if (mode === 'live') {
    job = {
      jobId: createJobId(),
      sessionId,
      productId,
      shop,
      status: 'failed',
      message: 'Live mode needs an uploaded photo.',
      createdAt: new Date().toISOString(),
      meta: { runtime: 'live', provider: 'openrouter', costEstimate: 0 },
    };
  } else {
    job = await runMockGeneration(sessionId, productId, shop);
  }
  storeJob(job);
  if (mode === 'live' && !billableLiveJob) {
    await persistTryOnJob(job, Date.now() - startedAt).catch(() => {});
  }
  return job;
}

export function getJob(jobId: string): TryOnJob | undefined {
  return jobStore.get(jobId);
}
