import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/try-on/service';
import { clientIp, rateLimitedResponse, tryOnPollRatelimit } from '@/lib/ratelimit';
import { verifyTryOnSession } from '@/lib/try-on/storefront-context';
import { loadAuthorizedDurableTryOnJob } from '@/lib/try-on/persistence';
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
  };
}

/**
 * GET /api/try-on/jobs/[jobId]
 * Polls the status of a try-on generation job.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const limit = await tryOnPollRatelimit.limit(clientIp(request) ?? 'unknown');
  if (!limit.success) return rateLimitedResponse(limit.reset);

  const { jobId } = await params;

  if (!jobId) {
    const res: TryOnJobApiResponse = {
      ok: false,
      message: 'Job ID is required.',
      error: 'Job ID is required.',
    };
    return NextResponse.json(res, { status: 400 });
  }

  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: 'Try-on is not configured.', error: 'Try-on is not configured.' },
      { status: 503 },
    );
  }

  const authorizationHeader = request.headers.get('authorization') ?? '';
  const token = authorizationHeader.replace(/^bearer\s+/i, '');
  const session = token ? verifyTryOnSession(secret, token) : null;
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
        return NextResponse.json(
          {
            ok: false,
            code: error.code,
            jobId: error.jobId,
            message: error.message,
            error: error.message,
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
    const message = 'A completed try-on result needs reconciliation.';
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
