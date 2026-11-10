import { NextRequest, NextResponse } from 'next/server';
import { clientIp, publicApiRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError, rateLimitErrorResponse } from '@/lib/request-rate-limit';
import {
  loadPublicSite,
  loadPublicSiteByDomain,
  originAllowed,
  toPublicPayload,
} from '@/lib/messenger/public-api';
import { recordEvent } from '@/lib/messenger/conversations';
import { flagStoreForSite, storeFlags } from '@/lib/flags/store-flags';
import { launchAudience, launchVisitorId } from '@/lib/launch/audience';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { verifyPreviewTokenAnyApp } from '@/lib/launch/preview-token';
import { resolveOrderProvider } from '@/lib/messenger/order-provider';
import { normalizeTenantKey } from '@/lib/tenancy/tenant-key';
import { isActiveTenant } from '@/lib/shopify/tokens';
import { recordPasteSignal } from '@/lib/paste/store';
import { schedulePasteDomainCheck } from '@/lib/paste/domain-check';
import type { ResolvedPublicSite } from '@/lib/messenger/public-api';

/** A paste domain this site added while another site held the host. */
function claimedPasteHost(site: ResolvedPublicSite, host: string): boolean {
  const name = host.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  return site.patterns.some((row) => row.verification_method === 'paste_dns_txt' && row.verification_status === 'pending'
    && row.pattern.replace(/^www\./, '') === name);
}

/* GET /api/messenger/config?key=<embed_key>&origin=<page origin>
   Public, cacheable, fail-quiet: the loader keeps its last-known-good copy
   in localStorage, and an unreachable dashboard must never break a store. */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `mconfig:${clientIp(request) ?? 'unknown'}`);
  } catch (error) {
    if (!(error instanceof RequestRateLimitError)) throw error;
    const response = rateLimitErrorResponse(error);
    const origin = request.headers.get('origin');
    // Only the generic availability response is exposed before site lookup;
    // successful config still requires the existing origin authorization.
    if (origin) response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Expose-Headers', 'Retry-After');
    return response;
  }

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
      // This site's own paste claim on a host another site holds: its code
      // may be live there now, so ask our server to look (rate limited; the
      // header only asks, the page decides).
      const host = headerOrigin && URL.canParse(headerOrigin) ? new URL(headerOrigin).hostname : null;
      if (host && site.status !== 'disabled' && claimedPasteHost(site, host)) schedulePasteDomainCheck(site.id, host);
      // Do not reveal whether the key exists on foreign origins.
      return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
    }

    const flagStore = flagStoreForSite(site);
    // A typed/query origin is not an install signal. This path is reached
    // only after the browser header passed this site's origin policy. Any
    // client can set that header, so an unverified domain earns nothing
    // here: it only schedules our own check of the domain's page.
    // Store Chat off leaves the site in `draft`; the pasted code still runs
    // Try-On there, so only an operator-disabled site is left out.
    const [features, orderProvider] = await Promise.all([
      storeFlags(flagStore),
      resolveOrderProvider(site),
      headerOrigin && site.status !== 'disabled'
        ? Promise.resolve(recordPasteSignal(site.id, headerOrigin)).then((signal) => {
          if (signal === 'unverified') schedulePasteDomainCheck(site.id, new URL(headerOrigin).hostname);
        }) : Promise.resolve(),
    ]);
    const now = new Date();
    const payload = features.includes('v16_chat')
      ? toPublicPayload(site, now, features, { orderProviderAvailable: Boolean(orderProvider) })
      : toPublicPayload(site, now, features);
    /* Who sees Store Chat on a Shopify store or a paired WooCommerce store
       (phase zero item 9): only the owner's preview link while it is in
       setup or preview, and not the holdout's off arm. The query names the
       visitor, so a shared cache keeps one answer per visitor. Any other
       site is always shown. */
    if (features.includes('n5_preview_mode')) {
      const siteKey = normalizeTenantKey(`site:${site.id}`);
      const tenant = 'shopDomain' in flagStore
        ? flagStore.shopDomain
        : (siteKey && await isActiveTenant(siteKey) ? siteKey : null);
      if (tenant) {
        payload.launch = launchAudience({
          launch: await getStoreLaunch(tenant),
          features,
          preview: verifyPreviewTokenAnyApp(request.nextUrl.searchParams.get('preview'), tenant),
          visitorId: launchVisitorId(request.nextUrl.searchParams.get('vid')),
          now,
        });
      }
    }
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
