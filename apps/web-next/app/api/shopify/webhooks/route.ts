import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { markTryOnShopUninstalled, recordTryOnShopSeen } from '@/lib/shopify/shops';

/* Mandatory Shopify webhooks receiver (app/uninstalled, scopes_update).
   Settings survive reinstalls; only the shop lifecycle record changes. */
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

  const topic = request.headers.get('x-shopify-topic');
  const shop = request.headers.get('x-shopify-shop-domain');
  let recorded = true;

  if (topic === 'app/uninstalled') {
    recorded = await markTryOnShopUninstalled(shop);
  } else if (topic === 'app/scopes_update') {
    recorded = await recordTryOnShopSeen(shop);
  }

  if (!recorded) {
    return NextResponse.json({ error: 'Shop lifecycle update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
