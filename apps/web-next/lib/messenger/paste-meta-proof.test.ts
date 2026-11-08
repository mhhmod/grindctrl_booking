// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { verifyPasteMeta } from '@/lib/paste/meta-proof';
const token = 'abcdefghijklmnopqrstuvwx';
const target = { url: new URL('https://merchant.example/'), address: '93.184.216.34', family: 4 as const };
const html = (head: string) => `<html><head>${head}</head><body></body></html>`;
const tag = `<meta name="grindctrl-verification" content="${token}">`;
const deps = (body = html(tag), status = 200, mime = 'text/html') => ({ resolve: vi.fn(async () => target),
  fetcher: vi.fn(async () => ({ body: Buffer.from(body), status, mime })) });
describe('HTTPS root meta proof', () => {
  it('checks the exact root with the existing pinned transport and matches both quoted attribute orders', async () => {
    const d = deps(); expect(await verifyPasteMeta('merchant.example', token, d)).toBe(true);
    expect(d.resolve).toHaveBeenCalledWith('https://merchant.example/', ['merchant.example']);
    expect(d.fetcher).toHaveBeenCalledWith(target);
    expect(await verifyPasteMeta('merchant.example', token, deps(html(`<meta content='${token}' name='grindctrl-verification'>`)))).toBe(true);
  });
  it.each([html(''), html(tag.replace(token, 'wrong')), html(`<!--${tag}-->`), html(`<script>const x='${tag}'</script>`),
    `<html><head></head><body>${tag}</body></html>`, html(`<meta name="grindctrl-verification" content="wrong" content="${token}">`)])('does not accept a missing or non-head proof', async (body) => {
    expect(await verifyPasteMeta('merchant.example', token, deps(body))).toBe(false);
  });
  it('rejects redirects, non-HTML and oversized pages', async () => {
    expect(await verifyPasteMeta('merchant.example', token, deps('', 301))).toBe(false);
    expect(await verifyPasteMeta('merchant.example', token, deps(html(tag), 200, 'text/plain'))).toBe(false);
    expect(await verifyPasteMeta('merchant.example', token, deps(html(tag) + 'x'.repeat(256 * 1024)))).toBe(false);
  });
  it('never fetches after an unsafe/private resolution', async () => {
    const d = deps(); d.resolve.mockRejectedValue(new Error('private_address'));
    expect(await verifyPasteMeta('merchant.example', token, d)).toBe(false); expect(d.fetcher).not.toHaveBeenCalled();
  });
});
