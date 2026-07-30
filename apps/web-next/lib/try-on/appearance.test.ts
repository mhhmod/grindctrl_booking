import { describe, expect, it } from 'vitest';
import { MAX_PANEL_RADIUS_PX, toAppearanceTokens } from './appearance';

const base = {
  accentBg: '#2a2826',
  accentFg: '#f0ede9',
  radiusPx: 999,
};

describe('toAppearanceTokens', () => {
  it('passes the accent colours straight through', () => {
    const t = toAppearanceTokens(base);
    expect(t['--primary']).toBe('#2a2826');
    expect(t['--primary-foreground']).toBe('#f0ede9');
  });

  it('caps panel radius but leaves pill controls fully round', () => {
    // The merchant default is 999, meaning "pill". A card with a 999px
    // radius collapses into a lozenge, so panels cap while controls do not.
    const t = toAppearanceTokens(base);
    expect(t['--radius']).toBe(`${MAX_PANEL_RADIUS_PX}px`);
    expect(t['--gc-control-radius']).toBe('999px');
  });

  it('applies a small radius to controls as well as panels', () => {
    // The bug this guards: buttons used a hardcoded rounded-full, so a
    // merchant setting 8px saw square-ish cards and pill buttons.
    const t = toAppearanceTokens({ ...base, radiusPx: 8 });
    expect(t['--radius']).toBe('8px');
    expect(t['--gc-control-radius']).toBe('8px');
  });

  it('supports fully square corners', () => {
    const t = toAppearanceTokens({ ...base, radiusPx: 0 });
    expect(t['--radius']).toBe('0px');
    expect(t['--gc-control-radius']).toBe('0px');
  });

  it('never emits a negative or non-finite radius', () => {
    for (const bad of [-20, Number.NaN, Number.POSITIVE_INFINITY]) {
      const t = toAppearanceTokens({ ...base, radiusPx: bad as number });
      expect(t['--radius']).toMatch(/^\d+px$/);
      expect(t['--gc-control-radius']).toMatch(/^\d+px$/);
    }
  });

  it('gives the storefront and the panel the same control radius', () => {
    // Regression: the embed clamped at 24 while the catalog button clamped
    // at 999, so one setting produced two different shapes.
    const t = toAppearanceTokens({ ...base, radiusPx: 40 });
    expect(t['--gc-control-radius']).toBe('40px');
    expect(t['--radius']).toBe(`${MAX_PANEL_RADIUS_PX}px`);
  });
});
