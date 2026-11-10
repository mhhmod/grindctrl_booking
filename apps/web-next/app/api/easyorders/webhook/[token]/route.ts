import { timingSafeEqual } from 'node:crypto';
import { decryptToken } from '@/lib/shopify/token-crypto';
import { connectionByWebhookToken, easyOrdersRpc, WEBHOOK_TOKEN } from '@/lib/easyorders/store';
import { boundedJson, json } from '@/lib/easyorders/http';
import {
  claimWindow, DEDUPE_WINDOW_SECONDS, deliveryKey, releaseWindow, TOUCH_WINDOW_SECONDS, touchKey,
} from '@/lib/easyorders/webhook-guard';
import { clientIp, easyOrdersWebhookConnectionRatelimit, easyOrdersWebhookIpRatelimit } from '@/lib/ratelimit';
import { rateLimitErrorResponse, requireRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENTS = new Set(['order-created', 'order-status-update']);
type Delivery = { event: string; orderId: string | null; newStatus: string; changed: boolean };
const idOf = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) ? String(v)
  : typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v) ? v : null;
const statusOf = (v: unknown) => typeof v === 'string' && v.length <= 80 ? v : '';

/** Our two registered URLs carry `event`; the body's event_type is the fallback.
 *  Only a status update that moves the status invalidates cached orders. */
function deliveryOf(queryEvent: string | null, body: Record<string, unknown>): Delivery {
  const event = queryEvent && EVENTS.has(queryEvent) ? queryEvent
    : typeof body.event_type === 'string' && EVENTS.has(body.event_type) ? body.event_type : 'unknown';
  if (event === 'order-status-update') {
    const newStatus = statusOf(body.new_status);
    return { event, orderId: idOf(body.order_id) ?? idOf(body.id), newStatus,
      changed: newStatus !== '' && newStatus !== statusOf(body.old_status) };
  }
  return { event, orderId: idOf(body.id) ?? idOf(body.order_id), newStatus: statusOf(body.status), changed: false };
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  // Malformed tokens cost nothing: no limiter call, no database read.
  if (!WEBHOOK_TOKEN.test(token)) return json({ ok: false, error: 'unauthorized' }, 401);
  try {
    // Admission before the token lookup. Fails closed without Redis.
    await requireRateLimit(easyOrdersWebhookIpRatelimit, `ip:${clientIp(request) ?? 'unknown'}`);
    const c = await connectionByWebhookToken(token);
    if (!c) return json({ ok: false, error: 'unauthorized' }, 401);
    const supplied = request.headers.get('secret');
    if (supplied !== null && c.webhook_secret) {
      const expected = Buffer.from(decryptToken(c.webhook_secret), 'utf8');
      const actual = Buffer.from(supplied, 'utf8');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return json({ ok: false, error: 'unauthorized' }, 401);
    }
    await requireRateLimit(easyOrdersWebhookConnectionRatelimit, c.widget_site_id);
    let body: unknown;
    try { body = await boundedJson(request, 256_000); } catch { return json({ ok: false, error: 'invalid_request' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'invalid_request' }, 400);
    // Never log/store the body, order id, contact, address or payment ref.
    const d = deliveryOf(new URL(request.url).searchParams.get('event'), body as Record<string, unknown>);
    const dedupe = d.orderId ? deliveryKey(c.widget_site_id, d.orderId, d.event, d.newStatus) : null;
    if (dedupe && !(await claimWindow(dedupe, DEDUPE_WINDOW_SECONDS))) return json({ ok: true });
    const touch = touchKey(c.widget_site_id);
    let touched = false;
    try {
      touched = await claimWindow(touch, TOUCH_WINDOW_SECONDS);
      if (!d.changed && !touched) return json({ ok: true });
      const recorded = await easyOrdersRpc('record_easyorders_webhook', { p_site: c.widget_site_id, p_token: token, p_changed: d.changed });
      return recorded === true ? json({ ok: true }) : json({ ok: false, error: 'unauthorized' }, 401);
    } catch (error) {
      // Not recorded: let EasyOrders' redelivery through instead of deduping it.
      await Promise.all([dedupe ? releaseWindow(dedupe) : null, touched ? releaseWindow(touch) : null]);
      throw error;
    }
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    return json({ ok: false, error: 'unavailable' }, 503);
  }
}
