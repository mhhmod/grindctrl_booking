import { describe, expect, it } from 'vitest';
import { decideOrigin, matchesDomainPattern } from './origins';

const PATTERNS = [
  { pattern: 'store.example.com', verification_status: 'verified', environment: 'production' },
  { pattern: '*.shops.example.com', verification_status: 'verified', environment: 'production' },
  { pattern: 'unverified.example.com', verification_status: 'pending', environment: 'production' },
];

describe('matchesDomainPattern', () => {
  it('matches exact hosts case-insensitively', () => {
    expect(matchesDomainPattern('Store.Example.com', 'store.example.com')).toBe(true);
  });

  it('supports wildcard subdomains one level deep', () => {
    expect(matchesDomainPattern('*.shops.example.com', 'a.shops.example.com')).toBe(true);
    expect(matchesDomainPattern('*.shops.example.com', 'shops.example.com')).toBe(false);
  });

  it('does not do suffix spoofing', () => {
    expect(matchesDomainPattern('store.example.com', 'evilstores.example.com')).toBe(false);
    expect(matchesDomainPattern('*.example.com', 'notexample.com')).toBe(false);
  });
});

describe('decideOrigin', () => {
  it('admits verified https origins', () => {
    expect(decideOrigin({ origin: 'https://store.example.com', patterns: PATTERNS, security: {} })).toEqual({
      allowed: true,
    });
  });

  it('rejects unverified origins without leaking config', () => {
    const decision = decideOrigin({ origin: 'https://evil.com', patterns: PATTERNS, security: {} });
    expect(decision).toEqual({ allowed: false, reason: 'unverified_origin' });
  });

  it('gates localhost behind the explicit flag', () => {
    const base = { origin: 'http://localhost:3000', patterns: PATTERNS };
    expect(decideOrigin({ ...base, security: { allow_localhost: false } }).allowed).toBe(false);
    expect(decideOrigin({ ...base, security: { allow_localhost: true } }).allowed).toBe(true);
  });

  it('rejects non-web schemes and malformed origins', () => {
    expect(decideOrigin({ origin: 'file:///etc/passwd', patterns: PATTERNS, security: { allow_localhost: true } })).toEqual({
      allowed: false,
      reason: 'disallowed_scheme',
    });
    expect(decideOrigin({ origin: 'not a url', patterns: PATTERNS, security: {} }).allowed).toBe(false);
    expect(decideOrigin({ origin: null, patterns: PATTERNS, security: {} }).allowed).toBe(false);
  });

  /* Regression: a freshly installed Shopify store has zero widget_domains
     rows, so its own storefront was refused with origin_not_allowed and the
     widget never rendered — the block was enabled and the store showed
     nothing. The connected domain is bound by a unique index through the
     owner-verified claim path, so it is the store itself, not an unverified
     third party. */
  it('allows the store its own connected domain with no verified domain rows', () => {
    const site = { patterns: [], security: {}, siteDomain: 'grindctrl.myshopify.com' };

    expect(decideOrigin({ ...site, origin: 'https://grindctrl.myshopify.com' }).allowed).toBe(true);
    // Host comparison is normalized, not string equality on the origin.
    expect(decideOrigin({ ...site, origin: 'https://GRINDCTRL.myshopify.com' }).allowed).toBe(true);
  });

  it('does not let the store domain become a wildcard for other origins', () => {
    const site = { patterns: [], security: {}, siteDomain: 'grindctrl.myshopify.com' };

    // A different shop, a lookalike suffix, and a subdomain are all still
    // unverified — only the exact connected host is implied.
    expect(decideOrigin({ ...site, origin: 'https://attacker.myshopify.com' }).allowed).toBe(false);
    expect(decideOrigin({ ...site, origin: 'https://evil-grindctrl.myshopify.com' }).allowed).toBe(false);
    expect(decideOrigin({ ...site, origin: 'https://x.grindctrl.myshopify.com' }).allowed).toBe(false);
    expect(decideOrigin({ ...site, origin: 'https://grindctrl.myshopify.com.evil.com' }).allowed).toBe(false);
  });

  it('changes nothing for a site with no connected domain', () => {
    expect(
      decideOrigin({ origin: 'https://anything.com', patterns: [], security: {}, siteDomain: null }).allowed,
    ).toBe(false);
  });
});
