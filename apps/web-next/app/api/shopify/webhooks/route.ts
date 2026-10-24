import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { processShopifyPrivacyRequest } from '@/lib/shopify/privacy';
import { resolveShopifyApp } from '@/lib/shopify/app-registry';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { recordInstallationEvent } from '@/lib/shopify/installation-events';

export async function POST(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: 'Missing body' }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) { await reader.cancel(); return NextResponse.json({ error: 'Payload too large' }, { status: 413 }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = Buffer.concat(chunks, bytes).toString('utf8');
  const hmac = request.headers.get('x-shopify-hmac-sha256') ?? '';
  const resolved = hmac ? resolveShopifyApp((secret) => {
    const expected = createHmac('sha256', secret).update(body).digest('base64');
    const a = Buffer.from(hmac), b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }) : null;
  if (!resolved) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shop = normalizeShopDomain(request.headers.get('x-shopify-shop-domain'));
  const topic = request.headers.get('x-shopify-topic');
  const webhookId = request.headers.get('x-shopify-webhook-id');
  if (!shop || !topic || !webhookId) return NextResponse.json({ error: 'Missing event identity' }, { status: 400 });
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid');
    const claimed = topic === 'app/uninstalled' ? payload.myshopify_domain : payload.shop_domain;
    const privacy = ['customers/data_request','customers/redact','shop/redact'].includes(topic);
    if ((topic === 'app/uninstalled' || privacy) && claimed !== shop) throw new Error('wrong shop');
    if (claimed !== undefined && claimed !== shop) throw new Error('wrong shop');
  } catch { return NextResponse.json({ error: 'Invalid event payload' }, { status: 400 }); }
  const event = { appClientId: resolved.app.clientId, shopDomain: shop, webhookId,
    payload, triggeredAt: request.headers.get('x-shopify-triggered-at') };
  try {
    if (topic === 'customers/data_request' || topic === 'customers/redact' || topic === 'shop/redact') {
      await processShopifyPrivacyRequest({ ...event, topic });
    } else {
      await recordInstallationEvent({ ...event, topic });
    }
    return NextResponse.json({ ok: true });
  } catch {
    console.error('[shopify] installation event requires retry', { topic });
    return NextResponse.json({ error: 'Event processing unavailable' }, {
      status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' },
    });
  }
}
