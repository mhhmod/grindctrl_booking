import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { retryPendingAlerts } from '@/lib/messenger/alert-retry';

export const runtime = 'nodejs';

/* POST /api/internal/messenger/alerts
   Sends the handoff alerts that are due: retries of throttled or failed
   ones, and after-hours ones whose opening time has come (phase zero items
   6 and 7). Called by .github/workflows/messenger-alert-retry.yml. */

function hasValidSecret(request: NextRequest): boolean {
  const expected = process.env.MESSENGER_ALERTS_SECRET;
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '');
  const provided = match?.[1];
  if (!expected || expected.length < 32 || !provided) return false;
  const expectedBytes = Buffer.from(expected, 'utf8');
  const providedBytes = Buffer.from(provided, 'utf8');
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export async function POST(request: NextRequest) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const correlationId = randomUUID();
  try {
    const data = await retryPendingAlerts();
    console.info('[messenger-alerts] completed', { correlationId, ...data });
    return NextResponse.json({ ok: true, correlationId, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[messenger-alerts] failed', { correlationId, error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { ok: false, correlationId, error: 'Alert retry did not complete.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
