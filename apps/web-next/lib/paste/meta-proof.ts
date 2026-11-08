import 'server-only';
import { assertSafeGarmentUrl, pinnedFetch, type PinnedFetch } from '@/lib/woo/garment-url';

/** Equivalent to the TXT token, served in <head> at the exact HTTPS root.
 * Reuses resolve/check/pin transport: private DNS answers, redirects,
 * non-HTML, oversize pages and errors all fail proof. No merchant URL is
 * accepted; we construct it from the already-normalized claim hostname. */
export async function verifyPasteMeta(
  domain: string, token: string,
  deps: { resolve?: typeof assertSafeGarmentUrl; fetcher?: PinnedFetch } = {},
): Promise<boolean> {
  try {
    const target = await (deps.resolve ?? assertSafeGarmentUrl)(`https://${domain}/`, [domain]);
    const response = await (deps.fetcher ?? pinnedFetch)(target);
    if (response.status !== 200 || response.mime !== 'text/html' || response.body.length > 256 * 1024) return false;
    const html = response.body.toString('utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|title|textarea|xmp|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(html)?.[1];
    if (!head) return false;
    for (const tag of head.match(/<meta\s(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) ?? []) {
      const attrs = new Map<string, string>();
      for (const match of tag.matchAll(/\s([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        // Duplicate attributes are ambiguous between parsers; fail proof.
        const name = match[1].toLowerCase();
        if (attrs.has(name)) return false;
        attrs.set(name, match[2] ?? match[3]);
      }
      if (attrs.get('name') === 'grindctrl-verification' && attrs.get('content') === token) return true;
    }
    return false;
  } catch { return false; }
}
