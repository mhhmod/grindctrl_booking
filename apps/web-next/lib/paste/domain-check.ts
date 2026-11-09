import 'server-only';
import { after } from 'next/server';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { pasteDomainCheckAutoRatelimit, pasteDomainCheckHostRatelimit, pasteDomainCheckOwnerRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';
import { detectPlatform } from './platform-detect';
import {
  domainVerificationReason, grantPasteDomainPlan, listPasteDomains, normalizePasteDomain, recordPasteDomainCheck, recordPasteDomainPlatform,
  verifyPasteDomain,
} from './store';
import { scanDomainSnippet } from './storefront-scan';
import { PasteError, type PasteDomain, type PasteDomainCheck } from './types';

/* A pasted install's domain becomes verified only when OUR server fetches
   its home page and finds this site's own snippet there. No DNS step for the
   merchant: the check runs when the domain is added, when the owner presses
   "Check my store", and when a widget reports from a domain that is still
   unverified. A request's Origin header can only ask for a check (rate
   limited); it never verifies anything or earns a plan by itself.

   Every path fails closed: no rate-limit answer, no check; a check that
   cannot read the page leaves the domain unverified. */

export type DomainCheckTrigger = 'added' | 'owner' | 'widget';

type CheckDeps = { scan?: typeof scanDomainSnippet };

function log(siteId: string, trigger: DomainCheckTrigger, outcome: string, extra: Record<string, unknown> = {}) {
  // Site, trigger and outcome only: never the page or its URL.
  console.info('[paste] domain check', { code: 'paste_domain_check', site: siteId, trigger, outcome, ...extra });
}

async function limit(siteId: string, domain: string, trigger: DomainCheckTrigger): Promise<number | null> {
  try {
    if (trigger === 'widget') await requireRateLimit(pasteDomainCheckAutoRatelimit, `paste-domain-check:auto:${siteId}:${domain}`);
    else await requireRateLimit(pasteDomainCheckOwnerRatelimit, `paste-domain-check:owner:${siteId}:${domain}`);
    await requireRateLimit(pasteDomainCheckHostRatelimit, `paste-domain-check:host:${domain}`);
    return null;
  } catch (error) {
    if (error instanceof RequestRateLimitError && error.status === 429) return error.retryAfterSeconds;
    throw new PasteError('unavailable');
  }
}

/** Looks for this site's snippet on one of its paste domains and verifies
 *  the domain when it is there. Throws PasteError: unavailable (rate limiter
 *  or database), or what the verify operation refuses (not_found,
 *  connection_conflict). */
export async function checkPasteDomain(site: { id: string; embedKey: string }, domain: PasteDomain,
  trigger: DomainCheckTrigger, deps: CheckDeps = {}): Promise<PasteDomainCheck> {
  const retryAfter = await limit(site.id, domain.domain, trigger);
  if (retryAfter !== null) {
    log(site.id, trigger, 'rate_limited');
    return { domain, outcome: 'rate_limited', retryAfterSeconds: retryAfter };
  }
  const scan = await (deps.scan ?? scanDomainSnippet)(site, domain);
  if (scan.outcome !== 'verified') {
    await recordPasteDomainCheck(site.id, domain.id, scan.outcome);
    log(site.id, trigger, scan.outcome, scan.outcome === 'unreachable' && scan.failure ? { failure: scan.failure } : {});
    const check = { outcome: scan.outcome, checkedAt: new Date().toISOString() };
    return {
      domain: { ...domain, check, verificationReason: domainVerificationReason({ ...domain, check }) },
      outcome: scan.outcome, retryAfterSeconds: null,
    };
  }
  const verified = await verifyPasteDomain(site.id, scan.evidence);
  // Website sites claim their free plan from this verified domain; the RPC
  // answers `ignored` for Shopify, whose plan comes from a signed render.
  const grant = await grantPasteDomainPlan(site.id, verified.domain);
  // The page is already here: fingerprint its store platform too.
  await recordPasteDomainPlatform(site.id, verified.domain, detectPlatform(scan.page).platform);
  log(site.id, trigger, 'verified', { grant });
  return { domain: verified, outcome: 'verified', retryAfterSeconds: null };
}

/** The widget-triggered check for the domain a request came from. Only a
 *  domain that still waits is checked: trusted but unverified, or claimed
 *  while another site holds it. A disputed host (another site proved it
 *  later) moves back only by the owner's own check. */
export async function checkPasteDomainForHost(siteId: string, host: string, deps: CheckDeps = {}): Promise<PasteDomainCheck | null> {
  const name = normalizePasteDomain(host);
  if (!name) return null;
  const domain = (await listPasteDomains(siteId)).find((row) => normalizePasteDomain(row.domain) === name);
  if (!domain || domain.domainVerified || domain.state === 'disputed') return null;
  const { data, error } = await getMessengerServiceClient().from('widget_sites')
    .select('id, embed_key, status').eq('id', siteId).maybeSingle();
  if (error) throw new PasteError('unavailable');
  const site = data as { id: string; embed_key: string; status: string } | null;
  if (!site || site.status === 'disabled' || typeof site.embed_key !== 'string') return null;
  return checkPasteDomain({ id: site.id, embedKey: site.embed_key }, domain, 'widget', deps);
}

/** Runs the widget-triggered check after the response is sent. Never throws. */
export function schedulePasteDomainCheck(siteId: string, host: string): void {
  try {
    after(() => checkPasteDomainForHost(siteId, host).then(() => undefined, () => {
      console.error('[paste] domain check failed', { code: 'paste_domain_check', site: siteId, trigger: 'widget' });
    }));
  } catch {
    console.error('[paste] domain check not scheduled', { code: 'paste_domain_check', site: siteId });
  }
}
