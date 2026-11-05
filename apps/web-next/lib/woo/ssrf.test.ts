// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isPublicAddress, parsePairedHomeUrl } from './ssrf';

describe('isPublicAddress', () => {
  it.each(['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111'])('allows %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '100.64.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:10.1.2.3',
    '::ffff:7f00:1',
    '0:0:0:0:0:ffff:a00:1',
    '0:0:0:0:0:0:0:1',
    '::127.0.0.1',
    '64:ff9b:1::a00:1',
    '2002:7f00:1::',
    '2001:db8::1',
    'not-an-ip',
    '',
  ])('refuses %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it('allows a public address in IPv4-mapped form', () => {
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
  });
});

describe('parsePairedHomeUrl', () => {
  it('accepts an https site, with or without a subdirectory', () => {
    expect(parsePairedHomeUrl('https://shop.example.com')?.origin).toBe('https://shop.example.com');
    expect(parsePairedHomeUrl('https://example.com/store')?.pathname).toBe('/store');
  });

  it.each([
    'http://shop.example.com',
    'https://user:pw@shop.example.com',
    'https://shop.example.com/?a=1',
    'https://shop.example.com/#x',
    'https://127.0.0.1',
    'https://[::1]',
    'https://10.0.0.5',
    'https://[::ffff:7f00:1]',
    'https://shop.example.com:8443',
    'ftp://shop.example.com',
    'not a url',
    42,
    null,
  ])('refuses %s', (value) => {
    expect(parsePairedHomeUrl(value)).toBeNull();
  });
});
