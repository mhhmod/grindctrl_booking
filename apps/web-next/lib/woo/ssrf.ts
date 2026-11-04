import 'server-only';

import { isIP } from 'node:net';
import { promises as dns } from 'node:dns';
import { request as httpsRequest } from 'node:https';

/* Outbound calls to a merchant's WordPress site. The host is merchant
   controlled, so the connection is made to an address we resolved and
   checked ourselves: every resolved address must be public, and the socket
   connects to exactly that address (no second lookup to rebind). */

function ipv4Public(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  return true;
}

/** True only for globally routable unicast addresses. */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return ipv4Public(ip);
  if (family !== 6) return false;
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^(?:0{0,4}:){0,5}:?ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isIP(mapped[1]) === 4 && ipv4Public(mapped[1]);
  if (lower === '::' || lower === '::1') return false;
  const first = parseInt(lower.split(':')[0] || '0', 16);
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (lower.startsWith('64:ff9b:') || lower.startsWith('2001:db8:')) return false;
  return true;
}

/** https only, no credentials, query or fragment; the base the plugin was
 *  paired with (path allowed for sites in a subdirectory). */
export function parsePairedHomeUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (isIP(url.hostname.replace(/^\[|\]$/g, '')) !== 0 && !isPublicAddress(url.hostname.replace(/^\[|\]$/g, ''))) return null;
    return url;
  } catch {
    return null;
  }
}

export type PinnedPostInput = {
  url: URL;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
  maxBytes: number;
};

export type PinnedPostResult = { status: number; contentType: string; body: string } | null;

/** POST over TLS to a checked address. Returns null on any network failure,
 *  refused address, timeout or oversize body. Never follows redirects. */
export function pinnedHttpsPost(input: PinnedPostInput): Promise<PinnedPostResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: PinnedPostResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const host = input.url.hostname.replace(/^\[|\]$/g, '');
    const req = httpsRequest(
      {
        protocol: 'https:',
        host,
        servername: isIP(host) ? undefined : host,
        port: input.url.port || 443,
        path: input.url.pathname + input.url.search,
        method: 'POST',
        headers: { ...input.headers, 'content-length': String(Buffer.byteLength(input.body)) },
        lookup: (hostname, options, callback) => {
          dns
            .lookup(hostname, { all: true, verbatim: true })
            .then((addresses) => {
              const usable = addresses.length > 0 && addresses.every((entry) => isPublicAddress(entry.address));
              if (!usable) return callback(new Error('address refused') as NodeJS.ErrnoException, '', 4);
              // Node 20+ may ask for the list form; the pinned address is the same.
              if (options && (options as { all?: boolean }).all) {
                (callback as unknown as (e: null, a: unknown) => void)(null, [addresses[0]]);
                return;
              }
              callback(null, addresses[0].address, addresses[0].family);
            })
            .catch((error) => callback(error as NodeJS.ErrnoException, '', 4));
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > input.maxBytes) {
            req.destroy();
            finish(null);
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          finish({
            status: res.statusCode ?? 0,
            contentType: String(res.headers['content-type'] ?? ''),
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
        res.on('error', () => finish(null));
      },
    );
    const timer = setTimeout(() => {
      req.destroy();
      finish(null);
    }, input.timeoutMs);
    req.on('error', () => finish(null));
    req.end(input.body);
  });
}
