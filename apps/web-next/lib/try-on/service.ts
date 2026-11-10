import { randomUUID } from 'node:crypto';
import type { TryOnJob, TryOnJobStatus, TryOnMode, TryOnPhotoSource, TryOnStage } from './types';
import { createHash } from 'node:crypto';
import { runMockGeneration } from './mock-runner';
import { prepareGarmentImage, runImageGeneration } from './image-runner';
import { createJobTimings, persistJobTimings } from './job-timings';
import {
  beginTestTryOnJob,
  beginPublicDemoTryOnJob,
  beginTryOnJob,
  completePublicDemoTryOnJob,
  finalizeTryOnJob,
  loadAuthorizedDurableTryOnJob,
  persistGeneratedTryOnResult,
  persistPublicDemoTryOnResult,
  prepareTryOnResultPersistence,
  persistTryOnJob,
} from './persistence';
import { validateProductId, validateSessionId } from './validator';
import { getShopModelKey } from './entitlement';
import type { VerifiedTryOnSession } from './storefront-context';
import {
  TryOnFinalizationPendingError,
  TryOnResultUnavailableError,
} from './result-errors';
import { toShopperFailureMessage } from './shopper-errors';
import { TRYON_IMAGE_MODEL } from './models';
import { TRYON_SESSION_TTL_SECONDS } from './storefront-context';

export {
  TryOnFinalizationPendingError,
  TryOnResultPersistenceError,
  TryOnResultSchemaNotReadyError,
  TryOnResultUnavailableError,
} from './result-errors';

/* In-memory job results are the polling fast path between generation and
   render. Entries hold the full base64 result image, so the map MUST stay
   bounded: TTL covers the poll window (generation ~10s + client rendering),
   and the cap guards against burst traffic between TTL sweeps. Billable
   storefront results also have a short-lived private durable fallback, so
   eviction or a process restart does not trigger another provider call.
   A job is only ever read through its try-on session, so it lives no longer
   than a session can, and the shopper's browser drops it sooner with
   forgetJob once it holds the look (phase zero item 2). */
export const JOB_TTL_MS = TRYON_SESSION_TTL_SECONDS * 1000;
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
    if (isExpired(existing, now)) jobStore.delete(id);
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

/** How a billable look runs. With `background`, the call answers as soon
 *  as the look is reserved and the provider work finishes after the
 *  response (the default HTTP route uses Next after()); the
 *  job then reports its stage until it settles. Without it, the call waits
 *  for the look, as it always has. */
export type GenerateOptions = {
  clientTimings?: unknown;
  background?: (task: () => Promise<void>) => void;
};

function setStage(job: TryOnJob, stage: TryOnStage): void {
  storeJob({ ...job, stage });
}

