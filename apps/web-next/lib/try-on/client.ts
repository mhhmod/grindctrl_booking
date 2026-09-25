/* Browser-side calls to the try-on API, shared by the embedded storefront
   demo (components/try-on/try-on-demo.tsx) and the public /try-on page
   (components/try-on/page). Contracts: apps/web-next/docs/handoff/site-v15/05-backend.md. */

import { classifyTryOnFailure, type TryOnFailureKind } from './shopper-errors';
import { retryAfterDelayMs, TRYON_POLL_TIMEOUT_MS, tryOnPollDelayMs } from './poll-policy';
import type { TryOnApiResponse, TryOnAttempt, TryOnJobApiResponse, TryOnSession } from './types';

export function createAttemptNonce(): string {
  const bytes = new Uint8Array(18);
  window.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** One automatic retry after a network error or a 5xx. Safe because the same
 *  signed attempt (request key) is reused, so a retry never charges twice. */
export async function fetchWithOneRetry(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  try {
    const response = await fetch(input, init);
    if (response.status < 500) return response;
  } catch (error) {
    if (isAbort(error)) throw error;
  }
  return fetch(input, init);
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function pollTryOnJob(
  jobId: string,
  signedSession: string,
  fallbackError: string,
  signal?: AbortSignal,
): Promise<TryOnJobApiResponse> {
  const deadline = Date.now() + TRYON_POLL_TIMEOUT_MS;
  let requestCount = 0;

  while (Date.now() < deadline) {
    const response = await fetch(`/api/try-on/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${signedSession}` },
      signal,
    });
    requestCount += 1;

    if (response.status === 429) {
      const scheduledDelay = tryOnPollDelayMs(requestCount);
      const serverDelay = retryAfterDelayMs(response.headers.get('Retry-After'));
      const remaining = Math.max(0, deadline - Date.now());
      await wait(Math.min(remaining, Math.max(scheduledDelay, serverDelay ?? 0)), signal);
      continue;
    }

    const data: TryOnJobApiResponse = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || data.error || fallbackError);
    }
    if (data.status === 'failed') {
      throw new Error(data.message || fallbackError);
    }
    if (data.status === 'completed') {
      if (!data.resultImageUrl) {
        throw new Error(data.message || fallbackError);
      }
      return data;
    }
    if (data.status !== 'queued' && data.status !== 'processing') {
      throw new Error(fallbackError);
    }

    const remaining = Math.max(0, deadline - Date.now());
    await wait(Math.min(remaining, tryOnPollDelayMs(requestCount)), signal);
  }

  throw new Error(fallbackError);
}

/* ─── The public demo, end to end ─── */

/** Why a public try-on did not produce a look, in terms the page can localise. */
export type PublicTryOnFailure =
  | { kind: TryOnFailureKind }
  /** The service is not configured here (503), or credits ran out. */
  | { kind: 'unavailable' }
  /** Too many requests: wait before trying again. */
  | { kind: 'rate_limited'; retryAfterMs: number };

export type PublicTryOnResult =
  | { ok: true; jobId: string; resultImageUrl: string }
  | { ok: false; failure: PublicTryOnFailure };

const DEFAULT_RETRY_AFTER_MS = 10_000;

class TryOnStop extends Error {
  constructor(readonly failure: PublicTryOnFailure) {
    super(failure.kind);
  }
}

function stopFor(response: Response, message?: string): TryOnStop {
  if (response.status === 503) return new TryOnStop({ kind: 'unavailable' });
  if (response.status === 429) {
    return new TryOnStop({
      kind: 'rate_limited',
      retryAfterMs: retryAfterDelayMs(response.headers.get('Retry-After')) ?? DEFAULT_RETRY_AFTER_MS,
    });
  }
  return new TryOnStop({ kind: classifyTryOnFailure(message ?? '') });
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Makes one look from an uploaded photo on the public demo: session, then
 * attempt, then generate, polling while the job is still running. Never
 * sends a garment URL or product name (the public session rejects them; the
 * server reads the garment from the product). Server text is classified,
 * never returned, so provider names and costs cannot reach the screen.
 */
export async function runPublicTryOn({
  productId,
  photoDataUrl,
  signal,
}: {
  productId: string;
  photoDataUrl: string;
  signal?: AbortSignal;
}): Promise<PublicTryOnResult> {
  try {
    const sessionRes = await fetchWithOneRetry('/api/try-on/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, context: 'public-demo' }),
      signal,
    });
    const sessionData = await readJson<TryOnApiResponse<TryOnSession>>(sessionRes);
    if (!sessionRes.ok || !sessionData?.ok || !sessionData.data) {
      throw stopFor(sessionRes, sessionData?.error);
    }
    const session = sessionData.data;

    const attemptRes = await fetchWithOneRetry('/api/try-on/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.sessionId, productId, attemptNonce: createAttemptNonce() }),
      signal,
    });
    const attemptData = await readJson<TryOnApiResponse<TryOnAttempt>>(attemptRes);
    if (!attemptRes.ok || !attemptData?.ok || !attemptData.data) {
      throw stopFor(attemptRes, attemptData?.error);
    }

    const generateRes = await fetchWithOneRetry('/api/try-on/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        attemptId: attemptData.data.attemptId,
        productId,
        photoSource: 'upload',
        photoReference: 'uploaded-photo',
        photoData: photoDataUrl,
      }),
      signal,
    });
    let job = await readJson<TryOnJobApiResponse>(generateRes);
    if (!job) throw stopFor(generateRes);
    if (job.code === 'TRYON_UNAVAILABLE') throw new TryOnStop({ kind: 'unavailable' });
    if (!generateRes.ok) throw stopFor(generateRes, job.message || job.error);

    if (
      job.jobId &&
      ((job.ok && (job.status === 'queued' || job.status === 'processing')) ||
        job.code === 'TRYON_FINALIZATION_PENDING')
    ) {
      job = await pollTryOnJob(job.jobId, session.sessionId, 'failed', signal);
    }

    if (!job.ok || job.status !== 'completed' || !job.resultImageUrl || !job.jobId) {
      throw new TryOnStop({ kind: classifyTryOnFailure(job.message || job.error || '') });
    }
    return { ok: true, jobId: job.jobId, resultImageUrl: job.resultImageUrl };
  } catch (error) {
    if (isAbort(error)) throw error;
    if (error instanceof TryOnStop) return { ok: false, failure: error.failure };
    return { ok: false, failure: { kind: classifyTryOnFailure(error) } };
  }
}
