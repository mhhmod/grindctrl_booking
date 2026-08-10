import 'server-only';
import { open, type CountryResponse, type Reader } from 'maxmind';

/* Country lookup for pricing.

   Reads a GeoLite2 database from disk, so nothing is fetched while rendering
   and no third party is ever sent a visitor's IP address. The alternative — an
   IP geolocation API — would put a network call on the critical path of the
   pricing page and hand someone else's servers your visitors' addresses.

   geoip-lite was rejected: it bundles its dataset as an install of roughly
   150MB, and the VPS this deploys to runs near its disk limit.

   EVERY failure path returns null and the caller falls back to USD. A missing
   database file, an unparseable address, a country absent from the data — none
   of them may take the pricing page down.

   TO ENABLE DETECTION (it is inert until this is done):

   1. Create a free MaxMind account and download GeoLite2-Country.mmdb.
   2. Put it on the server, e.g. /root/grindctrl-next/geo/GeoLite2-Country.mmdb
   3. Bind-mount that directory into the container in docker-compose.yml, and
      set GEOLITE2_COUNTRY_DB to the path it lands on inside the container.

   Deliberately NOT baked into the Dockerfile with a COPY: the file is not in
   the repo, and an unconditional COPY of a missing file fails the image build.
   A pricing feature must not be able to break the deploy.

   The database is refreshed by MaxMind roughly weekly. A stale copy makes
   detection less accurate; it never makes it wrong in a way that matters,
   because the visitor can always override with the switcher. */

const DB_PATH = process.env.GEOLITE2_COUNTRY_DB ?? '/app/geo/GeoLite2-Country.mmdb';

let readerPromise: Promise<Reader<CountryResponse> | null> | null = null;

function getReader(): Promise<Reader<CountryResponse> | null> {
  /* Cached across requests. Opening the database per request would read the
     whole file for every page view. */
  readerPromise ??= open<CountryResponse>(DB_PATH).catch(() => null);
  return readerPromise;
}

/* x-forwarded-for is a comma-separated chain and the client is the first
   entry. The app already reads it this way for rate limiting in
   app/api/try-on/generate/route.ts. */
export function clientIpFromHeader(forwardedFor: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim();
  return first ? first : null;
}

export async function countryFromIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;

  try {
    const reader = await getReader();
    return reader?.get(ip)?.country?.iso_code ?? null;
  } catch {
    return null;
  }
}

/* Addresses no geo service can place: loopback, RFC1918 private ranges, and
   the CGNAT block. Behind Traefik these appear when the chain is misread, and
   asking a remote service about 10.0.0.1 wastes a call to learn nothing. */
export function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('127.') || ip.startsWith('169.254.')) return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;

  const octets = ip.split('.').map(Number);
  if (octets.length === 4 && octets.every((n) => Number.isInteger(n))) {
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return true;
  }

  /* IPv6 unique-local. */
  return /^f[cd]/i.test(ip);
}

const COUNTRY_TTL_MS = 24 * 60 * 60 * 1000;
const countryCache = new Map<string, { country: string | null; at: number }>();

/* Remote IP lookup, used only when the local database is unavailable.

   Chosen with the owner after the header-based fallback proved too weak: most
   browsers send a bare "ar" or "en" with no region, so Accept-Language could
   not place an Egyptian visitor at all.

   The tradeoff, stated plainly: this service sees visitor IP addresses. The
   local GeoLite2 database does not, and takes priority whenever it is present
   — drop the file in and this stops being called.

   Hard timeout because this runs during server render. A slow third party must
   degrade to USD, never hold the page. Results cache for a day so repeat
   visitors cost nothing. */
export async function countryFromIpApi(ip: string | null): Promise<string | null> {
  if (!ip || isPrivateIp(ip)) return null;

  const hit = countryCache.get(ip);
  if (hit && Date.now() - hit.at < COUNTRY_TTL_MS) return hit.country;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code`, {
      signal: controller.signal,
      cache: 'no-store',
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return null;

    const data = (await res.json()) as { success?: boolean; country_code?: string };
    const country = data.success && data.country_code ? data.country_code.toUpperCase() : null;

    countryCache.set(ip, { country, at: Date.now() });
    return country;
  } catch {
    /* Timeout, abort, DNS failure, rate limit, malformed JSON — all the same
       answer: we do not know, so the caller falls back. */
    return null;
  }
}
