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
  if (choice) {
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
