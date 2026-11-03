import type { Metadata } from 'next';

const CANONICAL_ORIGIN = 'https://grindctrl.cloud';

/**
 * The public origin that sitemap, robots, llms.txt and page metadata share.
 * It follows NEXT_PUBLIC_APP_URL (docs/deployment.md requires
 * https://grindctrl.cloud in production), reduced to its origin so a stray
 * path never leaks into a canonical URL. Anything unusable falls back to the
 * canonical host.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch {
      // Not a URL: use the canonical host.
    }
  }
  return CANONICAL_ORIGIN;
}

/** OpenGraph and Twitter text for a page. `path` resolves against `metadataBase`. */
export function socialMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: { type: 'website', siteName: 'GRINDCTRL', title, description, url: path },
    twitter: { card: 'summary', title, description },
  };
}
