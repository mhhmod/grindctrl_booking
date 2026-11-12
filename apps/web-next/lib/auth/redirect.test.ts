import { describe, expect, it } from 'vitest';
import {
  authPageHref,
  DEFAULT_SIGNED_IN_PATH,
  onboardingPath,
  resolveOnboardingNext,
  resolveSignInDestination,
  resolveSignUpDestination,
  safeRedirectPath,
} from './redirect';

describe('auth pages are never a destination', () => {
  it('rejects sign-in, sign-up and login, with or without a query, subpath or trailing slash', () => {
    for (const loop of ['/sign-in', '/sign-in/', '/sign-in?x=1', '/sign-in/factor-one', '/SIGN-UP', '/sign-up#top', '/login', '/login?redirect_url=/dashboard']) {
      expect(safeRedirectPath(loop)).toBeNull();
    }
    expect(resolveSignInDestination('/sign-in')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('still accepts pages whose names only start like an auth page', () => {
    expect(safeRedirectPath('/sign-inside')).toBe('/sign-inside');
    expect(safeRedirectPath('/dashboard/sign-in')).toBe('/dashboard/sign-in');
  });
});

describe('sign-up keeps where the new account was going', () => {
  it('goes through onboarding, then on to the destination', () => {
    expect(resolveSignUpDestination('/claim?token=a b')).toBe('/onboarding?next=%2Fclaim%3Ftoken%3Da+b');
  });

  it('is plain onboarding without a usable destination', () => {
    for (const none of [undefined, '', 'https://evil.example', '//evil.example', '/sign-in', '/onboarding', '/onboarding?next=/x', DEFAULT_SIGNED_IN_PATH]) {
      expect(resolveSignUpDestination(none)).toBe('/onboarding');
    }
  });

  it('never lets onboarding point back at itself', () => {
    expect(resolveOnboardingNext('/onboarding/')).toBeNull();
    expect(resolveOnboardingNext('/dashboard/inbox')).toBe('/dashboard/inbox');
    expect(onboardingPath('/dashboard/inbox')).toBe('/onboarding?next=%2Fdashboard%2Finbox');
  });

  it('carries a safe destination between sign-in and sign-up, and drops anything else', () => {
    expect(authPageHref('/sign-up', '/claim?token=abc')).toBe('/sign-up?redirect_url=%2Fclaim%3Ftoken%3Dabc');
    expect(authPageHref('/sign-in', '//evil.example')).toBe('/sign-in');
    expect(authPageHref('/sign-in', undefined)).toBe('/sign-in');
  });
});

describe('safeRedirectPath', () => {
  it('accepts a same-site absolute path', () => {
    expect(safeRedirectPath('/dashboard/try-on')).toBe('/dashboard/try-on');
    expect(safeRedirectPath('/dashboard/try-on?shop=a.myshopify.com')).toBe(
      '/dashboard/try-on?shop=a.myshopify.com',
    );
  });

  it('rejects an absolute URL to another origin', () => {
    // redirect_url comes from the query string, so it is attacker-controlled.
    expect(safeRedirectPath('https://evil.example/steal')).toBeNull();
    expect(safeRedirectPath('http://evil.example')).toBeNull();
  });

  it('rejects protocol-relative URLs', () => {
    // Browsers read "//evil.example" as a host, not a path. This is the
    // open-redirect people miss when they only check for a leading slash.
    expect(safeRedirectPath('//evil.example')).toBeNull();
    expect(safeRedirectPath('///evil.example')).toBeNull();
  });

  it('rejects backslash variants some parsers normalise to a slash', () => {
    expect(safeRedirectPath('/\\evil.example')).toBeNull();
    expect(safeRedirectPath('/\\/evil.example')).toBeNull();
  });

  it('rejects control characters used to smuggle a scheme', () => {
    expect(safeRedirectPath('/\nhttps://evil.example')).toBeNull();
    expect(safeRedirectPath('/\thttps://evil.example')).toBeNull();
  });

  it('rejects anything that is not a string', () => {
    for (const bad of [undefined, null, 42, {}, []]) {
      expect(safeRedirectPath(bad)).toBeNull();
    }
  });
});

describe('resolveSignInDestination', () => {
  it('honours a safe redirect_url so the user reaches the page they wanted', () => {
    expect(resolveSignInDestination('/dashboard/try-on')).toBe('/dashboard/try-on');
  });

  it('falls back to the dashboard when redirect_url is absent', () => {
    expect(resolveSignInDestination(undefined)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('falls back to the dashboard rather than following a hostile redirect', () => {
    expect(resolveSignInDestination('https://evil.example')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(resolveSignInDestination('//evil.example')).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});
