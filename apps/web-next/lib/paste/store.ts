import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { normalizeStorefrontDomain, newVerificationToken, txtRecordFor, verifyDomainTxt } from '@/lib/messenger/domains';
import { apexDomain } from '@/lib/woo/free-plan';
import { PasteError, type PasteConnection, type PasteDomain, type PastePlatform } from './types';

export function normalizePasteDomain(input: string): string | null {
  return normalizeStorefrontDomain(input)?.replace(/^www\./, '') ?? null;
}

export function pasteDomainHosts(domain: string): string[] { return [domain, `www.${domain}`]; }

export function schemaMissing(error: { code?: string }): boolean {
  return ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error.code ?? '');
}

function checked<T>(result: { data: T; error: { code?: string } | null }): T {
  if (result.error) throw new PasteError(schemaMissing(result.error) ? 'schema_not_ready' : 'unavailable');
  return result.data;
}

export async function getPasteConnection(siteId: string): Promise<PasteConnection | null> {
  const result = await getMessengerServiceClient().from('paste_site_connections')
    .select('widget_site_id, platform, shop_domain, status, secret_version, previous_secret_version, previous_valid_until')
    .eq('widget_site_id', siteId).maybeSingle();
  if (result.error && schemaMissing(result.error)) return null;
  const row = checked(result) as PasteConnection | null;
  if (!row) return null;
  if (row.widget_site_id !== siteId || !['website', 'shopify'].includes(row.platform)
    || !['active', 'disconnected'].includes(row.status) || !Number.isSafeInteger(row.secret_version) || row.secret_version < 1
    || (row.platform === 'shopify' && (typeof row.shop_domain !== 'string' || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(row.shop_domain)))) {
    throw new PasteError('unavailable');
  }
  return row;
}

/** Call only after requireSiteAccess. The RPC also locks the site and refuses
 * an app/plugin tenant, so concurrent enables cannot overwrite a connection. */
export async function enablePasteInstall(siteId: string, platform: PastePlatform, shopDomain: string | null): Promise<void> {
  const result = checked(await getMessengerServiceClient().rpc('enable_paste_install', {
    p_site: siteId, p_platform: platform, p_shop_domain: shopDomain,
  }));
  if (result !== 'enabled') throw new PasteError(result === 'connection_conflict' ? result : 'invalid_platform');
}

type DomainRow = {
  id: string; domain: string; verification_status: string; verification_token: string;
  first_seen_at: string | null; last_seen_at: string | null;
};

function view(row: DomainRow): PasteDomain {
  return {
    id: row.id, domain: row.domain,
    state: row.verification_status === 'trusted' ? 'trusted' : row.verification_status === 'disputed' ? 'disputed' : 'claimed',
    firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at,
    proof: (({ name, value }) => ({ txtName: name, txtValue: value,
      meta: { name: 'grindctrl-verification' as const, content: row.verification_token } }))(txtRecordFor(row.domain, row.verification_token)),
  };
}

const DOMAIN_COLUMNS = 'id, domain, verification_status, verification_token, first_seen_at, last_seen_at';

export async function listPasteDomains(siteId: string): Promise<PasteDomain[]> {
  const rows = checked(await getMessengerServiceClient().from('widget_domains').select(DOMAIN_COLUMNS)
    .eq('widget_site_id', siteId).in('verification_method', ['paste_trusted', 'paste_dns_txt', 'paste_disputed'])
    .neq('verification_status', 'disabled').order('created_at', { ascending: true })) as DomainRow[] | null;
  return [...new Map((rows ?? []).map((row) => [normalizePasteDomain(row.domain), view(row)])).values()];
}

async function domainOperation(siteId: string, operation: 'add' | 'remove' | 'prove', input: {
  domain?: string; domainId?: string; token?: string;
}): Promise<DomainRow | null> {
  const result = checked(await getMessengerServiceClient().rpc('paste_domain_operation', {
    p_site: siteId, p_operation: operation, p_domain: input.domain ?? null,
    p_domain_id: input.domainId ?? null, p_token: input.token ?? newVerificationToken(),
  })) as { code: string; domain?: DomainRow };
  if (result.code !== 'ok') {
    const code = ['limit_reached', 'not_found', 'proof_failed', 'connection_conflict'].find((code) => code === result.code);
    throw new PasteError((code as 'limit_reached' | 'not_found' | 'proof_failed' | 'connection_conflict') ?? 'unavailable');
  }
  return result.domain ?? null;
}

