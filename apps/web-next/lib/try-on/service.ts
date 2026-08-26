import { randomUUID } from 'node:crypto';
import type { TryOnJob, TryOnJobStatus, TryOnMode, TryOnPhotoSource, TryOnSession } from './types';
import { runMockGeneration } from './mock-runner';
import { runImageGeneration } from './image-runner';
import {
  beginTryOnJob,
  finalizeTryOnJob,
  persistTryOnJob,
} from './persistence';
import { validateProductId, validateSessionId } from './validator';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';

const DEFAULT_MODEL = 'google/gemini-3.1-flash-image';

/* In-memory job results back the polling endpoint between generation and
   render. Entries hold the full base64 result image, so the map MUST stay
   bounded: TTL covers the poll window (generation ~10s + client rendering),
   and the cap guards against burst traffic between TTL sweeps. Persistent
   credit state lives in Supabase RPCs, so eviction here never affects
   billing â€” only a poller that waited longer than TTL sees "not found". */
const JOB_TTL_MS = 30 * 60 * 1000;
const JOB_STORE_MAX = 1000;
const jobStore = new Map<string, TryOnJob>();

function createJobId(): string {
  return `tryon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

export function createSession(productId: string, shop?: unknown): TryOnSession {
  const validation = validateProductId(productId);
  if (!validation.ok) throw new Error(validation.error);

  return {
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId,
    shop: normalizeShopDomain(shop),
    createdAt: new Date().toISOString(),
  };
}

export async function generateTryOn(
  sessionId: string,
  productId: string,
  photoSource: TryOnPhotoSource,
  photoData?: string,
  garmentUrl?: string,
  productName?: string,
  shop?: unknown,
  requestKey?: string,
): Promise<TryOnJob> {
  const sessionValidation = validateSessionId(sessionId);
  if (!sessionValidation.ok) throw new Error(sessionValidation.error);

  const productValidation = validateProductId(productId);
  if (!productValidation.ok) throw new Error(productValidation.error);
  if (!photoSource) throw new Error('photoSource is required. Supply "upload" or "mock".');

  const mode = getTryOnMode();
  const startedAt = Date.now();
  const normalizedShop = normalizeShopDomain(shop);
  const billableLiveJob =
    mode === 'live' &&
    normalizedShop !== null &&
    photoSource === 'upload' &&
    Boolean(photoData);

  let job: TryOnJob;

  if (billableLiveJob) {
    const modelKey = process.env.TRYON_MODEL || DEFAULT_MODEL;
    const effectiveRequestKey = requestKey ?? randomUUID();
    const reservedJobId = createJobId();
    const reservation = await beginTryOnJob({
      shop: normalizedShop,
      jobId: reservedJobId,
      requestKey: effectiveRequestKey,
      modelKey,
      sessionId,
      productId,
    });

    if (!reservation.created) {
      job = {
        jobId: reservation.jobId,
        sessionId,
        productId,
        shop: normalizedShop,
        requestKey: effectiveRequestKey,
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
        normalizedShop,
        garmentUrl,
        productName,
      );
    } catch (error) {
      const failedJob: TryOnJob = {
        jobId: reservedJobId,
        sessionId,
        productId,
        shop: normalizedShop,
        requestKey: effectiveRequestKey,
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
      shop: normalizedShop,
      requestKey: effectiveRequestKey,
      modelKey,
      createdAt: reservation.createdAt,
    };
    await finalizeTryOnJob(job, Date.now() - startedAt);
  } else if (mode === 'live' && photoSource === 'upload' && photoData) {
    job = await runImageGeneration(
      sessionId,
      productId,
      photoData,
      normalizedShop,
      garmentUrl,
      productName,
    );
  } else if (mode === 'live') {
    job = {
      jobId: createJobId(),
      sessionId,
      productId,
      shop: normalizedShop,
      status: 'failed',
      message: 'Live mode needs an uploaded photo.',
      createdAt: new Date().toISOString(),
      meta: { runtime: 'live', provider: 'openrouter', costEstimate: 0 },
    };
  } else {
    job = await runMockGeneration(sessionId, productId, normalizedShop);
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
