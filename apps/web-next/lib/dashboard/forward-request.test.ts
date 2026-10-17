import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { ACTIVE_STORE_COOKIE, ACTIVE_STORE_HEADER } from './active-store';
import { withPathname } from './forward-request';

const SITE = '11111111-1111-4111-8111-111111111111';

function forward(url: string, headers: Record<string, string> = {}) {
  return withPathname(new NextRequest(new URL(url, 'https://grindctrl.cloud'), { headers }));
}

/* NextResponse.next({ request: { headers } }) carries the request headers
   the app will see as x-middleware-request-* on the response. */
function forwarded(response: Response, name: string) {
  return response.headers.get(`x-middleware-request-${name}`);
}

describe('withPathname', () => {
  it('passes the pathname on', () => {
    expect(forwarded(forward('/dashboard/try-on'), 'x-pathname')).toBe('/dashboard/try-on');
  });

  it('passes a dashboard link’s shop on and remembers it', () => {
    const response = forward('/dashboard/try-on?shop=Alpha.myshopify.com');
    expect(forwarded(response, ACTIVE_STORE_HEADER)).toBe('shop:alpha.myshopify.com');
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${ACTIVE_STORE_COOKIE}=shop%3Aalpha.myshopify.com`);
    expect(cookie).toContain('Path=/dashboard');
    expect(cookie).toContain('HttpOnly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
  });

  it('passes a Store Chat site on', () => {
    expect(forwarded(forward(`/dashboard/store-chat?site=${SITE}&tab=ai`), ACTIVE_STORE_HEADER)).toBe(`site:${SITE}`);
    expect(forwarded(forward(`/dashboard?site=${SITE}`), ACTIVE_STORE_HEADER)).toBe(`site:${SITE}`);
  });

  it.each(['/dashboard/try-on?shop=evil.com', '/dashboard/store-chat?site=nope', '/dashboard/try-on'])(
    'chooses nothing for %s',
    (url) => {
      const response = forward(url);
      expect(forwarded(response, ACTIVE_STORE_HEADER)).toBeNull();
      expect(response.headers.get('set-cookie')).toBeNull();
    },
  );

  it('chooses nothing outside the dashboard', () => {
    const response = forward('/claim?shop=alpha.myshopify.com');
    expect(forwarded(response, ACTIVE_STORE_HEADER)).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('drops a client’s own copy of the header', () => {
    const response = forward('/dashboard/try-on', { [ACTIVE_STORE_HEADER]: 'shop:someone-else.myshopify.com' });
    expect(forwarded(response, ACTIVE_STORE_HEADER)).toBeNull();
  });
});
