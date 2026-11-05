import { parsePairedHomeUrl } from './ssrf';

/** WordPress may expose REST through a pretty path or ?rest_route=/. Only
 * accept the paired HTTPS origin; this is routing metadata, not authority. */
export function normalizeWooRestBase(homeUrl: string, value: unknown): string | null {
  const home = parsePairedHomeUrl(homeUrl);
  if (!home || typeof value !== 'string' || value.length > 2048) return null;
  try {
    const base = new URL(value);
    if (base.origin !== home.origin || base.username || base.password || base.hash) return null;
    const keys = [...base.searchParams.keys()];
    if (keys.length && (keys.length !== 1 || keys[0] !== 'rest_route' || base.searchParams.get('rest_route') !== '/')) return null;
    if (!keys.length && !base.pathname.endsWith('/')) return null;
    return base.toString();
  } catch {
    return null;
  }
}
