import 'server-only';

import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { getMessengerServiceClient } from './db';

/* Storefront domains a merchant proves by DNS, for Store Chat on any site
   that is not a Shopify store (WooCommerce, a custom build).

   Store Chat admits a storefront origin only from the site's own connected
   domain or a verified widget_domains row (origins.ts). A Shopify store gets
   both from Shopify itself (shop-domain-sync.ts). Every other site starts
   with neither, so its config was refused and no launcher ever drew. Here a
   merchant adds a host, publishes a TXT record we name, and we look it up:
   control of the zone is the proof, the same one search consoles use.

   Only rows this path created (verification_method 'dns_txt') can be
   checked or removed here. Shopify's own rows stay owned by the sync, and a
   myshopify host is never accepted: it is admitted without a row already.

   The hosted RPCs dashboard_add_domain/dashboard_update_domain_status are
   not used: they ignore the caller and would let any authenticated call
   touch any site's domains. Every query below is scoped to the site the
   caller was already authorized for. */

export const DNS_TXT_METHOD = 'dns_txt';
export const MAX_DOMAINS_PER_SITE = 5;
const TXT_PREFIX = '_grindctrl-verification';
const TXT_VALUE_PREFIX = 'grindctrl-verification=';
const DNS_TIMEOUT_MS = 5_000;

const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;

export type DomainErrorCode = 'invalid_domain' | 'taken' | 'limit_reached' | 'not_found';

export class DomainError extends Error {
  constructor(readonly code: DomainErrorCode) {
    super(code);
    this.name = 'DomainError';
  }
}

export type DomainStatus = 'pending' | 'verified' | 'failed' | 'disabled';

export interface DomainView {
  id: string;
  domain: string;
  status: DomainStatus;
  txtName: string;
  txtValue: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
}

/** The host a merchant typed, as Store Chat will see it in an Origin, or null. */
export function normalizeStorefrontDomain(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 300) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.port) return null;
  // URL hands it back lowercased and an IDN as punycode, as an Origin carries it.
  const host = url.hostname.replace(/\.$/, '');
  if (!HOST_RE.test(host)) return null; // also refuses IP literals, localhost, single labels
  if (host.endsWith('.myshopify.com') || host === 'grindctrl.cloud' || host.endsWith('.grindctrl.cloud')) return null;
  return host;
}

export function newVerificationToken(): string {
  return randomBytes(18).toString('base64url');
}

export function txtRecordFor(domain: string, token: string): { name: string; value: string } {
  return { name: `${TXT_PREFIX}.${domain}`, value: `${TXT_VALUE_PREFIX}${token}` };
}

type ResolveTxt = (hostname: string) => Promise<string[][]>;

/** Whether the TXT record we asked for is published. A missing record, a
 *  resolver error and a slow resolver all read as "not yet". */
