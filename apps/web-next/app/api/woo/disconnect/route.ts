import { NextRequest, NextResponse } from 'next/server';
import { readLimitedText } from '@/lib/http/read-limited-body';
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
// A removed plugin gives the merchant two days to change their mind (and to
// reinstall) before the site's shopper data is redacted.
const REDACT_GRACE_MS = 48 * 60 * 60 * 1000;

/** 0.2.0 plugins send no reason, and an unknown or unparsable body is also a
 * plain disconnect: only an explicit 'uninstall' schedules redaction. */
function disconnectReason(rawBody: string): 'uninstall' | 'deactivate' | 'manual' {
  try {
    const reason = (JSON.parse(rawBody) as { reason?: unknown } | null)?.reason;
    return reason === 'uninstall' || reason === 'deactivate' ? reason : 'manual';
  } catch {
    return 'manual';
  }
}

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
  const read = await readLimitedText(request, MAX_BODY_BYTES);
  if (!read.ok) return json({ error: 'invalid_request' }, read.status);
  const rawBody = read.text;

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
    // Set once and never extended by a repeat. Not tied to status: a site
    // deactivated earlier and uninstalled later is already disconnected.
    const redaction = disconnectReason(rawBody) === 'uninstall'
      ? await supabase
        .from('woo_site_connections')
        .update({ redact_after: new Date(Date.now() + REDACT_GRACE_MS).toISOString() })
        .eq('widget_site_id', verified.siteId)
        .eq('status', 'disconnected')
        .is('redact_after', null)
      : { error: null };
    if (connection.error || tenant.error || redaction.error) {
      console.error('[woo] disconnect failed', { code: 'unavailable', siteId: verified.siteId });
      return json({ error: 'unavailable' }, 503);
    }
  } catch {
    console.error('[woo] disconnect failed', { code: 'unavailable', siteId: verified.siteId });
    return json({ error: 'unavailable' }, 503);
  }

  return json({ ok: true });
}
