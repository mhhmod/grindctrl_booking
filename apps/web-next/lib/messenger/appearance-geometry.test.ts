import { describe, expect, it } from 'vitest';
import { launcherRadius, launcherSizePx, panelRadius } from './appearance-geometry';

/* Both of these settings were dead: the loader hardcoded 48/56px and a pill
   radius and never read either value. They fail in the way hardest to report
   — the control moves, the dashboard preview reacts, the merchant publishes,
   and the storefront is unchanged. */

describe('launcherSizePx', () => {
  it('uses the merchant value', () => {
    expect(launcherSizePx({ launcherSizePx: 52 })).toBe(52);
  });

  it('clamps to the range the config parser enforces', () => {
    expect(launcherSizePx({ launcherSizePx: 5 })).toBe(44);
    expect(launcherSizePx({ launcherSizePx: 500 })).toBe(72);
  });

  it('falls back rather than producing NaN geometry', () => {
    expect(launcherSizePx({ launcherSizePx: Number.NaN })).toBe(56);
    expect(launcherSizePx({ launcherSizePx: undefined as unknown as number })).toBe(56);
  });
});

describe('radius', () => {
  it('keeps the circular launcher on the default, so existing stores do not shift', () => {
    expect(launcherRadius({ radiusStyle: 'soft' })).toBe('999px');
  });

  it('actually changes the corners for the other two', () => {
    expect(launcherRadius({ radiusStyle: 'rounded' })).toBe('18px');
    expect(launcherRadius({ radiusStyle: 'sharp' })).toBe('6px');
    expect(panelRadius({ radiusStyle: 'rounded' })).toBe('14px');
    expect(panelRadius({ radiusStyle: 'sharp' })).toBe('4px');
  });

  it('gives the panel its own scale — a 6px corner does not read the same at 384px as at 52px', () => {
    expect(panelRadius({ radiusStyle: 'sharp' })).not.toBe(launcherRadius({ radiusStyle: 'sharp' }));
  });

  it('treats an unknown value as the default rather than throwing', () => {
    expect(launcherRadius({ radiusStyle: 'nonsense' as never })).toBe('999px');
  });
});
