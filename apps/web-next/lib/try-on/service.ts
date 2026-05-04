/* ─── Try-On Agent — Service Layer ─── */

import type { TryOnJob, TryOnMode, TryOnPhotoSource, TryOnSession } from './types';
import { runMockGeneration } from './mock-runner';
import { validateProductId, validateSessionId } from './validator';

/**
 * In-memory job store.
 *
 * ⚠️  MVP / MOCK-ONLY — This Map lives in the Node process and is lost on
 * restart, redeploy, or cold-start.  Replace with a persistent store
 * (e.g. Supabase) before enabling live mode or going to production.
 */
const jobStore = new Map<string, TryOnJob>();

/**
 * Reads TRYON_MODE from env. Defaults to 'mock' if missing.
 */
export function getTryOnMode(): TryOnMode {
  const mode = process.env.TRYON_MODE?.toLowerCase();
  if (mode === 'live') return 'live';
  return 'mock';
}

/**
 * Creates a new try-on session.
 */
export function createSession(productId: string): TryOnSession {
  const v = validateProductId(productId);
  if (!v.ok) throw new Error(v.error);

  return {
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Runs the try-on generation pipeline.
 *
 * @param sessionId   Active session identifier.
 * @param productId   Catalog product to render.
 * @param photoSource How the customer photo was supplied (`'upload'` or `'mock'`).
 *                    The caller **must** supply this so generation never fires
 *                    without a deliberate photo reference.
 *
 * In mock mode → uses mock-runner (static demo image).
 * In live mode → returns a safe fallback since no provider exists yet.
 */
export async function generateTryOn(
  sessionId: string,
  productId: string,
  photoSource: TryOnPhotoSource,
): Promise<TryOnJob> {
  const sv = validateSessionId(sessionId);
  if (!sv.ok) throw new Error(sv.error);

  const pv = validateProductId(productId);
  if (!pv.ok) throw new Error(pv.error);

  if (!photoSource) {
    throw new Error('photoSource is required — supply "upload" or "mock".');
  }

  const mode = getTryOnMode();

  let job: TryOnJob;

  if (mode === 'live') {
    // No live provider configured yet — return safe fallback.
    job = {
      jobId: `tryon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      productId,
      status: 'failed',
      message: 'Live provider is not configured yet. Please use mock mode or configure a provider.',
      createdAt: new Date().toISOString(),
      meta: {
        runtime: 'live',
        provider: 'none',
        costEstimate: 0,
      },
    };
  } else {
    job = await runMockGeneration(sessionId, productId);
  }

  // Store job for polling (⚠️ MVP in-memory — see jobStore comment above)
  jobStore.set(job.jobId, job);

  return job;
}

/**
 * Retrieves a job by ID from the in-memory store.
 *
 * ⚠️  MVP / MOCK-ONLY — reads from process-local Map.
 */
export function getJob(jobId: string): TryOnJob | undefined {
  return jobStore.get(jobId);
}
