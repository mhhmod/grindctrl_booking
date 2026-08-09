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
