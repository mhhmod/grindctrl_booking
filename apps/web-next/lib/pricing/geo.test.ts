import { describe, expect, it } from 'vitest';
import { clientIpFromHeader, isPrivateIp } from '@/lib/pricing/geo';

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

/* Guards the remote lookup. Asking a geo service about 10.0.0.1 spends a call
   to learn nothing, and behind a reverse proxy these turn up whenever the
   forwarded chain is misread. */
describe('isPrivateIp', () => {
  it('catches loopback and link-local', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('169.254.1.1')).toBe(true);
  });

  it('catches the RFC1918 ranges', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
  });

  /* 172.15 and 172.32 sit outside the private block and are ordinary public
     addresses — a range check that used startsWith('172.') would wrongly skip
     real visitors. */
  it('does not over-match the 172 block', () => {
    expect(isPrivateIp('172.15.0.1')).toBe(false);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
  });

  it('catches CGNAT', () => {
    expect(isPrivateIp('100.64.0.1')).toBe(true);
    expect(isPrivateIp('100.63.0.1')).toBe(false);
  });

  it('catches IPv6 unique-local', () => {
    expect(isPrivateIp('fd00::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
  });

  it('passes real public addresses through', () => {
    expect(isPrivateIp('41.44.1.1')).toBe(false);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('2a02:4780::1')).toBe(false);
  });
});
