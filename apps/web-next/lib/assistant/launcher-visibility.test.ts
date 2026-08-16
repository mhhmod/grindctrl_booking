import { describe, expect, it } from 'vitest';
import { showLauncherFor } from './launcher-visibility';

describe('showLauncherFor', () => {
  it('shows on ordinary pages', () => {
    expect(showLauncherFor('/')).toBe(true);
    expect(showLauncherFor('/try-on')).toBe(true);
    expect(showLauncherFor('/dashboard/overview')).toBe(true);
    expect(showLauncherFor('/sign-in')).toBe(true);
  });

  it('hides on the assistant page itself', () => {
    expect(showLauncherFor('/assistant')).toBe(false);
  });

  it('hides on embed pages', () => {
    expect(showLauncherFor('/embed/try-on')).toBe(false);
  });

  it('hides when the pathname is unknown (fails closed, not open)', () => {
    expect(showLauncherFor(null)).toBe(false);
  });
});
