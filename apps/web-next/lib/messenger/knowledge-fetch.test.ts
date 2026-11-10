// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { readPrefix, type StorefrontLookup, type StorefrontRequest, type StorefrontResponse, type StorefrontTransport } from '@/lib/paste/storefront-scan';
import { fetchUrlKnowledge } from './knowledge';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));

const PAGE = '<html><head><title>Shipping policy</title></head><body><p>We ship every order within two working days, with free returns for thirty days.</p></body></html>';

function page(body = PAGE, extra: Partial<StorefrontResponse> = {}): StorefrontResponse {
  return { status: 200, location: null, contentType: 'text/html', setCookie: [], body: Buffer.from(body), ...extra };
}

/** DNS as the attacker would like it: names chosen per test. */
function dns(answers: Record<string, string[]>): StorefrontLookup {
  return async (host) => (answers[host] ?? []).map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
}

describe('knowledge URL fetch (G11)', () => {
  it('reads a public page through the pinned transport, capping the body', async () => {
    const transport = vi.fn<StorefrontTransport>(async () => page());
    const result = await fetchUrlKnowledge('https://shop.example/policies/shipping', { transport, lookup: dns({ 'shop.example': ['93.184.216.34'] }) });
    expect(result).toEqual({ title: 'Shipping policy', content: expect.stringContaining('two working days') });
    const request = transport.mock.calls[0][0] as StorefrontRequest;
    expect(request.address).toBe('93.184.216.34');
    expect(request.url.toString()).toBe('https://shop.example/policies/shipping');
    expect(request.truncateAt).toBe(400_000);
  });

  it.each([
    ['a name resolving to a private address', { 'intranet.example': ['10.0.0.5'] }],
    ['a name with one private answer among public ones (rebinding)', { 'intranet.example': ['93.184.216.34', '169.254.169.254'] }],
    ['a name resolving to IPv6 loopback', { 'intranet.example': ['::1'] }],
  ])('refuses %s without connecting', async (_label, answers) => {
    const transport = vi.fn<StorefrontTransport>(async () => page());
    await expect(fetchUrlKnowledge('https://intranet.example/', { transport, lookup: dns(answers) }))
      .rejects.toThrow('That address is not reachable from the public internet.');
    expect(transport).not.toHaveBeenCalled();
  });

  it('checks the target of every redirect again', async () => {
    const transport = vi.fn<StorefrontTransport>(async () => page('', { status: 302, location: 'https://metadata.example/latest' }));
    await expect(fetchUrlKnowledge('https://shop.example/', {
      transport, lookup: dns({ 'shop.example': ['93.184.216.34'], 'metadata.example': ['169.254.169.254'] }),
    })).rejects.toThrow('not reachable from the public internet');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each(['http://shop.example/', 'https://127.0.0.1/', 'https://shop.example:8443/', 'https://user:pass@shop.example/'])(
    'refuses %s before any lookup', async (url) => {
      const lookup = vi.fn<StorefrontLookup>();
      await expect(fetchUrlKnowledge(url, { transport: vi.fn(), lookup })).rejects.toThrow();
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it('keeps only the first 400 KB a transport returns', async () => {
    const long = `<title>Big</title>${'<p>Lots of readable text about sizing.</p>'.repeat(20_000)}`;
    const transport = vi.fn<StorefrontTransport>(async () => page(long));
    const result = await fetchUrlKnowledge('https://shop.example/', { transport, lookup: dns({ 'shop.example': ['93.184.216.34'] }) });
    expect(result.title).toBe('Big');
    expect(result.content.length).toBeLessThanOrEqual(15_000);
  });

  it('stops reading a streamed body at the cap instead of buffering it whole', async () => {
    let produced = 0;
    const endless = new Readable({
      read() {
        produced += 64 * 1024;
        this.push(Buffer.alloc(64 * 1024, 0x61));
      },
    });
    const body = await readPrefix(endless, 100_000);
    expect(body.length).toBe(100_000);
    expect(produced).toBeLessThan(1024 * 1024);
    expect(endless.destroyed).toBe(true);
  });

  it('refuses a page that is not text', async () => {
    const transport = vi.fn<StorefrontTransport>(async () => page('x', { contentType: 'application/pdf' }));
    await expect(fetchUrlKnowledge('https://shop.example/', { transport, lookup: dns({ 'shop.example': ['93.184.216.34'] }) }))
      .rejects.toThrow('does not look like a readable page');
  });
});
