import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

/* Mandatory Shopify webhooks receiver (app/uninstalled, scopes_update).
   Verifies the HMAC header and acknowledges; no state to clean up since
   sessions are token-based and settings should survive reinstalls. */
export async function POST(request: NextRequest) {
  const secret = process.env.SHOPIFY_API_SECRET;
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256') ?? '';
  const body = await request.text();

  if (!secret || !hmacHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const digest = createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
