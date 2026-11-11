/* What the last catalogue refresh found for a store, kept on
   widget_sites.products_sync_result (supabase/20261112_messenger_products_status.sql)
   so What it knows can say why a store has no products instead of staying
   silent. Safe to import from client code. */

export const PRODUCTS_OUTCOMES = ['ok', 'password_page', 'not_found', 'unreachable', 'rate_limited'] as const;
export type ProductsOutcome = (typeof PRODUCTS_OUTCOMES)[number];

export type ProductsStatus = {
  outcome: ProductsOutcome;
  /** Products read. Only meaningful for 'ok'. */
  count: number;
  /** When the refresh ran, as an ISO time. */
  at: string;
};

/** The stored value, or null when absent or not in the shape written here. */
export function parseProductsStatus(raw: unknown): ProductsStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const { outcome, count, at } = raw as Record<string, unknown>;
  if (!PRODUCTS_OUTCOMES.includes(outcome as ProductsOutcome)) return null;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return null;
  if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) return null;
  return { outcome: outcome as ProductsOutcome, count, at };
}
