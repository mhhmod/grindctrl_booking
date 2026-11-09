// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const paste = vi.hoisted(() => ({ connection: vi.fn(), hosts: vi.fn(), platforms: vi.fn() }));
vi.mock('@/lib/paste/store', async (original) => ({ ...await original<object>(),
  getPasteConnection: paste.connection, pasteTrustedHosts: paste.hosts, readPasteDomainPlatforms: paste.platforms }));

vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: vi.fn() }));

import {
  assertSafeGarmentUrl,
  checkGarmentUrl,
  fetchSiteGarment,
  isNonPublicAddress,
  siteGarmentHosts,
  MAX_GARMENT_BYTES,
  UnsafeGarmentUrlError,
} from './garment-url';

const HOSTS = ['shop.example.com'];
const PUBLIC = [{ address: '93.184.216.34', family: 4 }];

beforeEach(() => {
  paste.connection.mockResolvedValue({ platform: 'website', status: 'active' });
  paste.hosts.mockResolvedValue(HOSTS);
  paste.platforms.mockResolvedValue([
    { domain: HOSTS[0], platform: 'easyorders' }, { domain: 'other.example', platform: 'wix' },
  ]);
});

describe('generation platform scope', () => {
  it('re-checks only the signed page domain, including its www alias', async () => {
    const hosts = await siteGarmentHosts('site', `https://www.${HOSTS[0]}`);
    expect(checkGarmentUrl('https://files.easy-orders.net/1.jpeg', hosts)).not.toBeNull();
    expect(checkGarmentUrl('https://static.wixstatic.com/1.jpeg', hosts)).toBeNull();
    for (const origin of ['', 'https://unknown.example', `http://${HOSTS[0]}`]) {
      expect(checkGarmentUrl('https://files.easy-orders.net/1.jpeg', await siteGarmentHosts('site', origin))).toBeNull();
    }
    paste.platforms.mockResolvedValue(null);
    expect(checkGarmentUrl('https://files.easy-orders.net/1.jpeg', await siteGarmentHosts('site', `https://${HOSTS[0]}`))).toBeNull();
  });

  it('does not fetch a platform garment without the signed origin, or after a platform change', async () => {
    const fetcher = vi.fn();
    const deps = { lookup: async () => PUBLIC, fetcher };
    await expect(fetchSiteGarment('site', 'https://files.easy-orders.net/1.jpeg', deps)).rejects.toMatchObject({ code: 'host_not_allowed' });
    paste.platforms.mockResolvedValue([{ domain: HOSTS[0], platform: 'wix' }]);
    await expect(fetchSiteGarment('site', 'https://files.easy-orders.net/1.jpeg', { ...deps, pageOrigin: `https://${HOSTS[0]}` }))
      .rejects.toMatchObject({ code: 'host_not_allowed' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('isNonPublicAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fc00::1',
    'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'ff02::1', 'not-an-ip',
  ])('refuses %s', (address) => {
    expect(isNonPublicAddress(address)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:2800:220:1:248:1893:25c8:1946'])(
    'allows %s',
    (address) => {
      expect(isNonPublicAddress(address)).toBe(false);
    },
  );
});

describe('checkGarmentUrl', () => {
  it('accepts a verified host, its subdomains and the listed image CDNs', () => {
    expect(checkGarmentUrl('https://shop.example.com/a.jpg', HOSTS)).not.toBeNull();
    expect(checkGarmentUrl('https://cdn.shop.example.com/a.jpg', HOSTS)).not.toBeNull();
    expect(checkGarmentUrl('https://i0.wp.com/shop.example.com/a.jpg', HOSTS)).not.toBeNull();
  });

  it.each([
    'http://shop.example.com/a.jpg',
    'https://user:pw@shop.example.com/a.jpg',
    'https://shop.example.com:8443/a.jpg',
    'https://evilshop.example.com.attacker.test/a.jpg',
    'https://notshop.example.com/a.jpg',
    'https://example.com/a.jpg',
    'https://127.0.0.1/a.jpg',
    'https://[::1]/a.jpg',
    'https://localhost/a.jpg',
    'https://i3.wp.com/a.jpg',
    'not a url',
  ])('refuses %s', (url) => {
    expect(checkGarmentUrl(url, HOSTS)).toBeNull();
  });

  it('refuses everything when the site has no verified host and the URL is not on a CDN', () => {
    expect(checkGarmentUrl('https://shop.example.com/a.jpg', [])).toBeNull();
  });

  it('matches platform image servers exactly: no subdomain, lookalike, http or other port', () => {
    const allowed = { site: HOSTS, exact: ['files.easy-orders.net'] };
    expect(checkGarmentUrl('https://files.easy-orders.net/1.jpeg', allowed)).not.toBeNull();
    expect(checkGarmentUrl('https://files.easy-orders.net:443/1.jpeg', allowed)).not.toBeNull();
    expect(checkGarmentUrl('https://cdn.shop.example.com/a.jpg', allowed)).not.toBeNull();
    for (const url of ['https://x.files.easy-orders.net/1.jpeg', 'https://files.easy-orders.net.evil.com/1.jpeg',
      'https://evil-files.easy-orders.net/1.jpeg', 'http://files.easy-orders.net/1.jpeg', 'https://files.easy-orders.net:8443/1.jpeg']) {
      expect(checkGarmentUrl(url, allowed)).toBeNull();
    }
    expect(checkGarmentUrl('https://files.easy-orders.net/1.jpeg', HOSTS)).toBeNull();
  });
});

describe('assertSafeGarmentUrl', () => {
  it('returns the checked address to pin to', async () => {
    const target = await assertSafeGarmentUrl('https://shop.example.com/a.jpg', HOSTS, async () => PUBLIC);
    expect(target).toMatchObject({ address: '93.184.216.34', family: 4 });
  });

  it('refuses a host that resolves to a private, loopback or metadata address', async () => {
    for (const address of ['10.0.0.5', '127.0.0.1', '169.254.169.254', '::1']) {
      await expect(
        assertSafeGarmentUrl('https://shop.example.com/a.jpg', HOSTS, async () => [{ address, family: address.includes(':') ? 6 : 4 }]),
      ).rejects.toMatchObject({ code: 'private_address' });
    }
  });

  it('refuses a mixed answer where any address is private (rebinding setup)', async () => {
    await expect(
      assertSafeGarmentUrl('https://shop.example.com/a.jpg', HOSTS, async () => [
        ...PUBLIC,
        { address: '10.0.0.5', family: 4 },
      ]),
    ).rejects.toBeInstanceOf(UnsafeGarmentUrlError);
  });

  it('refuses an unresolvable host and a host outside the allowlist', async () => {
    await expect(
      assertSafeGarmentUrl('https://shop.example.com/a.jpg', HOSTS, async () => {
        throw new Error('ENOTFOUND');
      }),
    ).rejects.toMatchObject({ code: 'unresolvable' });
    const lookup = vi.fn(async () => PUBLIC);
    await expect(assertSafeGarmentUrl('https://other.test/a.jpg', HOSTS, lookup)).rejects.toMatchObject({
      code: 'host_not_allowed',
    });
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('fetchSiteGarment', () => {
  const deps = (over: Partial<Parameters<typeof fetchSiteGarment>[2]> = {}) => ({
    hosts: HOSTS,
    lookup: async () => PUBLIC,
    ...over,
  });

  it('pins the request to the checked address and returns the image', async () => {
    const fetcher = vi.fn(async () => ({ status: 200, mime: 'image/png', body: Buffer.from([1, 2, 3]) }));
    const result = await fetchSiteGarment('site', 'https://shop.example.com/a.png', deps({ fetcher }));
    expect(result.mime).toBe('image/png');
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ address: '93.184.216.34' }));
  });

  it('runs platform photos through the same pinned fetch, redirect, type and size limits', async () => {
    const url = 'https://files.easy-orders.net/1.jpeg';
    const allowed = { ...deps(), hosts: { site: HOSTS, exact: ['files.easy-orders.net'] } };
    const fetcher = vi.fn(async () => ({ status: 200, mime: 'image/jpeg', body: Buffer.from([1]) }));
    await expect(fetchSiteGarment('site', url, { ...allowed, fetcher })).resolves.toMatchObject({ mime: 'image/jpeg' });
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ address: PUBLIC[0].address, url: new URL(url) }));
    for (const result of [
      { status: 302, mime: 'image/jpeg', body: Buffer.alloc(0) },
      { status: 200, mime: 'text/html', body: Buffer.from('html') },
      { status: 200, mime: 'image/jpeg', body: Buffer.alloc(MAX_GARMENT_BYTES + 1) },
    ]) {
      await expect(fetchSiteGarment('site', url, { ...allowed, fetcher: async () => result })).rejects.toThrow();
    }
    await expect(fetchSiteGarment('site', url, { ...allowed, fetcher,
      lookup: async () => [...PUBLIC, { address: '169.254.169.254', family: 4 }] })).rejects.toMatchObject({ code: 'private_address' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('treats a redirect or error status as a failure and never follows it', async () => {
    const fetcher = vi.fn(async () => ({ status: 302, mime: '', body: Buffer.alloc(0) }));
    await expect(fetchSiteGarment('site', 'https://shop.example.com/a.png', deps({ fetcher }))).rejects.toThrow(
      /HTTP 302/,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refuses a non-image response', async () => {
    const fetcher = async () => ({ status: 200, mime: 'text/html', body: Buffer.from('x') });
    await expect(fetchSiteGarment('site', 'https://shop.example.com/a.png', deps({ fetcher }))).rejects.toThrow(
      /jpeg, png, or webp/,
    );
  });

  it('does not fetch when the host now resolves to a private address', async () => {
    const fetcher = vi.fn();
    await expect(
      fetchSiteGarment(
        'site',
        'https://shop.example.com/a.png',
        deps({ fetcher, lookup: async () => [{ address: '10.0.0.9', family: 4 }] }),
      ),
    ).rejects.toBeInstanceOf(UnsafeGarmentUrlError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
