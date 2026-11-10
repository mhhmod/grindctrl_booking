// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectPlatform, isDetectedPlatform, type DetectedPlatform } from './platform-detect';
import { PLATFORM_IMAGE_HOSTS, platformImageHosts } from './platform-image-hosts';

const page = (head: string, body = '', html = '<html>') => `<!doctype html>${html}<head>${head}</head><body>${body}</body></html>`;
const STORE = 'https://shop.example/';

describe('detectPlatform', () => {
  it.each<[string, DetectedPlatform, { url?: string; html: string; headers?: Record<string, string> }]>([
    ['EasyOrders store host', 'easyorders', { url: 'https://layla.myeasyorders.com/', html: page('') }],
    ['EasyOrders assets and images on a custom domain', 'easyorders', {
      html: page('<script src="https://cdn.easy-orders.net/_next/static/chunks/main.js" defer></script>',
        '<img src="https://files.easy-orders.net/1715000000123.jpeg">') }],
    ['EasyOrders photos in JSON-escaped Next.js data', 'easyorders', {
      html: page('', '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"appSettings":{},"img":"https:\\/\\/flles.easy-orders.net\\/9.jpeg"}}}</script>') }],
    ['Shopify CDN and theme object', 'shopify', {
      html: page('<script>Shopify.theme = {"name":"Dawn"};</script>', '<img src="//cdn.shopify.com/s/files/1/a.jpg">') }],
    ['Shopify on its own domain (/cdn/shop/ paths)', 'shopify', { html: page('', '<img src="/cdn/shop/files/linen.jpg?v=1">') }],
    ['Shopify by header', 'shopify', { html: page(''), headers: { 'X-ShopId': '123456' } }],
    ['WooCommerce plugin assets', 'woocommerce', {
      html: page('<link rel="stylesheet" href="https://shop.example/wp-content/plugins/woocommerce/assets/css/woocommerce.css">') }],
    ['WooCommerce body class', 'woocommerce', { html: page('', '', '<html>').replace('<body>', '<body class="home woocommerce-js">') }],
    ['Salla CDN', 'salla', { html: page('', '<img src="https://cdn.salla.sa/XyZ/dress.jpg">') }],
    ['Salla scripts', 'salla', { html: page('<script src="https://cdn.assets.salla.sa/themes/twilight.js"></script>') }],
    ['Zid media', 'zid', { html: page('', '<img src="https://media.zid.store/a1b2/qamees.jpg">') }],
    ['Zid scripts', 'zid', { html: page('<script src="https://assets.zid.store/app.js"></script>') }],
    ['Wix static media', 'wix', { html: page('', '<img src="https://static.wixstatic.com/media/84770f_ribbed~mv2.jpg">') }],
    ['Wix by header', 'wix', { html: page(''), headers: { 'x-wix-request-id': '1712345.678' } }],
    ['Squarespace images', 'squarespace', { html: page('', '<img src="https://images.squarespace-cdn.com/content/v1/5f1/a.jpg">') }],
    ['Squarespace static', 'squarespace', { html: page('<script src="https://static1.squarespace.com/static/vta/x.js"></script>') }],
    ['Webflow site attribute', 'webflow', { html: page('', '', '<html data-wf-site="64b0e1" data-wf-page="64b0e2">') }],
    ['Webflow files', 'webflow', { html: page('', '<img src="https://cdn.prod.website-files.com/64b/64c_tote.jpg">') }],
    ['YouCan CDN', 'youcan', { html: page('', '<img src="https://cdn.youcan.shop/stores/abc/products/a.jpg">') }],
  ])('%s: %s', (_name, platform, input) => {
    const result = detectPlatform({ url: input.url ?? STORE, html: input.html, headers: input.headers });
    expect(result.platform).toBe(platform);
    expect(result.signals.some((signal) => signal.startsWith(`${platform}:`))).toBe(true);
  });

  it.each<[string, { url?: string; html: string; headers?: Record<string, string> }]>([
    ['a plain page', { html: page('<title>Shop</title>', '<img src="https://shop.example/a.jpg">') }],
    ['any Next.js app (weak signal only)', {
      html: page('', '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"appSettings":{"x":1}}}}</script>') }],
    ['WordPress without WooCommerce (weak signal only)', { html: page('<link rel="stylesheet" href="/wp-content/themes/astra/style.css">') }],
    ['two platforms with equal evidence (a Wix page showing a Shopify buy button)', {
      html: page('', '<img src="https://static.wixstatic.com/media/a.jpg"><img src="https://cdn.shopify.com/s/files/b.jpg">') }],
    ['lookalike hosts', { html: page('', '<img src="https://files.easy-orders.net.evil.com/a.jpg"><img src="https://evil-wixstatic.com/a.jpg">'
      + '<img src="https://notcdn.shopify.com.evil.com/a.jpg"><img src="https://x.static.wixstatic.com.evil/b.jpg">') }],
    ['platform names in text only', { html: page('', '<p>We moved from Shopify.com and Wix to our own site. static.wixstatic.com</p>') }],
    ['the platform host itself as the store (not a subdomain)', { url: 'https://easy-orders.net/', html: page('') }],
    ['a lookalike store host', { url: 'https://shop.myeasyorders.com.evil.com/', html: page('') }],
  ])('%s: custom', (_name, input) => {
    expect(detectPlatform({ url: input.url ?? STORE, html: input.html, headers: input.headers }).platform).toBe('custom');
  });

  it('names the platform with clearly more evidence when another one appears once', () => {
    const html = page('<script src="https://cdn.easy-orders.net/_next/static/chunks/main.js"></script>',
      '<img src="https://files.easy-orders.net/1.jpeg"><img src="https://cdn.shopify.com/s/files/b.jpg">');
    expect(detectPlatform({ url: STORE, html })).toMatchObject({ platform: 'easyorders',
      signals: expect.arrayContaining(['easyorders:asset_cdn', 'easyorders:image_host', 'shopify:cdn']) });
  });

  it('recognises the EasyOrders fixture page (real markup)', () => {
    const html = readFileSync('testing/paste-fixtures/easyorders-like.html', 'utf8');
    expect(detectPlatform({ url: 'https://layla-store.com/products/DRESSA14', html }).platform).toBe('easyorders');
  });

  it('knows exactly the stored platform values', () => {
    expect(['easyorders', 'custom', 'youcan'].every(isDetectedPlatform)).toBe(true);
    expect(['EasyOrders', 'magento', '', null].some(isDetectedPlatform)).toBe(false);
  });
});

describe('platform image hosts', () => {
  it('lists exact hostnames only for platforms whose photos live off the store host', () => {
    expect(platformImageHosts('easyorders')).toEqual(['files.easy-orders.net', 'flles.easy-orders.net', 'cdn.easy-orders.net']);
    for (const platform of ['shopify', 'woocommerce', 'custom', null] as const) expect(platformImageHosts(platform)).toEqual([]);
    for (const hosts of Object.values(PLATFORM_IMAGE_HOSTS)) {
      for (const host of hosts ?? []) expect(host).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    }
  });
});
