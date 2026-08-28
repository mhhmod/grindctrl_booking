import 'server-only';

/* Storefront origin authorization. A widget_site's public config may be
   requested by anyone holding the embed key (it is an identifier, like
   Intercom's app_id), so privileged behavior must never hinge on the embed
   key alone. The loader reports its page origin; we admit it only when it
   matches a verified domain pattern for the site — or localhost when the
   site's security.allow_localhost flag permits development use.
   Anonymous chat on a mismatched origin fails closed; there is no config
   leak beyond "not allowed". */

export interface DomainPatternRow {
  pattern: string;
  verification_status: string;
  environment: string;
}

export interface SiteSecuritySettings {
  allow_localhost?: boolean;
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase();
}

/** Pattern match: exact host, or "*.suffix" subdomain-wide. */
export function matchesDomainPattern(pattern: string, hostname: string): boolean {
  const p = pattern.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const h = normalizeHost(hostname);
  if (!p || !h) return false;
  if (p === h) return true;
  if (p.startsWith('*.')) {
    const suffix = p.slice(1); // ".example.com"
    return h.endsWith(suffix) && h.length > suffix.length;
  }
  return false;
}

export type OriginDecision =
  | { allowed: true }
  | { allowed: false; reason: 'unverified_origin' | 'disallowed_scheme' };

export function decideOrigin(input: {
  origin: string | null | undefined;
  patterns: readonly DomainPatternRow[];
  security: SiteSecuritySettings | null | undefined;
}): OriginDecision {
  if (!input.origin) return { allowed: false, reason: 'unverified_origin' };

  let url: URL;
  try {
    url = new URL(input.origin);
  } catch {
    return { allowed: false, reason: 'disallowed_scheme' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { allowed: false, reason: 'disallowed_scheme' };
  }

  const hostname = normalizeHost(url.hostname);
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0';

  if (isLocal) {
    return input.security?.allow_localhost === true
      ? { allowed: true }
      : { allowed: false, reason: 'unverified_origin' };
  }

  const verified = input.patterns.some(
    (row) =>
      row.verification_status === 'verified' &&
      matchesDomainPattern(row.pattern, hostname),
  );
  return verified ? { allowed: true } : { allowed: false, reason: 'unverified_origin' };
}
