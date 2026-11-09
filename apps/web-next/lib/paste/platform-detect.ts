/* Which hosted store platform serves a storefront, read from a page OUR
   server fetched from the merchant's trusted domain (never from anything a
   browser sends). It decides which official platform image server the
   merchant's garment photos may come from (platform-image-hosts.ts), so a
   platform is named only with at least one strong signal, and two
   platforms with comparable evidence (a page embedding another platform's
   widget) are `custom`. Pure: no I/O. */

export const DETECTED_PLATFORMS = [
  'shopify', 'woocommerce', 'easyorders', 'salla', 'zid', 'wix', 'squarespace', 'webflow', 'youcan', 'custom',
] as const;
export type DetectedPlatform = (typeof DETECTED_PLATFORMS)[number];
type HostedPlatform = Exclude<DetectedPlatform, 'custom'>;

export function isDetectedPlatform(value: unknown): value is DetectedPlatform {
  return typeof value === 'string' && (DETECTED_PLATFORMS as readonly string[]).includes(value);
}

export type PlatformDetection = { platform: DetectedPlatform; signals: string[] };

type Signal = {
  platform: HostedPlatform;
  name: string;
  strong: boolean;
  test: (page: { host: string; html: string; headers: Record<string, string> }) => boolean;
};

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A reference to `host` in markup: `//host/`, also JSON-escaped (`\/\/host\/`),
 *  and never a longer lookalike such as `host.evil.com` or `evil-host`. */
function hostRef(host: string): RegExp {
  return new RegExp(`(?:\\\\?/){2}${escape(host)}(?=\\\\?/|["'?#\\s)]|$)`, 'i');
}
/** A reference to any subdomain of `domain` (or the domain itself). */
function domainRef(domain: string): RegExp {
  return new RegExp(`(?:\\\\?/){2}(?:[a-z0-9-]+\\.)*${escape(domain)}(?=\\\\?/|["'?#\\s)]|$)`, 'i');
}
const hostIs = (suffix: string) => (host: string) => host.endsWith(suffix) && host.length > suffix.length;
const inHtml = (pattern: RegExp) => ({ html }: { html: string }) => pattern.test(html);

