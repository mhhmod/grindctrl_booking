import { NextRequest, NextResponse } from 'next/server';
import {
  loadPublicSite,
  loadPublicSiteByDomain,
  originAllowed,
  toPublicPayload,
} from '@/lib/messenger/public-api';
import { recordEvent } from '@/lib/messenger/conversations';

/* GET /api/messenger/config?key=<embed_key>&origin=<page origin>
   Public, cacheable, fail-quiet: the loader keeps its last-known-good copy
   in localStorage, and an unreachable dashboard must never break a store. */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? '';
  const origin = request.nextUrl.searchParams.get('origin');

  if (!/^[a-z0-9_]{6,80}$/i.test(key)) {
    return NextResponse.json({ error: 'bad_key' }, { status: 400 });
  }

  try {
    const shopParam = request.nextUrl.searchParams.get('shop');
    const site = shopParam
      ? /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopParam)
        ? await loadPublicSiteByDomain(shopParam)
        : null
      : await loadPublicSite(key);
    if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    if (!originAllowed(site, origin)) {
      // Do not reveal whether the key exists on foreign origins.
      return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
    }

    const payload = toPublicPayload(site, new Date());
    void recordEvent({ siteId: site.id, eventName: 'config_served', payload: { v: payload.v } }).catch(() => {});

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[messenger] config failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
