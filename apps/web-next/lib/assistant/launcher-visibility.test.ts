import { describe, expect, it } from 'vitest';
import { showLauncherFor } from './launcher-visibility';

describe('showLauncherFor', () => {
  it('shows on ordinary pages when logged out', () => {
    expect(showLauncherFor('/', false)).toBe(true);
    expect(showLauncherFor('/try-on', false)).toBe(true);
    expect(showLauncherFor('/sign-in', false)).toBe(true);
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

  it('still shows on sign-in/sign-up even if a session cookie lingers', () => {
    expect(showLauncherFor('/sign-in', true)).toBe(true);
  });
});
