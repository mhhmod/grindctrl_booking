import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/try-on/service';
import type { TryOnApiResponse, TryOnJob } from '@/lib/try-on/types';

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
    const res: TryOnApiResponse = { ok: false, error: 'Job ID is required.' };
    return NextResponse.json(res, { status: 400 });
  }

  const job = getJob(jobId);

  if (!job) {
    const res: TryOnApiResponse = { ok: false, error: 'Job not found.' };
    return NextResponse.json(res, { status: 404 });
  }

  const res: TryOnApiResponse<TryOnJob> = { ok: true, data: job };
  return NextResponse.json(res, { status: 200 });
}
