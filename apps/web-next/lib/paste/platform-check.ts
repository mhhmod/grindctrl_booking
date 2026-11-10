import 'server-only';
import { after } from 'next/server';
import { pastePlatformCheckRatelimit } from '@/lib/ratelimit';
import { requireRateLimit } from '@/lib/request-rate-limit';
import { detectPlatform, type DetectedPlatform } from './platform-detect';
import { recordPasteDomainPlatform } from './store';
import { fetchStorefrontPage } from './storefront-scan';

/* Fingerprints a trusted website-paste domain's store platform from its own
   home page, fetched by our server, and stores it on the domain row. Runs
   after the owner adds or proves a domain, and once (rate limited) when a
   shopper's garment photo is refused from a platform image server for a
   domain never checked, so installs that predate this check catch up.
   A failed fetch keeps whatever was stored before. */

export async function checkPasteDomainPlatform(siteId: string, domain: string, deps: {
  fetchPage?: typeof fetchStorefrontPage; record?: typeof recordPasteDomainPlatform;
} = {}): Promise<DetectedPlatform | null> {
  try {
    await requireRateLimit(pastePlatformCheckRatelimit, `paste-platform:${domain}`);
  } catch {
    console.info('[paste] platform check skipped', { code: 'paste_platform_check', site: siteId, outcome: 'rate_limited' });
    return null;
  }
  const page = await (deps.fetchPage ?? fetchStorefrontPage)(domain);
  if ('failure' in page) {
    console.info('[paste] platform check', { code: 'paste_platform_check', site: siteId, outcome: 'unreachable', failure: page.failure });
    return null;
  }
  const { platform, signals } = detectPlatform(page);
  const recorded = await (deps.record ?? recordPasteDomainPlatform)(siteId, domain, platform);
  // Signal names only: never the page, its URL or headers.
  console.info('[paste] platform check', { code: 'paste_platform_check', site: siteId, outcome: platform, signals, recorded });
  return platform;
}

/** Runs the check after the response is sent. Never throws. */
export function schedulePasteDomainPlatformCheck(siteId: string, domain: string): void {
  try {
    after(() => checkPasteDomainPlatform(siteId, domain).catch(() => {
      console.error('[paste] platform check failed', { code: 'paste_platform_check', site: siteId });
    }));
  } catch {
    console.error('[paste] platform check not scheduled', { code: 'paste_platform_check', site: siteId });
  }
}
