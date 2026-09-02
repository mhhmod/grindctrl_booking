import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupExpiredTryOnResults,
  sweepOrphanedTryOnResults,
  TRYON_CLEANUP_BATCH_LIMIT,
  TRYON_ORPHAN_SWEEP_LIMIT,
} from '@/lib/try-on/persistence';

export const runtime = 'nodejs';

function hasValidCleanupSecret(request: NextRequest): boolean {
  const expected = process.env.TRYON_CLEANUP_SECRET;
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '');
  const provided = match?.[1];
  if (!expected || expected.length < 32 || !provided) return false;

  const expectedBytes = Buffer.from(expected, 'utf8');
  const providedBytes = Buffer.from(provided, 'utf8');
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

export async function POST(request: NextRequest) {
  if (!hasValidCleanupSecret(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const correlationId = randomUUID();
  const expiredPromise = cleanupExpiredTryOnResults(TRYON_CLEANUP_BATCH_LIMIT);
  const orphanPromise = sweepOrphanedTryOnResults(TRYON_ORPHAN_SWEEP_LIMIT);
  const [expiredResult, orphanResult] = await Promise.allSettled([
    expiredPromise,
    orphanPromise,
  ]);
  const failedOperations = Number(expiredResult.status === 'rejected') +
    Number(orphanResult.status === 'rejected');

  const summary = {
    expired: expiredResult.status === 'fulfilled' ? expiredResult.value : null,
    orphans: orphanResult.status === 'fulfilled' ? orphanResult.value : null,
    failedOperations,
  };

  if (failedOperations > 0) {
    console.error('[try-on-cleanup] failed', { correlationId, ...summary });
    return NextResponse.json(
      {
        ok: false,
        correlationId,
        error: 'Try-on cleanup did not complete.',
        data: summary,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  console.info('[try-on-cleanup] completed', { correlationId, ...summary });
  return NextResponse.json(
    { ok: true, correlationId, data: summary },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
