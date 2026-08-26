import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/* Browsers, crawlers, and old bookmarks request /favicon.ico directly even
   though the site declares an SVG icon via metadata. Redirect them to the
   real asset instead of answering 404. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/icon.svg', request.url), 308);
}
