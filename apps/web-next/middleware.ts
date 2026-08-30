import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isDashboardRoute = createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isDashboardRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', `${req.nextUrl.pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(signInUrl);
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  /* Embed, the embedded Shopify admin app, and storefront-facing APIs are
     cookie-less third-party contexts: Clerk's handshake can redirect them
     (blank iframes, or Shopify's admin refusing the resulting navigation).
     Keep them out. `shopify` covers the app page tree
     (app/shopify/app/[[...rest]]); `api/shopify` covers its route handlers
     — two different prefixes, both needed. */
  matcher: ['/((?!_next|embed|shopify|api/try-on|api/shopify|.*\\..*).*)', '/'],
};
