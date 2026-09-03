import { NextRequest, NextResponse } from 'next/server';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import {
  loadPublicSite,
  loadPublicSiteByDomain,
  originAllowed,
  provenOrigin,
} from '@/lib/messenger/public-api';
import { recordEvent } from '@/lib/messenger/conversations';

/* POST /api/messenger/event
   Storefront telemetry. Strict name allowlist so this cannot become a
   free-form write endpoint; payloads are small and content-free except
   where explicitly designed (e.g., page path for targeting analytics). */

const ALLOWED_EVENTS = new Set([
  'loader_initialized',
  'messenger_opened',
  'greeting_shown',
  'greeting_dismissed',
  'proactive_shown',
  'proactive_dismissed',
  'send_failed',
  'config_fetch_failed',
  'conversation_feedback',
]);

/* Same cross-origin story as /config: the loader posts this from the
   storefront. A JSON POST is not a "simple" request, so the browser sends a
   preflight first and drops the real call if it is not answered. Telemetry
   failing is not fatal, but it fails loudly in the console on every page view
   and buries anything worth reading. */
function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  return { Vary: 'Origin', ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}) };
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: {
      Vary: 'Origin',
      ...(origin
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'content-type',
            'Access-Control-Max-Age': '86400',
          }
        : {}),
    },
  });
}

export async function POST(request: NextRequest) {
  const limit = await publicApiRatelimit.limit(`me:${clientIp(request) ?? 'unknown'}`);
  if (!limit.success) return NextResponse.json({ ok: false }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key : '';
  const shop = typeof body.shop === 'string' ? body.shop : null;
  /* Both callers land here: the loader, which runs on the storefront and so
     is cross-origin (real Origin header, no token), and the panel, which is
     same-origin and carries the token instead. */
  const { origin, trusted: originTrusted } = provenOrigin(key, {
    headerOrigin: request.headers.get('origin'),
    origin: body.origin,
    originToken: body.originToken,
  });
  const name = typeof body.name === 'string' ? body.name : '';
  const conversationId =
    typeof body.conversationId === 'string' && /^[0-9a-f-]{36}$/i.test(body.conversationId)
      ? body.conversationId
      : null;

  if ((!/^[a-z0-9_]{6,80}$/i.test(key) && !shop) || !ALLOWED_EVENTS.has(name)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const site = shop
      ? /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)
        ? await loadPublicSiteByDomain(shop)
        : null
      : await loadPublicSite(key);
    if (!site || !originAllowed(site, origin, { trusted: originTrusted })) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    await recordEvent({
      siteId: site.id,
      conversationId,
      eventName: name,
      payload: {},
    });
    return NextResponse.json({ ok: true }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('[messenger] event failed:', error instanceof Error ? error.message : error);
    // Never block a storefront on telemetry.
    return NextResponse.json({ ok: false }, { status: 200, headers: corsHeaders(request) });
  }
}
