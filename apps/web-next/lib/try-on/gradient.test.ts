// lib/try-on/gradient.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_GRADIENT_INTENSITY, deriveGradient } from './gradient';

const HEX = /^#[0-9a-f]{6}$/;

function lightness(hex: string): number {
  const int = parseInt(hex.slice(1), 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

describe('deriveGradient', () => {
  it('keeps the merchant colour as the first stop', () => {
    expect(deriveGradient('#ff9a3d', 55).from).toBe('#ff9a3d');
  });

  it('derives a lighter second stop', () => {
    const { from, to } = deriveGradient('#1a73e8', 55);
    expect(to).toMatch(HEX);
    expect(lightness(to)).toBeGreaterThan(lightness(from));
  });

  it('moves the stops further apart as intensity rises', () => {
    const low = deriveGradient('#1a73e8', 5);
    const high = deriveGradient('#1a73e8', 95);
    const spread = (g: { from: string; to: string }) =>
      lightness(g.to) - lightness(g.from);
    expect(spread(high)).toBeGreaterThan(spread(low));
  });

  it('never returns a second stop that has blown out to white', () => {
    // A near-white brand colour must still produce a visible gradient
    // rather than two identical stops.
    const { from, to } = deriveGradient('#f5f5f5', 100);
    expect(to).toMatch(HEX);
    expect(to).not.toBe(from);
  });

  it('accepts hex with or without the hash, any case', () => {
    expect(deriveGradient('FF9A3D', 55).from).toBe('#ff9a3d');
    expect(deriveGradient('#FF9A3D', 55).from).toBe('#ff9a3d');
  });

  it('falls back to a usable pair for unparseable input', () => {
    // Settings come from a database column, so a null or a stray string is
    // possible however careful the form is. Never emit "#NaNNaNNaN".
    for (const bad of ['', 'not-a-colour', '#12', '#1234567']) {
      const g = deriveGradient(bad, 55);
      expect(g.from, bad).toMatch(HEX);
      expect(g.to, bad).toMatch(HEX);
    }
  });

  it('clamps a nonsense intensity instead of producing nonsense colours', () => {
    for (const bad of [-40, 500, Number.NaN]) {
      const g = deriveGradient('#1a73e8', bad as number);
      expect(g.to).toMatch(HEX);
    }
  });

  it('exports a default intensity inside the slider range', () => {
    expect(DEFAULT_GRADIENT_INTENSITY).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_GRADIENT_INTENSITY).toBeLessThanOrEqual(100);
  });
});
