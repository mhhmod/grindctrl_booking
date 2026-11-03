import { buildLlmsTxt } from '@/lib/llms-txt';
import { siteUrl } from '@/lib/site-metadata';

/* Served at /llms.txt. The path has a dot, so proxy.ts's matcher leaves it
   alone, as it does robots.txt and the sitemap. */
export function GET() {
  return new Response(buildLlmsTxt(siteUrl()), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
