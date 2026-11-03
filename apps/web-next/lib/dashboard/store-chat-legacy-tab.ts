/* Where a link with Store Chat's old ?tab= goes now. The six tabs became
   v16 pages (What it knows, Set up and Inbox), but emails, bookmarks and
   Shopify's OAuth return still carry the old value, so the page redirects
   them instead of drawing the old tab screens. */

const KNOWS = '/dashboard/store-chat';
const SETUP = '/dashboard/store-chat/setup';
/** The editors the Set up board does not cover yet: saved replies, hours,
 *  the widget's language, a custom icon and the launcher size. */
export const MORE_SETTINGS = '/dashboard/store-chat/setup/more';

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
 *  return (`tab=behaviour&orders=...`) goes to the editor that grants it. */
export function legacyStoreChatHref(query: Query): string | null {
  const tab = text(query.tab);
  if (!tab || !Object.hasOwn(DESTINATION, tab)) return null;
  const site = text(query.site);
  const orders = text(query.orders);
  const withOrders = tab === 'behaviour' && orders;
  const path = withOrders ? MORE_SETTINGS : DESTINATION[tab as keyof typeof DESTINATION];
  const next = new URLSearchParams();
  if (site) next.set('site', site);
  if (withOrders) {
    next.set('section', 'behaviour');
    next.set('orders', orders);
  }
  const search = next.toString();
  return search ? `${path}?${search}` : path;
}
