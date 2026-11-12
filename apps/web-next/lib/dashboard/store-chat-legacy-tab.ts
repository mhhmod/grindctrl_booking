/* Where a link with Store Chat's old ?tab= goes now. The six tabs became
   v16 pages (What it knows, Set up and Inbox), but emails, bookmarks and
   Shopify's OAuth return still carry the old value, so the page redirects
   them instead of drawing the old tab screens. */

const KNOWS = '/dashboard/store-chat';
const SETUP = '/dashboard/store-chat/setup';

const DESTINATION = {
  overview: KNOWS,
  ai: KNOWS,
  appearance: SETUP,
  behaviour: SETUP,
  installation: SETUP,
  conversations: '/dashboard/inbox',
} as const;

type Query = { site?: unknown; tab?: unknown; orders?: unknown };

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** The v16 address for a link that carries a known ?tab=, keeping the
 *  store it names, or null for a link without one. Shopify's order-access
 *  return (`tab=behaviour&orders=...`) keeps its answer for Set up, where
 *  the grant button is. */
export function legacyStoreChatHref(query: Query): string | null {
  const tab = text(query.tab);
  if (!tab || !Object.hasOwn(DESTINATION, tab)) return null;
  const site = text(query.site);
  const orders = tab === 'behaviour' ? text(query.orders) : null;
  const path = DESTINATION[tab as keyof typeof DESTINATION];
  const next = new URLSearchParams();
  if (site) next.set('site', site);
  if (orders) next.set('orders', orders);
  const search = next.toString();
  return search ? `${path}?${search}` : path;
}
