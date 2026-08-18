import { describe, expect, it } from 'vitest';
import { showLauncherFor } from './launcher-visibility';

describe('showLauncherFor', () => {
  it('shows on ordinary pages when logged out', () => {
    expect(showLauncherFor('/', false)).toBe(true);
    expect(showLauncherFor('/try-on', false)).toBe(true);
    expect(showLauncherFor('/dashboard/overview', false)).toBe(true);
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

  it('still shows inside the dashboard when signed in', () => {
    expect(showLauncherFor('/dashboard/overview', true)).toBe(true);
    expect(showLauncherFor('/dashboard/try-on', true)).toBe(true);
  });

  it('still shows on sign-in/sign-up even if a session cookie lingers', () => {
    expect(showLauncherFor('/sign-in', true)).toBe(true);
  });
});
