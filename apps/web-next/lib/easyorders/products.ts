import 'server-only';
import { extractReadableText } from '@/lib/messenger/knowledge';
import { easyOrdersRequest } from './client';
import { easyOrdersRpc, loadEasyOrdersConnection } from './store';
import { EasyOrdersError, type EasyOrdersConnection } from './types';

export type EasyOrdersProductKnowledge = { id: string; title: string; content: string };
export function productKnowledge(raw: unknown): EasyOrdersProductKnowledge | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const id = typeof p.id === 'number' && Number.isSafeInteger(p.id) ? String(p.id) : p.id;
  const title = typeof p.name === 'string' ? p.name : typeof p.title === 'string' ? p.title : null;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || !title?.trim()) return null;
  const description = typeof p.description === 'string' ? extractReadableText(p.description.slice(0, 20000)) : '';
  const price = (typeof p.price === 'number' && Number.isFinite(p.price) && p.price >= 0)
    || (typeof p.price === 'string' && /^\d{1,12}(\.\d{1,6})?$/.test(p.price)) ? `Price: ${p.price}` : '';
  const variations = Array.isArray(p.variations) ? p.variations.slice(0, 20).flatMap((v) => {
    if (!v || typeof v !== 'object') return [];
    const name = (v as Record<string, unknown>).name;
    return typeof name === 'string' ? [name.slice(0, 120)] : [];
  }) : [];
  return { id, title: title.trim().slice(0, 200), content: [title.slice(0, 200), description, price,
    variations.length ? `Variations: ${variations.join(', ')}` : ''].filter(Boolean).join('\n').slice(0, 15000) };
}
/** At most two pages / 50 products per explicit sync. No speculative retries. */
export async function fetchEasyOrdersProducts(c: EasyOrdersConnection): Promise<EasyOrdersProductKnowledge[]> {
  const products = new Map<string, EasyOrdersProductKnowledge>();
  for (let page = 1; page <= 2; page++) {
    const query = new URLSearchParams({ limit: '25', page: String(page), join: 'variations' });
    const response = await easyOrdersRequest(c, `products?${query}`);
    if (!response.ok) throw new EasyOrdersError('unavailable');
    const json = response.json;
    const rows = Array.isArray(json) ? json : json && typeof json === 'object' ? (json as { data?: unknown }).data : null;
    if (!Array.isArray(rows) || rows.length > 25) throw new EasyOrdersError('unavailable');
    for (const raw of rows) {
      const product = productKnowledge(raw);
      if (!product) throw new EasyOrdersError('unavailable'); // never replace good knowledge with a malformed import
      products.set(product.id, product);
    }
    if (rows.length < 25) break;
  }
  return [...products.values()];
}
export async function syncEasyOrdersProducts(siteId: string): Promise<number> {
  const c = await loadEasyOrdersConnection(siteId);
  if (!c || c.status !== 'active') throw new EasyOrdersError('unavailable');
  // Short persisted freshness guard, not a correctness or rate-limit gate.
  if (c.products_synced_at && Date.parse(c.products_synced_at) > Date.now() - 60_000) return 0;
  const entries = await fetchEasyOrdersProducts(c);
  return easyOrdersRpc<number>('sync_easyorders_knowledge', { p_site: siteId, p_token: c.webhook_token, p_entries: entries });
}