export async function verifyDomainTxt(
  domain: string,
  token: string,
  resolveTxt: ResolveTxt = dns.resolveTxt,
): Promise<boolean> {
  const { name, value } = txtRecordFor(domain, token);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DNS_TIMEOUT_MS);
  });
  try {
    const records = await Promise.race([resolveTxt(name), timeout]);
    // A long TXT value arrives split into strings; they are one record.
    return Array.isArray(records) && records.some((chunks) => chunks.join('').trim() === value);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

type DomainRow = {
  id: string;
  domain: string | null;
  pattern: string | null;
  verification_status: string;
  verification_method: string | null;
  verification_token: string | null;
  verified_at: string | null;
  last_checked_at: string | null;
};

const COLUMNS = 'id, domain, pattern, verification_status, verification_method, verification_token, verified_at, last_checked_at';

function toView(row: DomainRow): DomainView {
  const domain = row.domain ?? row.pattern ?? '';
  const txt = txtRecordFor(domain, row.verification_token ?? '');
  const status = (['pending', 'verified', 'failed', 'disabled'] as const).find((s) => s === row.verification_status) ?? 'pending';
  return {
    id: row.id,
    domain,
    status,
    txtName: txt.name,
    txtValue: txt.value,
    verifiedAt: row.verified_at,
    lastCheckedAt: row.last_checked_at,
  };
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** The domains a merchant added by DNS for this site. */
export async function listSiteDomains(siteId: string): Promise<DomainView[]> {
  const rows = check(
    await getMessengerServiceClient()
      .from('widget_domains')
      .select(COLUMNS)
      .eq('widget_site_id', siteId)
      .eq('verification_method', DNS_TXT_METHOD)
      .order('created_at', { ascending: true }),
  ) as DomainRow[] | null;
  return (rows ?? []).map(toView);
}

/* One store per storefront: a host already proven for another site stays
   with it. Proving it here as well would let either site's chat run there. */
async function assertNotTaken(siteId: string, domain: string): Promise<void> {
  const claimed = check(
    await getMessengerServiceClient()
      .from('widget_domains')
      .select('id, widget_site_id')
      .eq('pattern', domain)
      .eq('verification_status', 'verified'),
  ) as Array<{ id: string; widget_site_id: string }> | null;
  if ((claimed ?? []).some((row) => row.widget_site_id !== siteId)) throw new DomainError('taken');
}

export async function addSiteDomain(siteId: string, input: string): Promise<DomainView> {
  const domain = normalizeStorefrontDomain(input);
  if (!domain) throw new DomainError('invalid_domain');
  const supabase = getMessengerServiceClient();
  await assertNotTaken(siteId, domain);

  const existing = await listSiteDomains(siteId);
  const same = existing.find((row) => row.domain === domain);
  if (same) return same;
  if (existing.length >= MAX_DOMAINS_PER_SITE) throw new DomainError('limit_reached');

  const row = check(
    await supabase
      .from('widget_domains')
      .insert({
        widget_site_id: siteId,
        domain,
        pattern: domain,
        environment: 'production',
        verification_status: 'pending',
        verification_method: DNS_TXT_METHOD,
        // Always ours: the table's trigger would otherwise mint an md5 token.
        verification_token: newVerificationToken(),
      })
      .select(COLUMNS)
      .single(),
  ) as DomainRow;
  return toView(row);
}

async function loadOwnRow(siteId: string, domainId: string): Promise<DomainRow> {
  const row = check(
    await getMessengerServiceClient()
      .from('widget_domains')
      .select(COLUMNS)
      .eq('id', domainId)
      .eq('widget_site_id', siteId)
      .eq('verification_method', DNS_TXT_METHOD)
      .maybeSingle(),
  ) as DomainRow | null;
  if (!row) throw new DomainError('not_found');
  return row;
}

export async function checkSiteDomain(
  siteId: string,
  domainId: string,
  resolveTxt?: ResolveTxt,
): Promise<DomainView> {
  const row = await loadOwnRow(siteId, domainId);
  const domain = row.domain ?? row.pattern ?? '';
  const verified = !!row.verification_token && (await verifyDomainTxt(domain, row.verification_token, resolveTxt));
  // Another site may have proven the host since this one was added.
  if (verified && row.verification_status !== 'verified') await assertNotTaken(siteId, domain);
  const now = new Date().toISOString();
  /* A verified host stays verified when a later check misses the record:
     a DNS blip or a merchant tidying records must not switch a live chat
     off without warning. Removing the domain is the way to revoke it. */
  const patch = verified
    ? { verification_status: 'verified', verified_at: row.verified_at ?? now, last_checked_at: now }
    : { verification_status: row.verification_status === 'verified' ? 'verified' : 'failed', last_checked_at: now };
  const updated = check(
    await getMessengerServiceClient()
      .from('widget_domains')
      .update(patch)
      .eq('id', domainId)
      .eq('widget_site_id', siteId)
      .select(COLUMNS)
      .single(),
  ) as DomainRow;
  return toView(updated);
}

export async function removeSiteDomain(siteId: string, domainId: string): Promise<void> {
  await loadOwnRow(siteId, domainId);
  check(
    await getMessengerServiceClient()
      .from('widget_domains')
      .delete()
      .eq('id', domainId)
      .eq('widget_site_id', siteId)
      .eq('verification_method', DNS_TXT_METHOD),
  );
}