export async function addPasteDomain(siteId: string, input: string): Promise<PasteDomain> {
  const domain = typeof input === 'string' ? normalizePasteDomain(input) : null;
  if (!domain) throw new PasteError('invalid_domain');
  const row = await domainOperation(siteId, 'add', { domain });
  if (!row) throw new PasteError('unavailable');
  return view(row);
}

export async function removePasteDomain(siteId: string, domainId: string): Promise<void> {
  await domainOperation(siteId, 'remove', { domainId });
}

/** Existing DNS proof, checked outside the transaction; the RPC fences the
 * token and domain id again under lock before transferring this host. */
export async function provePasteDomain(
  siteId: string, domainId: string, resolveTxt?: (host: string) => Promise<string[][]>,
): Promise<PasteDomain> {
  const rows = await listPasteDomains(siteId);
  const own = rows.find((row) => row.id === domainId);
  if (!own) throw new PasteError('not_found');
  const token = own.proof.txtValue.slice('grindctrl-verification='.length);
  if (!(await verifyDomainTxt(own.domain, token, resolveTxt))) throw new PasteError('proof_failed');
  const row = await domainOperation(siteId, 'prove', { domainId, token });
  if (!row) throw new PasteError('unavailable');
  return view(row);
}

export async function provePasteDomainMeta(siteId: string, domainId: string): Promise<PasteDomain> {
  const own = (await listPasteDomains(siteId)).find((row) => row.id === domainId);
  if (!own) throw new PasteError('not_found');
  const { verifyPasteMeta } = await import('./meta-proof');
  if (!(await verifyPasteMeta(own.domain, own.proof.meta.content))) throw new PasteError('proof_failed');
  const row = await domainOperation(siteId, 'prove', { domainId, token: own.proof.meta.content });
  if (!row) throw new PasteError('unavailable');
  return view(row);
}

export async function rotatePasteSecret(siteId: string): Promise<{ version: number; overlapUntil: string }> {
  const value = checked(await getMessengerServiceClient().rpc('rotate_paste_secret', { p_site: siteId })) as {
    version?: number; overlapUntil?: string;
  };
  if (!value || typeof value.version !== 'number' || typeof value.overlapUntil !== 'string') throw new PasteError('not_found');
  return { version: value.version, overlapUntil: value.overlapUntil };
}

export type PasteSignalResult = 'granted' | 'apex_taken' | 'ignored' | 'unavailable';

/** Only browser Origin / signed-origin-token authorized config/heartbeat
 * callers invoke this. Query-string origins never earn a signal. Existing
 * chat sites and absent migrations remain a no-op, not a new dependency. */
export async function recordPasteSignal(siteId: string, origin: string): Promise<PasteSignalResult> {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return 'ignored';
    const domain = normalizePasteDomain(url.hostname);
    const apex = domain ? apexDomain(domain) : null;
    if (!domain || !apex) return 'ignored';
    const { data, error } = await getMessengerServiceClient().rpc('record_paste_install_signal', {
      p_site: siteId, p_domain: domain, p_apex: apex,
    });
    if (error) return schemaMissing(error) ? 'ignored' : 'unavailable';
    return ['granted', 'apex_taken', 'ignored'].includes(data as string) ? data as PasteSignalResult : 'unavailable';
  } catch { return 'unavailable'; }
}

export async function pasteTrustedHosts(siteId: string): Promise<string[]> {
  return (await listPasteDomains(siteId)).filter((row) => row.state === 'trusted').flatMap((row) => pasteDomainHosts(row.domain));
}

/** Missing migration leaves existing Store Chat-only sites as they were. */
export async function listActivePasteSiteIds(siteIds: readonly string[]): Promise<Set<string>> {
  if (!siteIds.length) return new Set();
  const result = await getMessengerServiceClient().from('paste_site_connections').select('widget_site_id')
    .in('widget_site_id', [...siteIds]).eq('status', 'active');
  if (result.error && schemaMissing(result.error)) return new Set();
  const rows = checked(result) as Array<{ widget_site_id: string }> | null;
  return new Set((rows ?? []).map((row) => row.widget_site_id));
}
