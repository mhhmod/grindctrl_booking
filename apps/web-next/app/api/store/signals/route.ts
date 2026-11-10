import type { NextRequest } from 'next/server';
import { readLimitedJson, isJsonObject } from '@/lib/http/read-limited-body';
import { loadPublicSite, originAllowed } from '@/lib/messenger/public-api';
import { getPasteConnection, pasteTrustedHosts, isPasteTrusted } from '@/lib/paste/store';
import { clientIp, proxyVisitorRatelimit, proxyShopReadRatelimit } from '@/lib/ratelimit';
import { requireRateLimit } from '@/lib/request-rate-limit';
import { incrementHealthCounters, type HealthCounter } from '@/lib/store-health/signals';

export const runtime = 'nodejs';
const quiet = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  try {
    // IP budget before DB lookup. No visitor identity or URL accepted.
    await requireRateLimit(proxyVisitorRatelimit, `store-signals:ip:${clientIp(request) ?? 'unknown'}`);
    const read = await readLimitedJson(request, 512);
    if (!read.ok || !isJsonObject(read.value)) return quiet();
    const b = read.value;
    if (Object.keys(b).some((k) => !['key', 'kind', 'placement', 'productDetected', 'pills'].includes(k))
      || typeof b.key !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(b.key)) return quiet();
    let counters: HealthCounter[];
    if (b.kind === 'product_page') {
      if (typeof b.productDetected !== 'boolean' || b.pills !== undefined
        || (b.productDetected ? !['inline', 'floating'].includes(String(b.placement)) : b.placement !== undefined)) return quiet();
      counters = [{ metric: 'product_detected', dimension: b.productDetected ? 'yes' : 'no', count: 1 }];
      if (b.productDetected) counters.push({ metric: 'placement', dimension: b.placement as string, count: 1 });
    } else if (b.kind === 'listing') {
      if (!Number.isInteger(b.pills) || (b.pills as number) < 0 || (b.pills as number) > 200
        || b.placement !== undefined || b.productDetected !== undefined) return quiet();
      counters = [{ metric: 'listing_views', dimension: '', count: 1 }, { metric: 'pills', dimension: '', count: b.pills as number }];
    } else return quiet();
    const site = await loadPublicSite(b.key);
    const origin = request.headers.get('origin');
    if (!site || site.status === 'disabled' || !origin || !originAllowed(site, origin, { trusted: true })) return quiet();
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.port) return quiet();
    const paste = await getPasteConnection(site.id);
    if (paste && (!isPasteTrusted(paste) || !(await pasteTrustedHosts(paste)).includes(url.hostname))) return quiet();
    await requireRateLimit(proxyShopReadRatelimit, `store-signals:site:${site.id}`);
    await incrementHealthCounters(site.id, counters);
  } catch { /* Invalid, denied or unavailable: no storefront-visible failure. */ }
  return quiet();
}
