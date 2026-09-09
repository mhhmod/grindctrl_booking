import { describe, expect, it } from 'vitest';
import { showLauncherFor } from './launcher-visibility';

describe('showLauncherFor', () => {
  it('shows on ordinary pages when logged out', () => {
    expect(showLauncherFor('/', false)).toBe(true);
    expect(showLauncherFor('/try-on', false)).toBe(true);
    expect(showLauncherFor('/contact', false)).toBe(true);
  });

  it('hides on the assistant page itself', () => {
    expect(showLauncherFor('/assistant', false)).toBe(false);
  });

  it('hides on embed pages', () => {
    expect(showLauncherFor('/embed/try-on', false)).toBe(false);
  });

  it('hides when the pathname is unknown (fails closed, not open)', () => {
    expect(showLauncherFor(null, false)).toBe(false);
  });

  it('hides on the landing family once signed in', () => {
    expect(showLauncherFor('/', true)).toBe(false);
    expect(showLauncherFor('/pricing', true)).toBe(false);
    expect(showLauncherFor('/try-on', true)).toBe(false);
  });

  /* The dashboard is the merchant's own workspace: the site assistant has
     no business floating over it, signed in or not. */
  it('never shows inside the dashboard', () => {
    expect(showLauncherFor('/dashboard/overview', true)).toBe(false);
    expect(showLauncherFor('/dashboard/try-on', true)).toBe(false);
    expect(showLauncherFor('/dashboard/messenger', false)).toBe(false);
  });

  it.each([
    '/sign-in',
    '/sign-in/',
    '/sign-in/factor-one',
    '/sign-in/reset-password',
    '/sign-up',
    '/sign-up/verify-email-address',
  ])('never covers the auth flow at %s, with or without a lingering session', (pathname) => {
    expect(showLauncherFor(pathname, false)).toBe(false);
    expect(showLauncherFor(pathname, true)).toBe(false);
  });

  it('does not mistake similarly named ordinary pages for auth routes', () => {
    expect(showLauncherFor('/sign-in-help', false)).toBe(true);
    expect(showLauncherFor('/sign-updates', false)).toBe(true);
  });
});
