import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { normalizeStorefrontDomain, newVerificationToken, txtRecordFor, verifyDomainTxt } from '@/lib/messenger/domains';
import { apexDomain, registrableDomain } from '@/lib/woo/free-plan';
import {
  PasteError, type PasteConnection, type PasteDomain, type PasteDomainCheckOutcome, type PasteDomainVerificationReason, type PastePlatform,
  type PasteShopCheckOutcome, type PasteTrust,
} from './types';
import type { DomainSnippetEvidence, StorefrontEvidence } from './storefront-scan';
import { isDetectedPlatform, type DetectedPlatform } from './platform-detect';

/** A connection's signed shop. Merchants cannot add it as a domain row;
 *  it is trusted through paste_site_connections.shop_domain instead. */
export const SHOP_HOST_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** The single rule every consumer applies: only an active connection is
 *  trusted, and a Shopify one only once a signed render proved the shop and
 *  while no Shopify app install holds that shop. */
export function pasteTrust(connection: PasteConnection | null): PasteTrust {
  if (!connection || connection.status === 'disconnected') return 'not_connected';
  if (connection.platform === 'shopify') {
    if (connection.app_installed) return 'shopify_app_installed';
    if (connection.status !== 'active' || !connection.shop_proven_at) return 'shop_proof_pending';
  }
  return connection.status === 'active' ? 'trusted' : 'not_connected';
}

export function isPasteTrusted(connection: PasteConnection | null): connection is PasteConnection {
  return pasteTrust(connection) === 'trusted';
}

/** The shop host a trusted Shopify paste connection admits, if any. */
export function pasteShopHost(connection: PasteConnection | null): string | null {
  return isPasteTrusted(connection) && connection.platform === 'shopify' && connection.shop_domain
    && SHOP_HOST_RE.test(connection.shop_domain) ? connection.shop_domain : null;
}

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

const SHOP_CHECK_OUTCOMES: readonly PasteShopCheckOutcome[] = ['proven', 'awaiting_visit', 'not_found', 'outdated_code',
  'wrong_site', 'password_required', 'password_rejected', 'unreachable'];

/** Throws when the read fails, so callers fail closed. Shopify connections
 *  also read shopify_installations on every call: an app installed after
 *  the paste connection takes the shop over without relying on a webhook. */
export async function getPasteConnection(siteId: string): Promise<PasteConnection | null> {
  const db = getMessengerServiceClient();
  const result = await db.from('paste_site_connections')
    .select('widget_site_id, platform, shop_domain, status, secret_version, previous_secret_version, previous_valid_until, first_seen_at, last_seen_at, shop_proven_at, disconnected_reason, shop_render_at, shop_check_outcome, shop_checked_at')
    .eq('widget_site_id', siteId).maybeSingle();
  if (result.error && schemaMissing(result.error)) return null;
  const row = checked(result) as Omit<PasteConnection, 'app_installed'> | null;
  if (!row) return null;
  if (row.widget_site_id !== siteId || !['website', 'shopify'].includes(row.platform)
    || !['pending', 'active', 'disconnected'].includes(row.status) || !Number.isSafeInteger(row.secret_version) || row.secret_version < 1
    || (row.platform === 'shopify' && (typeof row.shop_domain !== 'string' || !SHOP_HOST_RE.test(row.shop_domain)))) {
    throw new PasteError('unavailable');
  }
  let appInstalled = false;
  if (row.platform === 'shopify' && row.status !== 'disconnected') {
    const install = await db.from('shopify_installations').select('shop_domain')
      .eq('shop_domain', row.shop_domain as string).eq('status', 'active').limit(1);
    if (install.error) throw new PasteError('unavailable');
    appInstalled = Array.isArray(install.data) && install.data.length > 0;
  }
  return {
    ...row, disconnected_reason: row.disconnected_reason === 'displaced' ? 'displaced' : null,
    shop_render_at: row.shop_render_at ?? null, shop_checked_at: row.shop_checked_at ?? null,
    shop_check_outcome: SHOP_CHECK_OUTCOMES.find((outcome) => outcome === row.shop_check_outcome) ?? null,
    app_installed: appInstalled,
  };
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
  /** Absent before 20261109_paste_domain_verification.sql: unverified. */
  paste_verified_at?: string | null; paste_check_outcome?: string | null; paste_checked_at?: string | null;
};

const DOMAIN_CHECK_OUTCOMES: readonly PasteDomainCheckOutcome[] = ['verified', 'not_found', 'wrong_site', 'unreachable'];

