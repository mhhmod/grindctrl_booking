import 'server-only';

import { isIP } from 'node:net';
import { isNonPublicAddress } from './public-address';
export { isNonPublicAddress } from './public-address';
import { promises as dns } from 'node:dns';
import https from 'node:https';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { getPasteConnection, pasteTrustedHosts } from '@/lib/paste/store';

/* Garment images for WooCommerce stores are merchant-controlled URLs, so
   they are an SSRF surface. A URL is accepted only when it is https, on the
   default port, without credentials, and its host is one of the site's
   verified domains (or a subdomain of one) or an explicit WordPress image
   CDN. At mint time and again at fetch time the host is resolved, every
   address must be public, and the request is pinned to the address that was
   checked (no second lookup for DNS rebinding to win), with no redirects. */

export const WOO_IMAGE_CDN_HOSTS: readonly string[] = ['i0.wp.com', 'i1.wp.com', 'i2.wp.com'];
export const MAX_GARMENT_URL_LENGTH = 2048;
export const MAX_GARMENT_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const IMAGE_MIME_RE = /^image\/(jpeg|png|webp)$/;

export class UnsafeGarmentUrlError extends Error {
  constructor(readonly code: 'bad_url' | 'host_not_allowed' | 'unresolvable' | 'private_address') {
    super(code);
    this.name = 'UnsafeGarmentUrlError';
  }
}

function hostAllowed(host: string, verifiedHosts: readonly string[]): boolean {
  if (WOO_IMAGE_CDN_HOSTS.includes(host)) return true;
  return verifiedHosts.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Sync shape and host check. Returns the parsed URL or null. */
export function checkGarmentUrl(raw: unknown, verifiedHosts: readonly string[]): URL | null {
  if (typeof raw !== 'string' || raw.length > MAX_GARMENT_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || isIP(host) !== 0 || host.startsWith('[')) return null;
  return hostAllowed(host, verifiedHosts) ? url : null;
}

type Lookup = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultLookup: Lookup = (hostname) => dns.lookup(hostname, { all: true, verbatim: true });

/** Throws unless the URL passes the shape check and every address its host
 *  resolves to is public. Returns the first address to pin the request to. */
export async function assertSafeGarmentUrl(
  raw: unknown,
  verifiedHosts: readonly string[],
  lookup: Lookup = defaultLookup,
): Promise<{ url: URL; address: string; family: 4 | 6 }> {
  const url = checkGarmentUrl(raw, verifiedHosts);
  if (!url) {
    throw new UnsafeGarmentUrlError(typeof raw === 'string' && URL.canParse(raw) ? 'host_not_allowed' : 'bad_url');
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await Promise.race([
      lookup(url.hostname),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5_000).unref()),
    ]);
  } catch {
    throw new UnsafeGarmentUrlError('unresolvable');
  }
  if (!addresses.length) throw new UnsafeGarmentUrlError('unresolvable');
  // One private answer taints the host: a mixed set is a rebinding setup.
  if (addresses.some((entry) => isNonPublicAddress(entry.address))) {
    throw new UnsafeGarmentUrlError('private_address');
  }
  const first = addresses[0];
  return { url, address: first.address, family: first.family === 6 ? 6 : 4 };
}

/** The hosts a site has proven by DNS. Throws when the read fails, so a
 *  database error denies the fetch instead of widening it. */
export async function verifiedSiteHosts(siteId: string): Promise<string[]> {
  const paste = await getPasteConnection(siteId);
  if (paste) {
    if (paste.status !== 'active') throw new Error('paste_disconnected');
    // Includes the signed shop host, so a store that only uses its
    // .myshopify.com address still has a garment host.
    const hosts = await pasteTrustedHosts(paste);
    if (!hosts.length) return [];
    return [...hosts, ...(paste.platform === 'shopify' ? ['cdn.shopify.com'] : [])];
  }
  const { data, error } = await getMessengerServiceClient()
    .from('widget_domains')
    .select('domain, pattern')
    .eq('widget_site_id', siteId)
    .eq('verification_status', 'verified');
  if (error) throw new Error('verified_domains_unavailable');
  const hosts = new Set<string>();
  for (const row of (data ?? []) as Array<{ domain: string | null; pattern: string | null }>) {
    const host = (row.domain ?? row.pattern ?? '').trim().toLowerCase();
    if (host) hosts.add(host);
  }
  return [...hosts];
}

export type PinnedFetch = (
  target: { url: URL; address: string; family: 4 | 6 },
) => Promise<{ status: number; mime: string; body: Buffer }>;

/** HTTPS GET to a pre-checked address. The TLS name stays the URL host, the
 *  socket goes only to `address`, and a redirect is a failure. */
export const pinnedFetch: PinnedFetch = ({ url, address, family }) =>
  new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: 'https:',
        hostname: url.hostname,
        servername: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { Accept: 'image/jpeg,image/png,image/webp', 'User-Agent': 'GRINDCTRL-TryOn/1' },
        timeout: FETCH_TIMEOUT_MS,
        lookup: (_host, options, callback) => {
          if ((options as { all?: boolean }).all) {
            (callback as unknown as (e: null, a: unknown) => void)(null, [{ address, family }]);
          } else {
            callback(null, address, family);
          }
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const mime = String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        if (status !== 200) {
          response.resume();
          resolve({ status, mime, body: Buffer.alloc(0) });
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        response.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_GARMENT_BYTES) {
            request.destroy(new Error('garment_too_large'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve({ status, mime, body: Buffer.concat(chunks) }));
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error('garment_timeout')));
    request.on('error', reject);
    request.end();
  });

/** Fetches a site's garment image for generation. Re-runs the full safety
 *  check, because the job runs later than the context that signed the URL. */
export async function fetchSiteGarment(
  siteId: string,
  rawUrl: string,
  deps: { hosts?: readonly string[]; lookup?: Lookup; fetcher?: PinnedFetch } = {},
): Promise<{ mime: string; bytes: Buffer }> {
  const hosts = deps.hosts ?? (await verifiedSiteHosts(siteId));
  const target = await assertSafeGarmentUrl(rawUrl, hosts, deps.lookup);
  const result = await (deps.fetcher ?? pinnedFetch)(target);
  if (result.status !== 200) throw new Error(`Garment image fetch failed (HTTP ${result.status}).`);
  if (!IMAGE_MIME_RE.test(result.mime)) throw new Error('Garment image must be jpeg, png, or webp.');
  return { mime: result.mime, bytes: result.body };
}
