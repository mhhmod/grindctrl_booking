import { type NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_STORE_COOKIE,
  ACTIVE_STORE_HEADER,
  formatStoreChoice,
  storeChoiceFromQuery,
} from './active-store';

/* How proxy.ts hands every request it lets through to the app: with its
   pathname in `x-pathname`, which layouts read because they never see the
   URL. */
const ACTIVE_STORE_MAX_AGE_S = 60 * 60 * 24 * 365;

/* A dashboard link that names a store (`?shop=` or `?site=`) switches to it:
   the choice reaches this request's layout through a header, which pages
   and layouts cannot read from the query themselves, and is remembered in
   a cookie for the next page. Only the shape is checked here; the dashboard
   accepts it only for a store the signed-in merchant owns
   (lib/dashboard/active-store.ts). A client's own copy of the header is
   always dropped. */

/* Only a page load is remembered: a link opened from an email or a
   bookmark, a store chosen in the switcher (plain links, so they load the
   page), or an address typed in. Next removes its own router headers
   (next-router-prefetch among them) before this proxy runs (FLIGHT_HEADERS
   in next/dist/server/web/adapter.js), so a prefetch cannot be told from a
   client-side navigation here. Both are fetches, which browsers mark with a
   Sec-Fetch-Mode other than navigate, and remembering a prefetch switched
   the store just by showing a page that links to other stores, as Store
   Chat's store picker does. A fetch still renders the store it names,
   through the header. A browser too old to send Sec-Fetch-Mode is
   remembered as before, unless it marks its own prefetch. */
function isPageLoad(req: NextRequest): boolean {
  const { headers } = req;
  if (/prefetch/i.test(headers.get('sec-purpose') ?? headers.get('purpose') ?? '')) return false;
  const mode = headers.get('sec-fetch-mode');
  return mode === null || mode === 'navigate';
}

export function withPathname(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  requestHeaders.delete(ACTIVE_STORE_HEADER);

  const { pathname, searchParams } = req.nextUrl;
  const choice =
    pathname === '/dashboard' || pathname.startsWith('/dashboard/')
      ? storeChoiceFromQuery({
          shop: searchParams.get('shop') ?? undefined,
          site: searchParams.get('site') ?? undefined,
        })
      : null;
  if (choice) requestHeaders.set(ACTIVE_STORE_HEADER, formatStoreChoice(choice));

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (choice && isPageLoad(req)) {
    response.cookies.set(ACTIVE_STORE_COOKIE, formatStoreChoice(choice), {
      path: '/dashboard',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ACTIVE_STORE_MAX_AGE_S,
    });
  }
  return response;
}
