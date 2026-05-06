import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/try-on/service';
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
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  if (!jobId) {
    const res: TryOnJobApiResponse = {
      ok: false,
      message: 'Job ID is required.',
      error: 'Job ID is required.',
    };
    return NextResponse.json(res, { status: 400 });
  }

  const job = getJob(jobId);

  if (!job) {
    const res: TryOnJobApiResponse = {
      ok: false,
      message: 'Job not found.',
      error: 'Job not found.',
    };
    return NextResponse.json(res, { status: 404 });
  }

  const res = toJobResponse(job);
  return NextResponse.json(res, { status: 200 });
}
