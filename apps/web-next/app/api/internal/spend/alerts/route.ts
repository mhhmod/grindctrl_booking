import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runSpendAlerts } from '@/lib/spend/alerts';

export const runtime = 'nodejs';

function hasValidSecret(request: NextRequest): boolean {
  const expected = process.env.SPEND_ALERTS_SECRET;
  const provided = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!expected || expected.length < 32 || !provided) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!hasValidSecret(request)) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401, headers });
  const correlationId = randomUUID();
  try {
    const data = await runSpendAlerts();
    console.info('[spend-alerts] completed', { correlationId, ...data });
    return NextResponse.json({ ok: true, correlationId, data }, { headers });
  } catch {
    console.error('[spend-alerts] failed', { correlationId });
    return NextResponse.json({ ok: false, correlationId, error: 'Spend check did not complete.' }, { status: 500, headers });
  }
}
