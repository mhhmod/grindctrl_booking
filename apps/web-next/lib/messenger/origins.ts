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
  /** The site's own connected store domain, when it has one. */
  siteDomain?: string | null;
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

  /* A store's own connected domain is its storefront, so it needs no separate
     verified widget_domains row. Requiring one meant a freshly installed
     Shopify store — which starts with zero domain rows — served the block
     correctly and then had its config refused with origin_not_allowed, so the
     launcher never rendered and the merchant saw "nothing in the store at
     all". This is not a widening of trust: widget_sites.domain is bound by a
     unique index and set only through the owner-verified claim/provisioning
     path, so matching it proves the request came from the very store the site
     belongs to. Custom storefront domains are a different claim and still
     require explicit verification below. */
  if (input.siteDomain && hostname === normalizeHost(input.siteDomain)) {
    return { allowed: true };
  }

  const verified = input.patterns.some(
    (row) =>
      row.verification_status === 'verified' &&
      matchesDomainPattern(row.pattern, hostname),
  );
  return verified ? { allowed: true } : { allowed: false, reason: 'unverified_origin' };
}
