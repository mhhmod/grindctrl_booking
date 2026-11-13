import { describe, expect, it } from 'vitest';
import { isServerActionRequest, shouldRedirectSignedOut, signedInAuthPageRedirect, signInRedirectUrl } from './dashboard-gate';

const request = (method: string, headers: Record<string, string> = {}) => ({ method, headers: new Headers(headers) });

describe('signed-out requests to a protected route', () => {
  it('redirects page loads and navigations to sign-in', () => {
    expect(shouldRedirectSignedOut(request('GET'))).toBe(true);
    expect(shouldRedirectSignedOut(request('GET', { rsc: '1' }))).toBe(true);
    // A plain form post (no JavaScript) is a page load too.
    expect(shouldRedirectSignedOut(request('POST'))).toBe(true);
  });

  it('lets a server action through so it can answer "signed out" itself', () => {
    expect(isServerActionRequest(request('POST', { 'Next-Action': 'abc123' }))).toBe(true);
    expect(shouldRedirectSignedOut(request('POST', { 'next-action': 'abc123' }))).toBe(false);
  });

  it('does not treat a GET with the action header as an action', () => {
    expect(shouldRedirectSignedOut(request('GET', { 'next-action': 'abc123' }))).toBe(true);
  });

  it('returns to the exact page, query included', () => {
    const url = signInRedirectUrl({
      url: 'https://grindctrl.cloud/dashboard/inbox?shop=a.myshopify.com',
      nextUrl: { pathname: '/dashboard/inbox', search: '?shop=a.myshopify.com' },
    });
    expect(url.pathname).toBe('/sign-in');
    expect(url.searchParams.get('redirect_url')).toBe('/dashboard/inbox?shop=a.myshopify.com');
  });
});

/* Item 2 (owner decision 2026-11-12): a signed-in person who opens an auth
   page goes straight to where they were headed, decided by the proxy. */
describe('signed-in requests to an auth page', () => {
  const ORIGIN = 'https://grindctrl.cloud';
  const at = (pathAndQuery: string, method = 'GET') => {
    const url = new URL(pathAndQuery, ORIGIN);
    return { method, url: url.href, nextUrl: { pathname: url.pathname, search: url.search } };
  };

  it.each(['/sign-in', '/sign-up', '/login', '/sign-in/', '/Sign-Up'])('sends %s to the dashboard by default', (path) => {
    expect(signedInAuthPageRedirect(at(path))?.href).toBe(`${ORIGIN}/dashboard`);
  });

  it('keeps a safe destination, query included', () => {
    const target = '/claim?token=abc&x=1';
    const url = signedInAuthPageRedirect(at(`/sign-in?redirect_url=${encodeURIComponent(target)}`));
    expect(url?.href).toBe(`${ORIGIN}${target}`);
    expect(signedInAuthPageRedirect(at('/sign-up?redirect_url=%2Fdashboard%2Finbox'))?.pathname).toBe('/dashboard/inbox');
    expect(signedInAuthPageRedirect(at('/login?redirect_url=%2Fdashboard%2Fplan'))?.pathname).toBe('/dashboard/plan');
  });

  it.each([
    'https://evil.example/',
    '//evil.example',
    '/\\evil.example',
    '/sign-in',
    '/sign-up?redirect_url=/sign-in',
    '/login',
  ])('never leaves the site or loops for redirect_url=%s', (target) => {
    const url = signedInAuthPageRedirect(at(`/sign-in?redirect_url=${encodeURIComponent(target)}`));
    expect(url?.origin).toBe(ORIGIN);
    expect(url?.pathname).toBe('/dashboard');
  });

  it('leaves Clerk’s own steps, other pages and non-GET requests alone', () => {
    for (const path of ['/sign-in/sso-callback', '/sign-in/factor-one', '/sign-up/verify-email-address', '/sign-up/continue', '/', '/pricing', '/dashboard']) {
      expect(signedInAuthPageRedirect(at(path))).toBeNull();
    }
    expect(signedInAuthPageRedirect(at('/sign-in', 'POST'))).toBeNull();
    expect(signedInAuthPageRedirect(at('/sign-in', 'HEAD'))?.pathname).toBe('/dashboard');
  });
});
