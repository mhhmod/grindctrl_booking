import { describe, expect, it } from 'vitest';
import { clientIpFromHeader } from '@/lib/pricing/geo';

/* Only the header parsing is unit-tested. The database lookup itself is a
   third-party library reading a data file — testing it would test maxmind, not
   us. What is ours, and what can silently break, is picking the right address
   out of a proxy chain. */
describe('clientIpFromHeader', () => {
  it('takes the client from the front of the chain', () => {
    expect(clientIpFromHeader('203.0.113.7, 10.0.0.1, 10.0.0.2')).toBe('203.0.113.7');
  });

  it('handles a single address', () => {
    expect(clientIpFromHeader('203.0.113.7')).toBe('203.0.113.7');
  });

  it('tolerates the whitespace real proxies emit', () => {
    expect(clientIpFromHeader('  203.0.113.7 ,10.0.0.1')).toBe('203.0.113.7');
  });

  it('returns null when the header is missing or empty', () => {
    expect(clientIpFromHeader(null)).toBeNull();
    expect(clientIpFromHeader('')).toBeNull();
    expect(clientIpFromHeader('   ')).toBeNull();
  });

  /* A header of only commas is malformed input, not an address. Returning ''
     here would send an empty string into the lookup. */
  it('returns null for a malformed chain', () => {
    expect(clientIpFromHeader(', ,')).toBeNull();
  });
});
