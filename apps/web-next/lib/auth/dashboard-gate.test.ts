import { describe, expect, it } from 'vitest';
import { isServerActionRequest, shouldRedirectSignedOut, signInRedirectUrl } from './dashboard-gate';

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