const SIGNALS: readonly Signal[] = [
  { platform: 'easyorders', name: 'store_host', strong: true,
    test: ({ host }) => hostIs('.myeasyorders.com')(host) || hostIs('.easy-orders.net')(host) },
  { platform: 'easyorders', name: 'asset_cdn', strong: true, test: inHtml(hostRef('cdn.easy-orders.net')) },
  { platform: 'easyorders', name: 'image_host', strong: true,
    test: ({ html }) => hostRef('files.easy-orders.net').test(html) || hostRef('flles.easy-orders.net').test(html) },
  // Any Next.js store has __NEXT_DATA__; these keys only make it likelier.
  { platform: 'easyorders', name: 'next_data_settings', strong: false,
    test: ({ html }) => /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>[^<]*"(?:appSettings|themeSettings)"/i.test(html) },

  { platform: 'shopify', name: 'store_host', strong: true, test: ({ host }) => hostIs('.myshopify.com')(host) },
  { platform: 'shopify', name: 'cdn', strong: true, test: inHtml(hostRef('cdn.shopify.com')) },
  { platform: 'shopify', name: 'theme_object', strong: true, test: inHtml(/\bShopify\.theme\b/) },
  { platform: 'shopify', name: 'cdn_path', strong: true, test: inHtml(/["'(](?:https?:)?(?:\/\/[a-z0-9.-]+)?\/cdn\/shop\/(?:files|products|t)\//i) },
  { platform: 'shopify', name: 'header', strong: true,
    test: ({ headers }) => Boolean(headers['x-shopid'] || headers['x-shopify-stage'] || /^shopify$/i.test(headers['powered-by'] ?? '')) },

  { platform: 'woocommerce', name: 'plugin_assets', strong: true, test: inHtml(/\/wp-content\/plugins\/woocommerce\//i) },
  { platform: 'woocommerce', name: 'body_class', strong: true,
    test: inHtml(/<body\b[^>]*\bclass\s*=\s*["'][^"']*\bwoocommerce(?:-page|-js|-no-js)?\b/i) },
  { platform: 'woocommerce', name: 'wordpress', strong: false, test: inHtml(/\/wp-content\/|\/wp-includes\//i) },

  { platform: 'salla', name: 'store_host', strong: true, test: ({ host }) => hostIs('.salla.sa')(host) },
  { platform: 'salla', name: 'cdn', strong: true, test: inHtml(hostRef('cdn.salla.sa')) },
  { platform: 'salla', name: 'script', strong: true,
    test: inHtml(/<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\/(?:[a-z0-9-]+\.)*salla\.sa\//i) },

  { platform: 'zid', name: 'store_host', strong: true, test: ({ host }) => hostIs('.zid.store')(host) },
  { platform: 'zid', name: 'media', strong: true, test: inHtml(hostRef('media.zid.store')) },
  { platform: 'zid', name: 'assets', strong: true,
    test: inHtml(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/(?:[a-z0-9-]+\.)*zid\.store\//i) },

  { platform: 'wix', name: 'static', strong: true, test: inHtml(hostRef('static.wixstatic.com')) },
  { platform: 'wix', name: 'request_id', strong: true, test: ({ headers }) => Boolean(headers['x-wix-request-id']) },
  { platform: 'wix', name: 'parastorage', strong: false, test: inHtml(hostRef('static.parastorage.com')) },

  { platform: 'squarespace', name: 'images', strong: true, test: inHtml(hostRef('images.squarespace-cdn.com')) },
  { platform: 'squarespace', name: 'static', strong: true, test: inHtml(hostRef('static1.squarespace.com')) },
  { platform: 'squarespace', name: 'store_host', strong: true, test: ({ host }) => hostIs('.squarespace.com')(host) },

  { platform: 'webflow', name: 'site_attribute', strong: true, test: inHtml(/<html\b[^>]*\bdata-wf-site\s*=/i) },
  { platform: 'webflow', name: 'files', strong: true, test: inHtml(domainRef('website-files.com')) },
  { platform: 'webflow', name: 'store_host', strong: true, test: ({ host }) => hostIs('.webflow.io')(host) },

  { platform: 'youcan', name: 'cdn', strong: true, test: inHtml(hostRef('cdn.youcan.shop')) },
  { platform: 'youcan', name: 'store_host', strong: true, test: ({ host }) => hostIs('.youcan.shop')(host) },
];

const STRONG_WEIGHT = 2;
const WEAK_WEIGHT = 1;

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return ''; }
}

export function detectPlatform(input: { url: string; html: string; headers?: Record<string, string> }): PlatformDetection {
  const page = {
    host: hostOf(input.url),
    html: input.html,
    headers: Object.fromEntries(Object.entries(input.headers ?? {}).map(([name, value]) => [name.toLowerCase(), String(value)])),
  };
  const scores = new Map<HostedPlatform, { score: number; strong: boolean }>();
  const signals: string[] = [];
  for (const signal of SIGNALS) {
    if (!signal.test(page)) continue;
    signals.push(`${signal.platform}:${signal.name}`);
    const entry = scores.get(signal.platform) ?? { score: 0, strong: false };
    entry.score += signal.strong ? STRONG_WEIGHT : WEAK_WEIGHT;
    entry.strong ||= signal.strong;
    scores.set(signal.platform, entry);
  }
  const ranked = [...scores].filter(([, entry]) => entry.strong).sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length) return { platform: 'custom', signals };
  // A second platform with strong evidence wins only by a full strong signal.
  if (ranked.length > 1 && ranked[0][1].score - ranked[1][1].score < STRONG_WEIGHT) return { platform: 'custom', signals };
  return { platform: ranked[0][0], signals };
}
