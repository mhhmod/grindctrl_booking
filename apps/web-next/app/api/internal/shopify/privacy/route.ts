import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runPendingShopifyPrivacyRequests } from '@/lib/shopify/privacy';

export const runtime = 'nodejs';

function hasValidSecret(request: NextRequest): boolean {
  const expected = process.env.TRYON_CLEANUP_SECRET;
  const provided = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!expected || expected.length < 32 || !provided) return false;
  const a = Buffer.from(expected), b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The existing cleanup scheduler retries pending receipts and sends deadline
// reminders. Neither this endpoint nor an export email closes manual delivery.
export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!hasValidSecret(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401, headers });
  }
  try {
    const data = await runPendingShopifyPrivacyRequests({ limit: 25 });
    if (data.failed > 0) {
      console.error('[shopify-privacy] pending work failed', data);
      return NextResponse.json({ ok: false, data }, { status: 500, headers });
    }
    console.info('[shopify-privacy] pending work processed', data);
    return NextResponse.json({ ok: true, data }, { headers });
  } catch {
    // SMTP and database errors may include payloads; only log a fixed message.
    console.error('[shopify-privacy] pending work unavailable');
    return NextResponse.json({ ok: false, error: 'Privacy work did not complete.' }, { status: 500, headers });
  }
}
