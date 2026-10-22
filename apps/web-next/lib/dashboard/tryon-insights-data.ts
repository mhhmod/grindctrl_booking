import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { adminGraphql } from '@/lib/shopify/admin';
import { getShopToken } from '@/lib/shopify/tokens';
import { getShopEntitlement } from '@/lib/try-on/entitlement';
import { withoutTestLooks } from '@/lib/try-on/test-looks';
import type { ResultsPeriod } from './tryon-insights-copy';
import { RECENT_LOOKS, TOP_PRODUCTS, type ProductInfo, type ResultsJob, type TryOnResultsFacts } from './tryon-insights-model';

const DAY = 86_400_000;
/** A shop's handles are letters, digits and dashes (Arabic letters too). */
const HANDLE_RE = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,254}$/u;

const PRODUCT_TITLES_QUERY = `#graphql
  query ResultsProductTitles($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      nodes {
        handle
        title
        featuredMedia {
          ... on MediaImage { image { url } }
        }
      }
    }
  }
`;

type TitlesResponse = {
  products?: {
    nodes?: Array<{ handle: string; title: string; featuredMedia?: { image?: { url?: string } | null } | null }>;
  };
};

/* The facts behind the v16 Try-On Results tab, for the active store's shop
   only (resolved among the caller's own and team shops, so every read here
   is one this person may make). The looks are required: a failed read
   throws, and the page says so. A plan or a product title that cannot be
   read is left out: the badge is not drawn, and a product shows its handle
   as words. */

async function storeLooks(shop: string, period: ResultsPeriod, now: number): Promise<ResultsJob[]> {
  const supabase = getMessengerServiceClient();
  const since = new Date(now - 2 * period * DAY).toISOString();
  const result = await withoutTestLooks((excludeTestLooks) => {
    const query = supabase
      .from('tryon_jobs')
      .select('product_id, status, duration_ms, message, created_at')
      .eq('shop', shop)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20_000);
    return excludeTestLooks ? query.eq('is_test', false) : query;
  });
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as ResultsJob[];
}

/** The handles the page names: the top products of the period and the
 *  latest looks. */
function handlesToName(jobs: ResultsJob[], period: ResultsPeriod, now: number): string[] {
  const start = now - period * DAY;
  const counts = new Map<string, number>();
  for (const job of jobs) {
    if (job.status === 'completed' && Date.parse(job.created_at) > start) counts.set(job.product_id, (counts.get(job.product_id) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, TOP_PRODUCTS).map(([handle]) => handle);
  const recent = jobs.slice(0, RECENT_LOOKS).map((job) => job.product_id);
  return [...new Set([...top, ...recent])].filter((handle) => HANDLE_RE.test(handle));
}

async function productTitles(shop: string, handles: string[]): Promise<Record<string, ProductInfo>> {
  if (handles.length === 0) return {};
  const token = await getShopToken(shop);
  if (!token) return {};
  const data = await adminGraphql<TitlesResponse>({
    shopDomain: shop,
    accessToken: token.accessToken,
    query: PRODUCT_TITLES_QUERY,
    variables: { query: handles.map((handle) => `handle:'${handle}'`).join(' OR '), first: handles.length },
  });
  const out: Record<string, ProductInfo> = {};
  for (const node of data.products?.nodes ?? []) {
    if (!node?.handle || !node.title) continue;
    const url = node.featuredMedia?.image?.url;
    out[node.handle] = { title: node.title, imageUrl: url && url.startsWith('https://') ? url : null };
  }
  return out;
}

export async function getTryOnResultsFacts({
  shop,
  period,
  now = Date.now(),
}: {
  shop: string;
  period: ResultsPeriod;
  now?: number;
}): Promise<TryOnResultsFacts> {
  const [jobs, entitlement] = await Promise.all([
    storeLooks(shop, period, now),
    getShopEntitlement(shop).catch(() => null),
  ]);
  const products = await productTitles(shop, handlesToName(jobs, period, now)).catch((error) => {
    console.error('[try-on results] product titles failed:', error instanceof Error ? error.message : error);
    return {};
  });
  return { now, period, live: entitlement ? entitlement.available : null, jobs, products };
}
