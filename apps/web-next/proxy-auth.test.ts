// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* What the proxy itself does with the session (proxy.test.ts covers which
   paths it runs on). Clerk is replaced by a stub session so the decisions
   in proxy.ts are what is under test. */
const session = vi.hoisted(() => ({ userId: null as string | null, calls: 0 }));
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: (auth: () => Promise<{ userId: string | null }>, req: NextRequest) => unknown) =>
    (req: NextRequest) => handler(async () => {
      session.calls += 1;
      return { userId: session.userId };
    }, req),
  createRouteMatcher: (patterns: string[]) => (req: NextRequest) =>
    patterns.some((pattern) => new RegExp(`^${pattern}$`).test(req.nextUrl.pathname)),
}));
vi.mock('@/lib/dashboard/forward-request', () => ({ withPathname: () => 'passed-through' }));

type Proxy = (req: NextRequest) => Promise<Response | string>;
let proxy: Proxy;

beforeEach(async () => {
  session.userId = null;
  session.calls = 0;
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_stub');
  vi.resetModules();
  proxy = (await import('./proxy')).default as unknown as Proxy;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const get = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  proxy(new NextRequest(new URL(path, 'https://grindctrl.cloud'), init));

describe('proxy: auth pages while signed in (item 2)', () => {
  it.each([
    ['/sign-in', '/dashboard'],
    ['/sign-up', '/dashboard'],
    ['/login', '/dashboard'],
    ['/sign-in?redirect_url=%2Fdashboard%2Finbox%3Fshop%3Da.myshopify.com', '/dashboard/inbox?shop=a.myshopify.com'],
    ['/sign-up?redirect_url=%2Fclaim%3Ftoken%3Dabc', '/claim?token=abc'],
    ['/sign-in?redirect_url=https%3A%2F%2Fevil.example', '/dashboard'],
    ['/sign-in?redirect_url=%2Fdashboard%2F..%2Fsign-in', '/dashboard'],
  ])('redirects %s to %s on the server', async (path, destination) => {
    session.userId = 'user_1';
    const response = (await get(path)) as Response;
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`https://grindctrl.cloud${destination}`);
  });

  it('shows the auth pages to a signed-out visitor, as before', async () => {
    for (const path of ['/sign-in', '/sign-up', '/sign-in?redirect_url=%2Fdashboard']) {
      expect(await get(path)).toBe('passed-through');
    }
  });

  it('lets Clerk finish its own steps once a session exists', async () => {
    session.userId = 'user_1';
    expect(await get('/sign-in/sso-callback')).toBe('passed-through');
    expect(await get('/sign-up/verify-email-address')).toBe('passed-through');
  });

  it('does not read the session on marketing pages', async () => {
    session.userId = 'user_1';
    expect(await get('/')).toBe('passed-through');
    expect(await get('/pricing')).toBe('passed-through');
    expect(session.calls).toBe(0);
  });
});

describe('proxy: protected routes stay protected', () => {
  it('still sends a signed-out dashboard visit to sign-in with its return path', async () => {
    const response = (await get('/dashboard/store?site=abc')) as Response;
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/sign-in');
    expect(location.searchParams.get('redirect_url')).toBe('/dashboard/store?site=abc');
  });
});
