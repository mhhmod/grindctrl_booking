/* Browser-side calls to the try-on API, shared by the embedded storefront
   demo (components/try-on/try-on-demo.tsx) and the public /try-on page
   (components/try-on/page). Contracts: apps/web-next/docs/handoff/site-v15/05-backend.md. */

import { classifyTryOnFailure, type TryOnFailureKind } from './shopper-errors';
import { retryAfterDelayMs, TRYON_ASYNC_POLL_TIMEOUT_MS, TRYON_POLL_INITIAL_DELAY_MS, TRYON_POLL_TIMEOUT_MS, tryOnPollDelayMs } from './poll-policy';
import { recordTryOnPhase } from './performance';
import { preloadTurnstile, TurnstileChallengeError } from './turnstile-client';
import { LookPreparation, type ClientLookTimings } from './look-preparation';
import type { TryOnApiResponse, TryOnAttempt, TryOnJobApiResponse, TryOnSession } from './types';

export function createAttemptNonce(): string {
  const bytes = new Uint8Array(18);
  window.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Acknowledgment time cannot be known in the original request body. This
 * best-effort report uses the same signed session as polling, no photo data. */
export function reportClientLookTimings(jobId: string, session: string, clientTimings: ClientLookTimings): void {
  void fetch(`/api/try-on/jobs/${encodeURIComponent(jobId)}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientTimings }), keepalive: true,
  }).catch(() => {});
}

export type PublicLookPreparation = { session: TryOnSession; preparation: LookPreparation };
export async function preparePublicLook(productId: string, signal?: AbortSignal): Promise<PublicLookPreparation> {
  const response = await fetchWithOneRetry('/api/try-on/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, context: 'public-demo' }), signal,
  });
  const data = await readJson<TryOnApiResponse<TryOnSession>>(response);
  if (!response.ok || !data?.ok || !data.data) throw stopFor(response, data?.error);
  const session = data.data;
  if (session.humanCheck) preloadTurnstile();
  const preparation = new LookPreparation(async (attemptSignal) => {
    const res = await fetchWithOneRetry('/api/try-on/attempt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: attemptSignal,
      body: JSON.stringify({ sessionId: session.sessionId, productId, attemptNonce: createAttemptNonce() }),
    });
    const attempt = await readJson<TryOnApiResponse<TryOnAttempt>>(res);
    if (!res.ok || !attempt?.ok || !attempt.data) throw stopFor(res, attempt?.error);
    return attempt.data;
  });
  signal?.addEventListener('abort', () => preparation.abort(), { once: true });
  if (signal?.aborted) { preparation.abort(); throw new DOMException('Aborted', 'AbortError'); }
  return { session, preparation };
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

/** An error whose message is already written for a shopper, in their
 *  language: our own copy or a job's classified failure sentence. Anything
 *  else that is thrown (a network failure, a parse error, a route's
 *  technical text) must be shown as the generic message instead. */
export class ShopperMessageError extends Error {}

export async function pollTryOnJob(
  jobId: string,
  signedSession: string,
  fallbackError: string,
  signal?: AbortSignal,
  options: {
    timeoutMs?: number;
    /** Delay the first async status request, honoring the generation response. */
    initialDelayMs?: number;
    /** Each answer while the look is still queued or being made. */
    onProgress?: (data: TryOnJobApiResponse) => void;
  } = {},
): Promise<TryOnJobApiResponse> {
  const deadline = Date.now() + (options.timeoutMs ?? TRYON_POLL_TIMEOUT_MS);
  let requestCount = 0;
  if (options.initialDelayMs) {
    await wait(Math.min(Math.max(0, options.initialDelayMs), Math.max(0, deadline - Date.now())), signal);
  }

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
      throw new ShopperMessageError(data.message || fallbackError);
    }
    if (data.status === 'failed') {
      throw new ShopperMessageError(data.message || fallbackError);
    }
    if (data.status === 'completed') {
      if (!data.resultImageUrl) {
        throw new ShopperMessageError(data.message || fallbackError);
      }
      return data;
    }
    if (data.status !== 'queued' && data.status !== 'processing') {
      throw new ShopperMessageError(fallbackError);
    }
    options.onProgress?.(data);

    const remaining = Math.max(0, deadline - Date.now());
    const serverDelay = retryAfterDelayMs(response.headers.get('Retry-After')) ?? 0;
    await wait(Math.min(remaining, Math.max(tryOnPollDelayMs(requestCount), serverDelay)), signal);
  }

  throw new ShopperMessageError(fallbackError);
}

/* ─── Taking the look off our server (phase zero item 2) ─── */

const LOCAL_RESULT_MAX_BYTES = 12 * 1024 * 1024;

const LOCAL_RESULT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function bytesToDataUrl(bytes: Uint8Array, type: string): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return `data:${type};base64,${window.btoa(binary)}`;
}

/** Our own static file (the demo's mock look), not a look stored for a
 *  shopper: it stays as it is. */
function isOwnStaticFile(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** The look as something this page holds. A data URL already is, and so is
 *  one of our own static files; a signed storage link is read once now.
 *  Null when it cannot be read here. */
async function readLookIntoPage(url: string, signal?: AbortSignal): Promise<string | null> {
  if (url.startsWith('data:') || isOwnStaticFile(url)) return url;
  try {
    const response = await fetch(url, { cache: 'no-store', signal });
    if (!response.ok) return null;
    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!LOCAL_RESULT_TYPES.has(type)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > LOCAL_RESULT_MAX_BYTES) return null;
    return bytesToDataUrl(bytes, type);
  } catch (error) {
    if (isAbort(error)) throw error;
    return null;
  }
}

/** Tells the server this page holds the look, so it deletes its copies now.
 *  Best effort: if it never arrives, they still expire with the session. */
export function releaseTryOnResult(jobId: string, signedSession: string): void {
  try {
    void fetch(`/api/try-on/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${signedSession}` },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // A browser without fetch keepalive still has the expiry.
  }
}

/**
 * Keeps the look in this page and lets the server delete its copy. Returns
 * the image to show: the page's own copy, or the original link when the
 * look could not be read here, in which case the server copy is left to
 * expire so the link keeps working.
 */
export async function keepTryOnResultInPage(
  jobId: string,
  signedSession: string,
  resultImageUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const local = await readLookIntoPage(resultImageUrl, signal);
  if (!local) return resultImageUrl;
  releaseTryOnResult(jobId, signedSession);
  return local;
}

/* ─── The public demo, end to end ─── */

/** Why a public try-on did not produce a look, in terms the page can localise. */
export type PublicTryOnFailure =
  | { kind: TryOnFailureKind }
  /** The service is not configured here (503), or credits ran out. */
  | { kind: 'unavailable' }
  /** Too many requests: wait before trying again. */
  | { kind: 'rate_limited'; retryAfterMs: number }
  /** Today's free demo looks are used, for this visitor or for everyone. */
  | { kind: 'demo_limit' }
  /** The bot check did not finish or was refused; a fresh one may pass. */
  | { kind: 'challenge' };

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
  onProgress,
  prepared,
}: {
  productId: string;
  photoDataUrl: string;
  signal?: AbortSignal;
  onProgress?: (data: TryOnJobApiResponse) => void;
  prepared?: PublicLookPreparation;
}): Promise<PublicTryOnResult> {
  try {
    const usable = prepared?.session.productId === productId && Date.parse(prepared.session.expiresAt) > Date.now() + 5000;
    if (prepared && !usable) prepared.preparation.abort();
    const { session, preparation } = usable ? prepared : await preparePublicLook(productId, signal);
    let look;
    try {
      look = await preparation.take(signal);
    } catch (error) {
      if (isAbort(error)) throw error;
      if (!(error instanceof TurnstileChallengeError) && error instanceof TryOnStop) throw error;
      throw new TryOnStop(error instanceof TurnstileChallengeError ? { kind: 'challenge' } : { kind: 'unavailable' });
    }

    const uploadStartedAt = performance.now();
    const generateRes = await fetchWithOneRetry('/api/try-on/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        attemptId: look.attempt.attemptId,
        productId,
        photoSource: 'upload',
        photoReference: 'uploaded-photo',
        photoData: photoDataUrl,
        turnstileToken: look.token,
        clientTimings: look.timings,
      }),
      signal,
    });
    let job = await readJson<TryOnJobApiResponse>(generateRes);
    if (job?.ok && job.jobId) reportClientLookTimings(job.jobId, session.sessionId, { ...look.timings, upload_ms: performance.now() - uploadStartedAt });
    // Fetch exposes submission-to-acknowledgment, including server validation
    // and reservation. A synchronous fallback also includes generation, so
    // omit its split measurements rather than mislabel provider time as upload.
    if (generateRes.status === 202) recordTryOnPhase('upload', performance.now() - uploadStartedAt);
    const waitStartedAt = performance.now();
    if (!job) throw stopFor(generateRes);
    if (job.code === 'demo_limit') throw new TryOnStop({ kind: 'demo_limit' });
    if (job.code === 'turnstile_failed' || job.code === 'turnstile_required') throw new TryOnStop({ kind: 'challenge' });
    // A capped day of the owner's test looks (N5) reads the same: try-on is
    // not available right now.
    if (job.code === 'TRYON_UNAVAILABLE' || job.code === 'test_looks_cap') throw new TryOnStop({ kind: 'unavailable' });
    if (!generateRes.ok && job.code !== 'TRYON_FINALIZATION_PENDING') throw stopFor(generateRes, job.message || job.error);

    if (
      job.jobId &&
      ((job.ok && (job.status === 'queued' || job.status === 'processing')) ||
        job.code === 'TRYON_FINALIZATION_PENDING')
    ) {
      onProgress?.(job);
      job = await pollTryOnJob(job.jobId, session.sessionId, 'failed', signal,
        generateRes.status === 202 ? {
          timeoutMs: TRYON_ASYNC_POLL_TIMEOUT_MS,
          initialDelayMs: Math.max(TRYON_POLL_INITIAL_DELAY_MS, retryAfterDelayMs(generateRes.headers.get('Retry-After')) ?? 0),
          onProgress,
        } : { onProgress });
    }

    if (!job.ok || job.status !== 'completed' || !job.resultImageUrl || !job.jobId) {
      throw new TryOnStop({ kind: classifyTryOnFailure(job.message || job.error || '') });
    }
    const resultImageUrl = await keepTryOnResultInPage(job.jobId, session.sessionId, job.resultImageUrl, signal);
    if (generateRes.status === 202) recordTryOnPhase('wait_to_result', performance.now() - waitStartedAt);
    return { ok: true, jobId: job.jobId, resultImageUrl };
  } catch (error) {
    if (isAbort(error)) throw error;
    if (error instanceof TryOnStop) return { ok: false, failure: error.failure };
    return { ok: false, failure: { kind: classifyTryOnFailure(error) } };
  }
}
