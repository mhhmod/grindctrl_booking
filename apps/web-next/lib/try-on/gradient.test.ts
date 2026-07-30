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
    // rather than two identical, or barely-different, stops.
    const LIGHTNESS_FLOOR = 0.08;

    for (const base of ['#f5f5f5', '#0a0a0a']) {
      const { from, to } = deriveGradient(base, 100);
      expect(to, base).toMatch(HEX);
      expect(Math.abs(lightness(to) - lightness(from)), base).toBeGreaterThan(
        LIGHTNESS_FLOOR,
      );
    }
  });

  it('keeps the slider live across the full range for extreme bases', () => {
    // The regression: a near-white (or near-black) base used to saturate a
    // fixed-direction lift, so every intensity above ~25 collapsed to the
    // same hex. Distance at 100 must exceed distance at 20, not just differ.
    const delta = (base: string, intensity: number) => {
      const { from, to } = deriveGradient(base, intensity);
      return Math.abs(lightness(to) - lightness(from));
    };

    for (const base of ['#f5f5f5', '#0a0a0a']) {
      expect(delta(base, 100), base).toBeGreaterThan(delta(base, 20));
    }
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

  it('has no contrast cliff around the lighten/darken flip point', () => {
    // Regression: switching direction used to also multiply the amount of
    // travel (headroom-scaled), so a one-RGB-step change in the base could
    // jump from "barely visible" to "high contrast". Neighbouring bases
    // across the flip must produce near-identical amounts of contrast.
    const bases = ['#d6d6d6', '#d8d8d8', '#d9d9d9', '#dbdbdb'];
    const deltas = bases.map((base) => {
      const { from, to } = deriveGradient(base, DEFAULT_GRADIENT_INTENSITY);
      return Math.abs(lightness(to) - lightness(from));
    });

    for (let i = 0; i < deltas.length - 1; i++) {
      expect(
        Math.abs(deltas[i] - deltas[i + 1]),
        `${bases[i]} vs ${bases[i + 1]}`,
      ).toBeLessThan(0.1);
    }
  });

  it('keeps the default intensity moderate, not maxed out, for a pale base', () => {
    // Regression: the direction fix alone overcorrected into "always use
    // full travel", turning white into solid medium grey behind a small
    // icon. The default should read as a light tint, not a hard swap.
    const { from, to } = deriveGradient('#f5f5f5', DEFAULT_GRADIENT_INTENSITY);
    const delta = Math.abs(lightness(to) - lightness(from));
    expect(delta).toBeGreaterThan(0.08);
    expect(delta).toBeLessThan(0.45);
  });
});
