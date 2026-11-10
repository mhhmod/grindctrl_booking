import type { DetectedPlatform } from './platform-detect';

/* Official image servers of hosted store platforms. A website-paste site
   may use these for garment photos only when our server fingerprinted its
   trusted domain as that platform (widget_domains.platform_detected).
   Exact hostnames: a subdomain or lookalike never matches. The garment URL
   check (lib/woo/garment-url.ts) still requires HTTPS on the default port
   and resolves, blocks and pins every one of them like a site host.
   Shopify and WooCommerce are absent: their images already come from the
   store's own host or cdn.shopify.com / the WordPress CDN. */
export const PLATFORM_IMAGE_HOSTS: Readonly<Partial<Record<DetectedPlatform, readonly string[]>>> = {
  easyorders: [
    'files.easy-orders.net',
    // EasyOrders serves some product photos from this misspelled host (seen live).
    'flles.easy-orders.net',
    'cdn.easy-orders.net',
  ],
  wix: ['static.wixstatic.com'],
  squarespace: ['images.squarespace-cdn.com'],
  webflow: ['cdn.prod.website-files.com', 'assets.website-files.com', 'uploads-ssl.webflow.com'],
  salla: ['cdn.salla.sa'],
  zid: ['media.zid.store'],
  youcan: ['cdn.youcan.shop'],
};

export function platformImageHosts(platform: DetectedPlatform | null | undefined): readonly string[] {
  return (platform && PLATFORM_IMAGE_HOSTS[platform]) || [];
}

/** True for a host some platform serves images from, whichever platform. */
export function isAnyPlatformImageHost(host: string): boolean {
  return Object.values(PLATFORM_IMAGE_HOSTS).some((hosts) => hosts?.includes(host));
}
