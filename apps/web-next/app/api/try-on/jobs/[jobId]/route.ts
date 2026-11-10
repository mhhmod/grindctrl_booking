import { resolveAnyTryOnSessionKey } from '@/lib/try-on/signing-keys';
import { NextRequest, NextResponse } from 'next/server';
import { forgetJob, getJob } from '@/lib/try-on/service';
import { clientIp, tryOnPollRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import { verifyTryOnSession } from '@/lib/try-on/storefront-context';
import { persistJobTimings, validClientTimings } from '@/lib/try-on/job-timings';
import { readLimitedJson, isJsonObject } from '@/lib/http/read-limited-body';
import {
  loadAuthorizedDurableTryOnJob,
  releaseDurableTryOnResult,
} from '@/lib/try-on/persistence';
import {
  TryOnResultPersistenceError,
  TryOnResultSchemaNotReadyError,
  TryOnResultUnavailableError,
} from '@/lib/try-on/result-errors';
import type {
  TryOnJob,
  TryOnJobApiResponse,
} from '@/lib/try-on/types';

function toJobResponse(job: TryOnJob): TryOnJobApiResponse {
  return {
    ok: true,
    jobId: job.jobId,
    status: job.status,
    resultImageUrl: job.resultImageUrl,
    productId: job.productId,
    message: job.message,
    meta: job.meta,
    ...(job.stage ? { stage: job.stage } : {}),
  };
}

/** Diagnostic acknowledgment only. Reuse GET's rate limit and exact
 * session/product/tenant authorization before accepting any write. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const authorized = await GET(request, context);
  if (!authorized.ok) return authorized;
  const body = await readLimitedJson(request, 1024);
  if (!body.ok) return NextResponse.json({ ok: false }, { status: body.status });
  const timings = validClientTimings(isJsonObject(body.value) ? body.value.clientTimings : undefined);
  if (timings) {
    const data = await authorized.json() as TryOnJobApiResponse;
    const token = (request.headers.get('authorization') ?? '').replace(/^bearer\s+/i, '');
    const resolved = await resolveAnyTryOnSessionKey(token, (secret) => verifyTryOnSession(secret, token));
    if (!resolved) return NextResponse.json({ ok: false }, { status: 401 });
    const { sessionId, productId, shop } = resolved.value;
    await persistJobTimings({ jobId: data.jobId!, sessionId, productId, shop }, { client: timings });
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * GET /api/try-on/jobs/[jobId]
 * Polls the status of a try-on generation job.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireRateLimit(tryOnPollRatelimit, clientIp(request) ?? 'unknown');
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  const { jobId } = await params;

  if (!jobId) {
    const res: TryOnJobApiResponse = {
      ok: false,
      message: 'Job ID is required.',
      error: 'Job ID is required.',
    };
    return NextResponse.json(res, { status: 400 });
  }

  const authorizationHeader = request.headers.get('authorization') ?? '';
  const token = authorizationHeader.replace(/^bearer\s+/i, '');
  const session = token
    ? (await resolveAnyTryOnSessionKey(token, (secret) => verifyTryOnSession(secret, token)))?.value
    : null;
  if (!session) {
    return NextResponse.json(
      { ok: false, message: 'Invalid or expired try-on session.', error: 'Invalid or expired try-on session.' },
      { status: 401 },
    );
  }

  let job = getJob(jobId);
  if (!job) {
    try {
      job = (await loadAuthorizedDurableTryOnJob(session, jobId)) ?? undefined;
    } catch (error) {
      if (
        error instanceof TryOnResultUnavailableError ||
        error instanceof TryOnResultSchemaNotReadyError ||
        error instanceof TryOnResultPersistenceError
      ) {
        const status = error instanceof TryOnResultUnavailableError ? 409 : 503;
        // error.message here is internal ops language ("storage is not
        // ready"), never the shopper's to see -- same safe copy used in
        // app/api/try-on/generate/route.ts for the identical error classes.
        const safeMessage =
          error instanceof TryOnResultUnavailableError
            ? 'Your try-on result is no longer available. Please try again.'
            : 'Unable to save your try-on result right now. Please try again.';
        return NextResponse.json(
          {
            ok: false,
            code: error.code,
            jobId: error.jobId,
            message: safeMessage,
            error: safeMessage,
          } satisfies TryOnJobApiResponse,
          { status },
        );
      }
      throw error;
    }
  }

  if (!job) {
    const res: TryOnJobApiResponse = {
      ok: false,
      message: 'Job not found.',
      error: 'Job not found.',
    };
    return NextResponse.json(res, { status: 404 });
  }

  if (
    job.sessionId !== session.sessionId ||
    job.productId !== session.productId ||
    job.shop !== session.shop
  ) {
    // A valid capability for another session must not confirm whether this
    // job exists or expose its result image.
    const res: TryOnJobApiResponse = {
      ok: false,
      message: 'Job not found.',
      error: 'Job not found.',
    };
    return NextResponse.json(res, { status: 404 });
  }

  if (job.status === 'completed' && !job.resultImageUrl) {
    // This is a reconciliation signal, not permission to generate again.
    // Never log the signed session or customer/result image material.
    console.error('[try-on] reconciliation_required', {
      reason: 'completed_result_missing',
      jobId: job.jobId,
    });
    const message = 'Your try-on result is no longer available. Please try again.';
    return NextResponse.json(
      {
        ok: false,
        code: 'TRYON_RESULT_UNAVAILABLE',
        jobId: job.jobId,
        message,
        error: message,
      } satisfies TryOnJobApiResponse,
      { status: 409 },
    );
  }

  const res = toJobResponse(job);
  return NextResponse.json(res, { status: 200 });
}

/**
 * DELETE /api/try-on/jobs/[jobId]
 * The shopper's browser holds the look, so the server's copies go now
 * instead of waiting for their expiry (phase zero item 2). Only a job of
 * this exact session is touched. Every authorized call answers 204, whether
 * or not there was anything to delete, so the answer never confirms
 * another session's job.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireRateLimit(tryOnPollRatelimit, clientIp(request) ?? 'unknown');
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  const { jobId } = await params;
  const authorizationHeader = request.headers.get('authorization') ?? '';
  const token = authorizationHeader.replace(/^bearer\s+/i, '');
  const session = token
    ? (await resolveAnyTryOnSessionKey(token, (secret) => verifyTryOnSession(secret, token)))?.value
    : null;
  if (!session) {
    return NextResponse.json(
      { ok: false, message: 'Invalid or expired try-on session.', error: 'Invalid or expired try-on session.' },
      { status: 401 },
    );
  }
  if (!jobId) return new NextResponse(null, { status: 204 });

  const job = getJob(jobId);
  if (
    job &&
    job.sessionId === session.sessionId &&
    job.productId === session.productId &&
    job.shop === session.shop
  ) {
    forgetJob(jobId);
  }

  try {
    await releaseDurableTryOnResult(session, jobId);
  } catch (error) {
    if (
      error instanceof TryOnResultSchemaNotReadyError ||
      error instanceof TryOnResultPersistenceError
    ) {
      // The scheduled cleanup still deletes it at its expiry.
      console.error('[try-on] result_release_failed', { jobId });
      return NextResponse.json(
        { ok: false, message: 'Try again later.', error: 'Try again later.' },
        { status: 503 },
      );
    }
    throw error;
  }
  return new NextResponse(null, { status: 204 });
}