export async function generateTryOn(
  authorization: VerifiedTryOnSession,
  photoSource: TryOnPhotoSource,
  photoData?: string,
  garmentUrl?: string,
  productName?: string,
  options: GenerateOptions = {},
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
  if (purpose === 'public-demo' && shop !== null) {
    throw new Error('Public demo sessions cannot authorize a billing shop.');
  }

  const mode = getTryOnMode();
  const startedAt = Date.now();
  const clockStarted = performance.now();
  const timings = createJobTimings(photoData, options.clientTimings);
  const finishTimings = async (finished: TryOnJob) => {
    timings.total_ms = performance.now() - clockStarted;
    await persistJobTimings(finished, timings);
  };
  const finalize = async (finished: TryOnJob) => {
    const start = performance.now();
    try {
      await finalizeTryOnJob(finished, Date.now() - startedAt);
    } finally {
      timings.finalize_ms += performance.now() - start;
      await finishTimings(finished);
    }
  };
  const billableLiveJob =
    mode === 'live' &&
    purpose === 'storefront' &&
    shop !== null &&
    photoSource === 'upload' &&
    Boolean(photoData);

  let job: TryOnJob;

  if (billableLiveJob) {
    // Fetch/encode only: this never spends provider credits. Start before
    // plan lookup/reservation, and settle rejection immediately so a denied
    // reservation cannot leave an unhandled speculative fetch rejection.
    const garmentController = new AbortController();
    const garmentStarted = performance.now();
    const garment = prepareGarmentImage(productId, garmentUrl, shop, garmentController.signal, authorization.origin)
      .then(value => ({ value }), error => ({ error: error as unknown }))
      .finally(() => { timings.garment_ms = performance.now() - garmentStarted; });
    const reserve = async () => {
      /* tryon_plans.model_key holds a tier label (lite, flash, muse), not a
         provider id. reserve_tryon_credit still records it on the job and
         ledger, but it no longer picks the model: every plan renders with
         the same one. Sending the label upstream got every paid storefront
         try-on rejected, so OpenRouter only ever receives the model id. */
      const planStarted = performance.now();
      const modelKey = (await getShopModelKey(shop)) || TRYON_IMAGE_MODEL;
      timings.plan_ms = performance.now() - planStarted;
      const providerModel = TRYON_IMAGE_MODEL;
      const reservedJobId = createJobId();
      /* The owner's look from the preview link is a test look (N5): the job
         is recorded but no look is spent, and a daily cap applies instead.
         The flag is signed into the session, so a shopper cannot set it. */
      const reservationStarted = performance.now();
      const productInfo = authorization.platform ? { productInfo: {
        title: authorization.title, imageUrl: authorization.canonicalGarmentUrl,
      } } : {};
      let reservation: Awaited<ReturnType<typeof beginTryOnJob>>;
      try {
        reservation =
          authorization.test === true
            ? await beginTestTryOnJob({ shop, jobId: reservedJobId, requestKey, sessionId, productId, ...productInfo })
            : await beginTryOnJob({
                shop,
                jobId: reservedJobId,
                requestKey,
                modelKey,
                sessionId,
                productId,
                ...productInfo,
              });
      } finally {
        timings.reservation_ms = performance.now() - reservationStarted;
      }
      return { reservation, modelKey, providerModel, reservedJobId };
    };
    let reserved: Awaited<ReturnType<typeof reserve>>;
    try {
      reserved = await reserve();
    } catch (error) {
      garmentController.abort();
      throw error;
    }
    const { reservation, modelKey, providerModel, reservedJobId } = reserved;

    if (!reservation.created) {
      garmentController.abort();
      const cached = getJob(reservation.jobId);
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
          costEstimate: reservation.costUsd,
        },
      };
      storeJob(job);
      return job;
    }

    /* The job as it stands while the provider works, pollable by its
       session from the moment the look is reserved. */
    const pending: TryOnJob = {
      jobId: reservedJobId,
      sessionId,
      productId,
      shop,
      requestKey,
      modelKey,
      status: 'processing',
      stage: 'received',
      createdAt: reservation.createdAt,
      meta: { runtime: 'live', provider: providerModel, costEstimate: null },
    };
    const makeLook = async (): Promise<TryOnJob> => {
      setStage(pending, 'making');
      const resultLookupStarted = performance.now();
      const resultRow = prepareTryOnResultPersistence(reservedJobId)
        .finally(() => { timings.result_lookup_ms = performance.now() - resultLookupStarted; });
      let generated: TryOnJob;
      try {
        generated = await runImageGeneration(
          sessionId,
          productId,
          photoData as string,
          shop,
          providerModel,
          garmentUrl,
          productName,
          { garment, timings },
        );
      } catch (error) {
        /* The detail the shopper must not see is exactly the detail we need.
           meta is returned to the storefront too, so it cannot go there either
           — server logs only. */
        console.error('[try-on] generation_failed_detail', {
          jobId: reservedJobId,
          shop,
          provider: providerModel,
          detail: error instanceof Error ? error.message : String(error),
        });
        const failedJob: TryOnJob = {
          jobId: reservedJobId,
          sessionId,
          productId,
          shop,
          requestKey,
          modelKey,
          status: 'failed',
          /* The shopper sees this string. A provider's message must never reach
             a storefront: ours arrived as "Insufficient credits. Add more using
             https://openrouter.ai/settings/credits" and was rendered to a
             merchant's customers, naming our vendor and linking our billing
             page. The real text still reaches logs and Sentry below, where it
             is actually useful. */
          message: toShopperFailureMessage(error),
          createdAt: reservation.createdAt,
          meta: { runtime: 'live', provider: providerModel, costEstimate: null },
        };
        // Stored before the refund, so a poll ends even if the refund throws.
        storeJob(failedJob);
        await finalize(failedJob);
        throw error;
      }

      const job: TryOnJob = {
        ...generated,
        jobId: reservedJobId,
        shop,
        requestKey,
        modelKey,
        createdAt: reservation.createdAt,
      };
      if (job.status !== 'completed' || !job.resultImageUrl) {
        storeJob(job);
        await finalize(job);
        return job;
      }
      setStage(pending, 'finishing');

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
      const persistenceStarted = performance.now();
      try {
        await persistGeneratedTryOnResult(job, Date.now(), resultRow);
      } catch (error) {
        timings.persistence_ms = performance.now() - persistenceStarted;
        const unpersistedJob: TryOnJob = {
          ...job,
          status: 'failed',
          // Same boundary: a storage failure is ours, not something to explain
          // to a shopper in our own vocabulary.
          message: toShopperFailureMessage(error),
          // Refunding the merchant does not reverse the provider's own bill.
          meta: { ...job.meta },
        };
        try {
          await finalize(unpersistedJob);
        } catch {
          // The release itself failed; reconciliation is now the only net left.
          alertReconciliationRequired('persist_refund_failed', job.jobId);
        }
        storeJob(unpersistedJob);
        throw error;
      }
      timings.persistence_ms = performance.now() - persistenceStarted;
      storeJob(job);
      try {
        await finalize(job);
      } catch {
        alertReconciliationRequired('finalization_failed', job.jobId);
        throw new TryOnFinalizationPendingError(job.jobId);
      }
      return job;
    };

    if (options.background) {
      /* Every outcome lands in the job store on its own (completed, failed
         and refunded, or kept pollable while finalization is pending), so
         the background run has nothing to hand back. */
      storeJob(pending);
      options.background(async () => {
        try {
          await makeLook();
        } catch (error) {
          console.error('[try-on] background_look_failed', {
            jobId: reservedJobId,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
          // Whatever went wrong, a look still shown as being made must end.
          if (getJob(reservedJobId)?.status === 'processing') {
            storeJob({ ...pending, stage: undefined, status: 'failed', message: toShopperFailureMessage(error) });
          }
        }
      });
      return getJob(reservedJobId) ?? pending;
    }
    job = await makeLook();
  } else if (mode === 'live' && photoSource === 'upload' && photoData) {
    // Non-billable live path (demo/preview, not a storefront credit spend):
    // the same model as every plan.
    for (const existing of jobStore.values()) {
      if (existing.requestKey === requestKey && existing.sessionId === sessionId &&
          existing.productId === productId && existing.shop === shop && !isExpired(existing, Date.now())) {
        return existing;
      }
    }
    const publicDemo = purpose === 'public-demo' && shop === null;
    const demoJobId = publicDemo
      ? `tryon_demo_${createHash('sha256').update(JSON.stringify([sessionId, productId, requestKey])).digest('hex')}`
      : createJobId();
    const pending: TryOnJob = {
      jobId: demoJobId, sessionId, productId, shop, requestKey,
      status: 'processing', stage: 'received', createdAt: new Date().toISOString(),
      meta: { runtime: 'live', provider: TRYON_IMAGE_MODEL, costEstimate: null },
    };
    if (publicDemo) {
      const claimStarted = performance.now();
      const created = await beginPublicDemoTryOnJob(authorization, pending);
      timings.reservation_ms = performance.now() - claimStarted;
      if (!created) {
        const replay = await loadAuthorizedDurableTryOnJob(authorization, demoJobId);
        if (!replay) throw new TryOnResultUnavailableError(demoJobId);
        storeJob(replay);
        return replay;
      }
    }
    storeJob(pending);
    const makeDemo = async () => {
      setStage(pending, 'making');
      let completed: TryOnJob;
      try {
        completed = { ...await runImageGeneration(
          sessionId, productId, photoData, shop, TRYON_IMAGE_MODEL, garmentUrl, productName, { timings, pageOrigin: authorization.origin },
        ), jobId: pending.jobId, requestKey, sessionId, productId, shop, createdAt: pending.createdAt };
      } catch (error) {
        completed = { ...pending, status: 'failed', stage: undefined, message: toShopperFailureMessage(error) };
      }
      const persistenceStarted = performance.now();
      if (publicDemo) {
        if (completed.status === 'completed' && completed.resultImageUrl) {
          try {
            await persistPublicDemoTryOnResult(authorization, completed);
          } catch (error) {
            completed = {
              ...completed, status: 'failed', resultImageUrl: undefined, completedAt: undefined,
              message: toShopperFailureMessage(error),
            };
          }
        }
        storeJob(completed);
        await completePublicDemoTryOnJob(authorization, completed, Date.now() - startedAt).catch(() => {
          console.error('[try-on] public_job_finalization_failed', { jobId: completed.jobId });
        });
      } else {
        storeJob(completed);
        await persistTryOnJob(completed, Date.now() - startedAt, authorization).catch(() => {});
      }
      timings.persistence_ms = performance.now() - persistenceStarted;
      await finishTimings(completed);
      return completed;
    };
    if (options.background) {
      options.background(async () => { await makeDemo(); });
      return pending;
    }
    return makeDemo();
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
    await persistTryOnJob(job, Date.now() - startedAt, authorization).catch(() => {});
  }
  return job;
}

function isExpired(job: TryOnJob, now: number): boolean {
  const createdAt = Date.parse(job.createdAt);
  return !Number.isFinite(createdAt) || now - createdAt > JOB_TTL_MS;
}

export function getJob(jobId: string, now: number = Date.now()): TryOnJob | undefined {
  const job = jobStore.get(jobId);
  if (job && isExpired(job, now)) {
    jobStore.delete(jobId);
    return undefined;
  }
  return job;
}

/** Drops a job's in-memory copy, result image included. */
export function forgetJob(jobId: string): void {
  jobStore.delete(jobId);
}
