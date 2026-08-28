import { NextRequest, NextResponse } from 'next/server';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import { loadPublicSite, loadPublicSiteByDomain, originAllowed } from '@/lib/messenger/public-api';
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
  const origin = typeof body.origin === 'string' ? body.origin : null;
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
    if (!site || !originAllowed(site, origin)) return NextResponse.json({ ok: false }, { status: 403 });

    await recordEvent({
      siteId: site.id,
      conversationId,
      eventName: name,
      payload: {},
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[messenger] event failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 200 }); // never block storefront on telemetry
  }
}
