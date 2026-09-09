import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { markTryOnShopUninstalled, recordTryOnShopSeen } from '@/lib/shopify/shops';
import { deleteShopToken } from '@/lib/shopify/tokens';
import { processShopifyPrivacyRequest } from '@/lib/shopify/privacy';

/* Shopify lifecycle receiver and durable mandatory privacy processing.
   Settings survive lifecycle events; privacy requests use the gated processor. */
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

  if (topic === 'customers/data_request' || topic === 'customers/redact' || topic === 'shop/redact') {
    const webhookId = request.headers.get('x-shopify-webhook-id');
    if (!webhookId?.trim() || !shop?.trim()) {
      return NextResponse.json({ error: 'Missing privacy request headers' }, { status: 400 });
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid payload');
    } catch {
      return NextResponse.json({ error: 'Invalid privacy request payload' }, { status: 400 });
    }
    try {
      await processShopifyPrivacyRequest({ webhookId, topic, shopDomain: shop, payload });
      return NextResponse.json({ ok: true });
    } catch {
      // The processor rejects only before durable recording succeeds.
      console.error('[shopify] privacy webhook recording unavailable', { topic });
      return NextResponse.json(
        { error: 'Privacy request recording unavailable' },
        { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } },
      );
    }
  }

  if (topic === 'app/uninstalled') {
    recorded = await markTryOnShopUninstalled(shop);
    // A token we can no longer use is a credential we should no longer
    // hold. Do not acknowledge a failed cleanup: Shopify must retry.
    // Deleting an already-absent token is an idempotent success.
    const tokenDeleted = await deleteShopToken(String(shop ?? ''));
    recorded = recorded && tokenDeleted;
  } else if (topic === 'app/scopes_update') {
    recorded = await recordTryOnShopSeen(shop);
  }

  if (!recorded) {
    return NextResponse.json({ error: 'Shop lifecycle update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
