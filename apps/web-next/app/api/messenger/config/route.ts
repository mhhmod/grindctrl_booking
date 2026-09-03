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
  const shopParam = request.nextUrl.searchParams.get('shop');
  /* The browser sets Origin on a cross-origin request and page script cannot
     forge it; the ?origin= query param is chosen by whoever made the call and
     proves nothing. The widget always runs on the storefront and calls this
     app, so the header is present on every real request. Prefer it, and keep
     the param only as a hint for the pattern check below — never as the basis
     for the implied own-domain allowance. */
  const headerOrigin = request.headers.get('origin');
  const claimedOrigin = request.nextUrl.searchParams.get('origin');
  const origin = headerOrigin ?? claimedOrigin;

  if (shopParam && !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopParam)) {
    return NextResponse.json({ error: 'bad_shop' }, { status: 400 });
  }

  if (!shopParam && !/^[a-z0-9_]{6,80}$/i.test(key)) {
    return NextResponse.json({ error: 'bad_key' }, { status: 400 });
  }

  try {
    const site = shopParam
      ? await loadPublicSiteByDomain(shopParam)
      : await loadPublicSite(key);
    if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    if (!originAllowed(site, origin, { trusted: headerOrigin !== null })) {
      // Do not reveal whether the key exists on foreign origins.
      return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
    }

    const payload = toPublicPayload(site, new Date());
    void recordEvent({ siteId: site.id, eventName: 'config_served', payload: { v: payload.v } }).catch(() => {});

    /* The widget fetches this from the merchant's storefront, so the response
       is cross-origin and the browser discards it unless it says so — status
       200 is not enough. Without this the loader's fetch rejected, fell back
       to a localStorage config that does not exist on a first visit, and
       returned before building the launcher: the block was installed and
       correctly configured, and the storefront showed nothing, silently.

       Echo the specific caller rather than "*": that is what originAllowed
       just approved, and it keeps the response scoped to that store. Vary is
       not optional here — this response is `public` and cacheable, so without
       it a shared cache could hand one store's response, and its
       Access-Control-Allow-Origin, to another. */
    const cors: Record<string, string> = headerOrigin
      ? { 'Access-Control-Allow-Origin': headerOrigin }
      : {};

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        Vary: 'Origin',
        ...cors,
      },
    });
  } catch (error) {
    console.error('[messenger] config failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
