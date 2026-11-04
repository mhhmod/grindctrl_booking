import { NextRequest, NextResponse } from 'next/server';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import {
  verifyWooSignedRequest,
  wooSignedRequestErrorResponse,
  type WooSignedRequestFailure,
} from '@/lib/woo/signed-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4 * 1024;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function reject(failure: WooSignedRequestFailure) {
  console.warn('[woo] disconnect rejected', { code: failure.code, siteId: failure.siteId });
  return wooSignedRequestErrorResponse(failure);
}

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: 'invalid_request' }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return json({ error: 'invalid_request' }, 413);
  }

  // A repeated disconnect must remain a successful no-op. It still needs a
  // valid MAC and a fresh nonce, but this route is the one deliberate
  // exception that may authenticate an already-disconnected connection.
  const verified = await verifyWooSignedRequest(request, rawBody, { allowDisconnected: true });
  if (!verified.ok) return reject(verified);

  const nowIso = new Date().toISOString();
  try {
    const supabase = getMessengerServiceClient();
    const connection = await supabase
      .from('woo_site_connections')
      .update({ status: 'disconnected', disconnected_at: nowIso })
      .eq('widget_site_id', verified.siteId)
      .eq('status', 'active');
    // The tenant row is the registry the credit and try-on SQL checks read, so
    // it follows the connection. Both writes are guarded no-ops on a repeat.
    const tenant = await supabase
      .from('tryon_shops')
      .update({ status: 'uninstalled', uninstalled_at: nowIso, updated_at: nowIso })
      .eq('shop_domain', siteTenantKey(verified.siteId))
      .eq('status', 'installed');
    if (connection.error || tenant.error) {
      console.error('[woo] disconnect failed', { code: 'unavailable', siteId: verified.siteId });
      return json({ error: 'unavailable' }, 503);
    }
  } catch {
    console.error('[woo] disconnect failed', { code: 'unavailable', siteId: verified.siteId });
    return json({ error: 'unavailable' }, 503);
  }

  return json({ ok: true });
}