/** Why a domain is not verified yet; null once it is. */
export function domainVerificationReason(domain: Pick<PasteDomain, 'state' | 'domainVerified' | 'check'>): PasteDomainVerificationReason | null {
  if (domain.state === 'disputed') return 'proven_elsewhere';
  if (domain.state === 'claimed') return 'held_elsewhere';
  if (domain.domainVerified) return null;
  switch (domain.check?.outcome) {
    case 'not_found': return 'code_not_found';
    case 'wrong_site': return 'wrong_site';
    case 'unreachable': return 'unreachable';
    default: return 'awaiting_code';
  }
}

function view(row: DomainRow): PasteDomain {
  const verifiedAt = row.paste_verified_at ?? null;
  const outcome = verifiedAt ? 'verified' : DOMAIN_CHECK_OUTCOMES.find((value) => value === row.paste_check_outcome) ?? null;
  const checkedAt = verifiedAt ? row.paste_checked_at ?? verifiedAt : row.paste_checked_at ?? null;
  const state = row.verification_status === 'trusted' ? 'trusted' : row.verification_status === 'disputed' ? 'disputed' : 'claimed';
  const domainVerified = state === 'trusted' && verifiedAt !== null;
  const check = outcome && checkedAt ? { outcome, checkedAt } : null;
  return {
    id: row.id, domain: row.domain, state, domainVerified,
    verifiedAt: state === 'trusted' ? verifiedAt : null,
    verificationReason: domainVerificationReason({ state, domainVerified, check }),
    check,
    firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at,
    proof: (({ name, value }) => ({ txtName: name, txtValue: value,
      meta: { name: 'grindctrl-verification' as const, content: row.verification_token } }))(txtRecordFor(row.domain, row.verification_token)),
  };
}

const DOMAIN_COLUMNS = 'id, domain, verification_status, verification_token, first_seen_at, last_seen_at';
const VERIFICATION_COLUMNS = 'paste_verified_at, paste_check_outcome, paste_checked_at';

/** Only the verification columns themselves, like platformColumnMissing:
 *  any other schema error is an outage and must not read as "unverified". */
function verificationColumnMissing(error: { code?: string | null; message?: string | null }): boolean {
  return (error.code === '42703' || error.code === 'PGRST204') && /\bpaste_(?:verified_at|check_outcome|checked_at)\b/.test(error.message ?? '');
}

export async function listPasteDomains(siteId: string): Promise<PasteDomain[]> {
  const read = (columns: string) => getMessengerServiceClient().from('widget_domains').select(columns)
    .eq('widget_site_id', siteId).in('verification_method', ['paste_trusted', 'paste_dns_txt', 'paste_disputed'])
    .neq('verification_status', 'disabled').order('created_at', { ascending: true });
  let result = await read(`${DOMAIN_COLUMNS}, ${VERIFICATION_COLUMNS}`);
  // Before its migration every domain reads as unverified (fail closed).
  if (result.error && verificationColumnMissing(result.error)) result = await read(DOMAIN_COLUMNS);
  const rows = checked(result) as unknown as DomainRow[] | null;
  return [...new Map((rows ?? []).map((row) => [normalizePasteDomain(row.domain), view(row)])).values()];
}

async function domainOperation(siteId: string, operation: 'add' | 'remove' | 'prove' | 'verify', input: {
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

/** Takes the evidence only the snippet check produces (this site's own
 *  snippet found on the domain's home page by our server), so nothing a
 *  browser sends can reach it. Transfers the host like a DNS proof. */
export async function verifyPasteDomain(siteId: string, evidence: DomainSnippetEvidence): Promise<PasteDomain> {
  if (evidence.siteId !== siteId) throw new PasteError('proof_failed');
  const row = await domainOperation(siteId, 'verify', { domainId: evidence.domainId });
  if (!row) throw new PasteError('unavailable');
  return view(row);
}

/** Stores a snippet check that did not find this site's code. */
export async function recordPasteDomainCheck(siteId: string, domainId: string,
  outcome: Exclude<PasteDomainCheckOutcome, 'verified'>): Promise<void> {
  const data = checked(await getMessengerServiceClient().rpc('record_paste_domain_check', {
    p_site: siteId, p_domain_id: domainId, p_outcome: outcome,
  }));
  if (data !== 'recorded' && data !== 'not_found') throw new PasteError('unavailable');
}

export type PasteGrantResult = 'granted' | 'apex_taken' | 'unverified' | 'ignored' | 'unavailable';

/** The website free plan for a domain our server verified. The RPC checks
 *  the verification again under the paste lock; an unverified domain never
 *  claims a plan or apex history. */
export async function grantPasteDomainPlan(siteId: string, domain: string): Promise<PasteGrantResult> {
  const apex = apexDomain(domain);
  if (!apex) return 'ignored';
  try {
    const { data, error } = await getMessengerServiceClient().rpc('grant_paste_domain_free_plan', {
      p_site: siteId, p_domain: domain, p_apex: apex,
    });
    if (error) return schemaMissing(error) ? 'ignored' : 'unavailable';
    return ['granted', 'apex_taken', 'unverified', 'ignored'].includes(data as string) ? data as PasteGrantResult : 'unavailable';
  } catch { return 'unavailable'; }
}

export async function rotatePasteSecret(siteId: string): Promise<{ version: number; overlapUntil: string }> {
  const value = checked(await getMessengerServiceClient().rpc('rotate_paste_secret', { p_site: siteId })) as {
    version?: number; overlapUntil?: string;
  };
  if (!value || typeof value.version !== 'number' || typeof value.overlapUntil !== 'string') throw new PasteError('not_found');
  return { version: value.version, overlapUntil: value.overlapUntil };
}

export type ShopProofResult = 'proven' | 'render_required' | 'shopify_app_installed' | 'not_pending';

/** Proves the shop for this site. It takes the evidence only the storefront
 *  scan produces (this site's signed snippet found on the shop's own
 *  storefront), so a signed render alone can never reach it. The RPC also
 *  requires a recent signed render (the second factor), then makes this
 *  site the shop's one active holder and displaces every other claim. */
export async function provePasteShop(connection: PasteConnection, evidence: StorefrontEvidence): Promise<ShopProofResult> {
  if (connection.platform !== 'shopify' || !connection.shop_domain) return 'not_pending';
  if (evidence.siteId !== connection.widget_site_id || evidence.shopDomain !== connection.shop_domain) throw new PasteError('proof_failed');
  const data = checked(await getMessengerServiceClient().rpc('prove_paste_shop', {
    p_site: connection.widget_site_id, p_shop: connection.shop_domain,
  }));
  if (data === 'proven' || data === 'render_required' || data === 'shopify_app_installed' || data === 'not_pending') return data;
  throw new PasteError('unavailable');
}

type ShopRpcResult<T extends string> = T | 'not_pending' | 'shopify_app_installed';

async function shopRpc<T extends string>(name: string, connection: PasteConnection, expected: readonly T[],
  extra: Record<string, string> = {}): Promise<ShopRpcResult<T>> {
  if (connection.platform !== 'shopify' || !connection.shop_domain) return 'not_pending';
  const data = checked(await getMessengerServiceClient().rpc(name, {
    p_site: connection.widget_site_id, p_shop: connection.shop_domain, ...extra,
  }));
  const known = [...expected, 'not_pending', 'shopify_app_installed'] as const;
  const value = known.find((code) => code === data);
  if (!value) throw new PasteError('unavailable');
  return value as ShopRpcResult<T>;
}

/** The second proof factor: a render for this pending site verified. */
export function recordPasteShopRender(connection: PasteConnection) {
  return shopRpc('record_paste_shop_render', connection, ['recorded'] as const);
}

/** A 30 second per-site lease: `busy` while another check is running. */
export function beginPasteShopCheck(connection: PasteConnection) {
  return shopRpc('begin_paste_shop_check', connection, ['started', 'busy'] as const);
}

/** Stores a check that did not prove the shop and ends the lease. */
export async function finishPasteShopCheck(connection: PasteConnection, outcome: Exclude<PasteShopCheckOutcome, 'proven'>): Promise<void> {
  await shopRpc('finish_paste_shop_check', connection, ['recorded'] as const, { p_outcome: outcome });
}

/** Ends the lease of a check that stores nothing: one that could not look at
 *  the storefront while an earlier finding is still fresh. The finding and
 *  its time stay exactly as they were. */
export async function releasePasteShopCheck(connection: PasteConnection): Promise<void> {
  if (connection.platform !== 'shopify' || !connection.shop_domain) return;
  checked(await getMessengerServiceClient().from('paste_site_connections').update({ shop_check_started_at: null })
    .eq('widget_site_id', connection.widget_site_id).eq('platform', 'shopify').eq('shop_domain', connection.shop_domain)
    .eq('status', 'pending'));
}

export type PasteSignalResult = 'granted' | 'apex_taken' | 'recorded' | 'unverified' | 'ignored' | 'unavailable';

/** Only browser Origin / signed-origin-token authorized config/heartbeat
 * callers invoke this. Query-string origins never earn a signal. Existing
 * chat sites and absent migrations remain a no-op, not a new dependency.
 * An Origin header is client-chosen outside a browser, so it never earns a
 * plan by itself: a domain row counts only once our server verified it
 * (20261109_paste_domain_verification.sql), and an unverified one answers
 * `unverified` with nothing recorded; the caller may then schedule a
 * snippet check. A `.myshopify.com` host is submitted as its own apex; the
 * RPC records it only when it is this site's proven connection shop.
 * `signed` is set only by the context route after a verified Liquid render:
 * a Shopify paste store earns its free plan from that alone, and an
 * Origin-only signal is just `recorded`. */
export async function recordPasteSignal(siteId: string, origin: string, options: { signed?: boolean } = {}): Promise<PasteSignalResult> {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return 'ignored';
    const host = url.hostname.replace(/\.$/, '');
    const isShop = SHOP_HOST_RE.test(host);
    const domain = isShop ? host : normalizePasteDomain(host);
    const apex = isShop ? registrableDomain(host) : domain ? apexDomain(domain) : null;
    if (!domain || !apex) return 'ignored';
    const { data, error } = await getMessengerServiceClient().rpc('record_paste_install_signal', {
      p_site: siteId, p_domain: domain, p_apex: apex, p_signed: options.signed === true,
    });
    if (error) return schemaMissing(error) ? 'ignored' : 'unavailable';
    return ['granted', 'apex_taken', 'recorded', 'unverified', 'ignored'].includes(data as string) ? data as PasteSignalResult : 'unavailable';
  } catch { return 'unavailable'; }
}

async function connectionHosts(connection: PasteConnection, shop: string | null, verifiedOnly = false): Promise<string[]> {
  const domains = (await listPasteDomains(connection.widget_site_id))
    .filter((row) => row.state === 'trusted' && (!verifiedOnly || row.domainVerified)).flatMap((row) => pasteDomainHosts(row.domain));
  return shop ? [shop, ...domains] : domains;
}

/** Every host a trusted connection's code may run on: trusted domain rows
 *  (with their www alias) and, for Shopify, the signed shop host itself.
 *  Store Chat loads on these at once, verified or not. */
export async function pasteTrustedHosts(connection: PasteConnection): Promise<string[]> {
  return isPasteTrusted(connection) ? connectionHosts(connection, pasteShopHost(connection)) : [];
}

/** Where Try-On may run: the proven Shopify shop host and the trusted
 *  domain rows our server verified. Call after the connection is trusted
 *  (a pending shop proven in this request included). */
export async function pasteTryOnHosts(connection: PasteConnection): Promise<string[]> {
  const shop = connection.platform === 'shopify' && connection.shop_domain && SHOP_HOST_RE.test(connection.shop_domain)
    ? connection.shop_domain : null;
  return connection.status === 'disconnected' || connection.app_installed ? [] : connectionHosts(connection, shop, true);
}

/** Where a pending Shopify connection's proving render may arrive from: the
 *  shop host or a storefront domain row. Admits nothing by itself; the
 *  render must still pass the HMAC check before prove_paste_shop. */
export async function pasteProofHosts(connection: PasteConnection): Promise<string[]> {
  return pasteTrust(connection) === 'shop_proof_pending' && connection.shop_domain
    ? connectionHosts(connection, connection.shop_domain) : [];
}

export type PasteCodeVersion = { version: number; seenAt: string | null };

/** The snippet version seen in the latest verified render; null before the
 *  first one, and while 20261108_paste_code_version.sql has not run. */
export async function readPasteCodeVersion(siteId: string): Promise<PasteCodeVersion | null> {
  const result = await getMessengerServiceClient().from('paste_site_connections')
    .select('code_version, code_version_seen_at').eq('widget_site_id', siteId).maybeSingle();
  if (result.error) {
    if (schemaMissing(result.error)) return null;
    throw new PasteError('unavailable');
  }
  const row = result.data as { code_version: number | null; code_version_seen_at: string | null } | null;
  return row && Number.isInteger(row.code_version) && (row.code_version as number) >= 1
    ? { version: row.code_version as number, seenAt: row.code_version_seen_at ?? null } : null;
}

/* Versions this server instance already stored, so a busy storefront does
   not write on every render. Another instance may store it once more. */
const recordedCodeVersions = new Map<string, number>();

/** Call only after a render's signature verified for this site. Writes only
 *  when the stored version differs. Never throws: this is a dashboard hint,
 *  and a missing column (before its migration) is a no-op. */
export async function recordPasteCodeVersion(siteId: string, version: number): Promise<void> {
  if (!Number.isInteger(version) || version < 1 || version > 99 || recordedCodeVersions.get(siteId) === version) return;
  try {
    const { error } = await getMessengerServiceClient().from('paste_site_connections')
      .update({ code_version: version, code_version_seen_at: new Date().toISOString() })
      .eq('widget_site_id', siteId).or(`code_version.is.null,code_version.neq.${version}`);
    if (error && !schemaMissing(error)) {
      console.error('[paste] code version not recorded', { code: 'paste_code_version', site: siteId });
      return;
    }
    // Before the migration too: do not retry a write that cannot land on every render.
    if (recordedCodeVersions.size > 5000) recordedCodeVersions.clear();
    recordedCodeVersions.set(siteId, version);
  } catch {
    console.error('[paste] code version not recorded', { code: 'paste_code_version', site: siteId });
  }
}

/** Test seam: forget which versions this instance stored. */
export function resetRecordedPasteCodeVersions(): void { recordedCodeVersions.clear(); }

export type PasteDomainPlatform = { domain: string; platform: DetectedPlatform | null; detectedAt: string | null };

const PASTE_DOMAIN_METHODS = ['paste_trusted', 'paste_dns_txt', 'paste_disputed'];

/** Match only these additive columns, like try-on/settings.ts. Other schema
 *  errors are operational failures and must not masquerade as custom. */
function platformColumnMissing(error: { code?: string | null; message?: string | null }): boolean {
  return (error.code === '42703' || error.code === 'PGRST204')
    && /\bplatform_detected(?:_at)?\b/.test(error.message ?? '');
}

/** The detected store platform of each trusted paste domain; `platform` is
 *  null while unchecked. Null overall while 20261109_paste_platform_detected.sql
 *  has not run: callers treat every domain as `custom`. Throws on any other
 *  read failure, so garment checks fail closed. */
export async function readPasteDomainPlatforms(siteId: string): Promise<PasteDomainPlatform[] | null> {
  const result = await getMessengerServiceClient().from('widget_domains')
    .select('domain, platform_detected, platform_detected_at')
    .eq('widget_site_id', siteId).eq('verification_status', 'trusted').in('verification_method', PASTE_DOMAIN_METHODS);
  if (result.error) {
    if (platformColumnMissing(result.error)) return null;
    throw new PasteError('unavailable');
  }
  const rows = (result.data ?? []) as Array<{ domain: string; platform_detected: string | null; platform_detected_at: string | null }>;
  return rows.flatMap((row) => {
    const domain = normalizePasteDomain(row.domain);
    if (!domain) return [];
    const platform = row.platform_detected == null ? null : isDetectedPlatform(row.platform_detected) ? row.platform_detected : 'custom';
    return [{ domain, platform, detectedAt: row.platform_detected_at ?? null }];
  });
}

/** The trusted paste domain a page host belongs to (the domain or its www alias). */
export function pasteDomainOf<T extends { domain: string }>(rows: readonly T[], host: string): T | null {
  const domain = normalizePasteDomain(host);
  return (domain && rows.find((row) => row.domain === domain)) || null;
}

/** Stores what our server's own storefront fetch found. Never throws: a
 *  missing column (before its migration) or a failed write leaves the
 *  domain as it was, which reads as `custom`. */
export async function recordPasteDomainPlatform(siteId: string, domain: string, platform: DetectedPlatform): Promise<boolean> {
  try {
    const { error } = await getMessengerServiceClient().from('widget_domains')
      .update({ platform_detected: platform, platform_detected_at: new Date().toISOString() })
      .eq('widget_site_id', siteId).eq('verification_status', 'trusted').in('verification_method', PASTE_DOMAIN_METHODS)
      .in('domain', pasteDomainHosts(domain));
    if (!error) return true;
    if (!platformColumnMissing(error)) console.error('[paste] platform not recorded', { code: 'paste_platform_record', site: siteId });
    return false;
  } catch {
    console.error('[paste] platform not recorded', { code: 'paste_platform_record', site: siteId });
    return false;
  }
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
