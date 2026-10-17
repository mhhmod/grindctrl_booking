/* The Mantine palettes are hex copies of the oklch tokens in globals.css
   (Mantine needs real colors to compute shades and contrast). This fails when
   a token changes and the matching palette entry does not. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_THEME, getVirtualColorContrast, mergeMantineTheme } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { cssVariablesResolver, mantineTheme } from './theme';

const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');

function block(selectorStart: string): string {
  const start = css.indexOf(selectorStart);
  expect(start, `no ${selectorStart} block`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

function oklchToHex(L: number, C: number, H: number): string {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${linear
    .map((c) => {
      const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
    })
    .join('')}`;
}

function token(scope: string, name: string): string {
  const match = new RegExp(String.raw`--${name}:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)`).exec(scope);
  expect(match, `--${name} missing`).not.toBeNull();
  const [L, C, H] = match!.slice(1).map(Number);
  return oklchToHex(L, C, H);
}

const light = block(':root,\n.light {'.replace('\n', css.includes('\r\n') ? '\r\n' : '\n'));
const dark = block('.dark {');
const { colors, white, black } = mantineTheme;

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('Mantine palette matches the app tokens', () => {
  it.each([
    ['inkLight-6 (light filled)', colors!.inkLight![6], light, 'primary'],
    ['inkLight-9 (light variant text)', colors!.inkLight![9], light, 'foreground'],
    ['inkLight-0', colors!.inkLight![0], light, 'card'],
    ['inkLight-1', colors!.inkLight![1], light, 'secondary'],
    ['inkLight-2', colors!.inkLight![2], light, 'border'],
    ['inkDark-7 (dark filled)', colors!.inkDark![7], dark, 'primary'],
    ['inkDark-0 (dark light-variant text)', colors!.inkDark![0], dark, 'foreground'],
    ['black', black, light, 'foreground'],
    ['white', white, light, 'card'],
    ['gray-0', colors!.gray![0], light, 'card'],
    ['gray-1', colors!.gray![1], light, 'background'],
    ['gray-2', colors!.gray![2], light, 'secondary'],
    ['gray-4', colors!.gray![4], light, 'border'],
    ['gray-6', colors!.gray![6], light, 'muted-foreground'],
    ['dark-0', colors!.dark![0], dark, 'foreground'],
    ['dark-2', colors!.dark![2], dark, 'muted-foreground'],
    ['dark-4', colors!.dark![4], dark, 'border'],
    ['dark-6', colors!.dark![6], dark, 'secondary'],
    ['dark-7', colors!.dark![7], dark, 'card'],
    ['dark-8', colors!.dark![8], dark, 'background'],
  ] as const)('%s equals --%s', (_label, actual, scope, name) => {
    expect(actual).toBe(token(scope, name));
  });
});

/* Mantine picks the filled shade per color scheme (primaryShade) and pairs it
   with theme.white or theme.black. Every pair a merchant can see has to clear
   WCAG AA for normal text, which Mantine's own red does not. */
describe('filled shades stay readable', () => {
  it.each([
    ['brand light', colors!.inkLight![6], white!],
    ['brand light hover', colors!.inkLight![7], white!],
    ['brand dark', colors!.inkDark![7], black!],
    ['brand dark hover', colors!.inkDark![8], black!],
    ['red light', colors!.red![6], white!],
    ['red light hover', colors!.red![7], white!],
    ['red dark', colors!.red![7], white!],
    ['red dark hover', colors!.red![8], white!],
  ] as const)('%s clears 4.5:1', (_label, background, text) => {
    expect(contrast(background, text)).toBeGreaterThanOrEqual(4.5);
  });
});

/* Product v16: the tokens tokens.json adds, their Mantine palettes and the
   pairs the boards put text on. tokens.json is the design source, so the CSS
   is checked against it as well as the palettes against the CSS. */
const spec = JSON.parse(
  readFileSync(join(__dirname, '../../docs/handoff/product-v16/tokens.json'), 'utf8'),
) as { dashboard: { color: Record<string, { value: string; dark?: string }> } };

const v16Start = css.indexOf('/* Product v16 dashboard (docs/handoff');
const v16Light = css.slice(css.indexOf(':root,', v16Start), css.indexOf('}', css.indexOf(':root,', v16Start)));
const v16Dark = css.slice(css.indexOf('.dark {', v16Start), css.indexOf('}', css.indexOf('.dark {', v16Start)));

function raw(scope: string, name: string): string {
  const match = new RegExp(String.raw`--${name}:\s*([^;]+);`).exec(scope);
  expect(match, `--${name} missing`).not.toBeNull();
  return match![1].trim().replace(/\s+/g, ' ');
}

/* A translucent token over an opaque surface, composited in sRGB the way the
   browser paints it. */
function over(value: string, surface: string): string {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+) \/ ([\d.]+)%\)$/.exec(value);
  expect(match, `${value} is not a translucent oklch`).not.toBeNull();
  const [L, C, H, A] = match!.slice(1).map(Number);
  const top = oklchToHex(L, C, H);
  return `#${[1, 3, 5]
    .map((i) => {
      const t = parseInt(top.slice(i, i + 2), 16);
      const b = parseInt(surface.slice(i, i + 2), 16);
      return Math.round(t * (A / 100) + b * (1 - A / 100)).toString(16).padStart(2, '0');
    })
    .join('')}`;
}

const STATUS = ['success', 'attention', 'danger'] as const;
const NEW_TOKENS = {
  panel: 'gc-panel',
  success: 'gc-success',
  successSoft: 'gc-success-soft',
  attention: 'gc-attention',
  attentionSoft: 'gc-attention-soft',
  danger: 'gc-danger',
  dangerSoft: 'gc-danger-soft',
  alert: 'gc-alert',
} as const;

describe('v16 tokens match tokens.json', () => {
  it.each(Object.entries(NEW_TOKENS))('%s is --%s in both themes', (key, name) => {
    const entry = spec.dashboard.color[key];
    expect(raw(v16Light, name)).toBe(entry.value);
    expect(raw(v16Dark, name)).toBe(entry.dark === 'same value' ? entry.value : entry.dark);
  });

  it('puts pure white on the count, in both themes', () => {
    expect(raw(v16Light, 'gc-on-alert')).toBe('oklch(1 0 0)');
    expect(raw(v16Dark, 'gc-on-alert')).toBe('oklch(1 0 0)');
  });

  it.each([...Object.values(NEW_TOKENS), 'gc-on-alert'])('Tailwind has a color utility for --%s', (name) => {
    expect(css).toContain(`--color-${name}: var(--${name});`);
  });

  it.each([
    ['card', 20],
    ['dialog', 20],
    ['pill', 999],
    ['input', 12],
    ['segmented', 14],
    ['segment', 10],
    ['icon-tile', 12],
    ['plan', 18],
  ] as const)('radius %s is %ipx, in Tailwind and in Mantine', (name, px) => {
    const value = raw(v16Light, `gc-radius-${name}`);
    expect(value.endsWith('rem') ? Number.parseFloat(value) * 16 : Number.parseFloat(value)).toBe(px);
    expect(css).toContain(`--radius-gc-${name}: var(--gc-radius-${name});`);
    expect(mantineTheme.radius?.[name]).toBe(`var(--gc-radius-${name})`);
  });
});

describe('v16 Mantine palettes match the tokens', () => {
  it.each(STATUS)('%s', (name) => {
    const lightPalette = colors![`${name}Light`]!;
    const darkPalette = colors![`${name}Dark`]!;
    const ink = token(v16Light, `gc-${name}`);
    const darkInk = token(v16Dark, `gc-${name}`);
    expect(lightPalette[6], 'light filled').toBe(ink);
    expect(lightPalette[9], 'light variant text').toBe(ink);
    expect(lightPalette[1], 'light variant fill').toBe(token(v16Light, `gc-${name}-soft`));
    expect(darkPalette[7], 'dark filled').toBe(darkInk);
    expect(darkPalette[3], 'dark outline').toBe(darkInk);
    expect(darkPalette[4], 'dark text').toBe(darkInk);
    expect(darkPalette[0], 'dark light variant text').toBe(darkInk);
  });

  it('alert is --gc-alert where either theme fills with it', () => {
    expect(colors!.alert![6]).toBe(token(v16Light, 'gc-alert'));
    expect(colors!.alert![7]).toBe(token(v16Dark, 'gc-alert'));
  });
});

describe('v16 pairs stay readable', () => {
  const theme = mergeMantineTheme(DEFAULT_THEME, mantineTheme);

  it.each(STATUS)('%s filled, in both themes, with the text Mantine picks for it', (name) => {
    expect(getVirtualColorContrast(theme.colors[name] as never, theme, 'light')).toBe('var(--mantine-color-white)');
    expect(getVirtualColorContrast(theme.colors[name] as never, theme, 'dark')).toBe('var(--mantine-color-black)');
    for (const shade of [6, 7]) expect(contrast(colors![`${name}Light`]![shade], white!)).toBeGreaterThanOrEqual(4.5);
    for (const shade of [7, 8]) expect(contrast(colors![`${name}Dark`]![shade], black!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(STATUS)('%s text on its soft fill, on every dashboard surface', (name) => {
    expect(contrast(token(v16Light, `gc-${name}`), token(v16Light, `gc-${name}-soft`))).toBeGreaterThanOrEqual(4.5);
    for (const surface of [token(v16Dark, 'gc-panel'), token(dark, 'card'), token(dark, 'background')]) {
      const fill = over(raw(v16Dark, `gc-${name}-soft`), surface);
      expect(contrast(token(v16Dark, `gc-${name}`), fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(STATUS)('%s text straight on the panel', (name) => {
    expect(contrast(token(v16Light, `gc-${name}`), token(v16Light, 'gc-panel'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(v16Dark, `gc-${name}`), token(v16Dark, 'gc-panel'))).toBeGreaterThanOrEqual(4.5);
  });

  it('a count on the alert orange', () => {
    const count = token(v16Light, 'gc-alert');
    expect(contrast(count, token(v16Light, 'gc-on-alert'))).toBeGreaterThanOrEqual(4.5);
    expect(colors!.alert![8], 'dark hover').not.toBe(count);
    expect(contrast(colors!.alert![8], token(v16Light, 'gc-on-alert'))).toBeGreaterThanOrEqual(4.5);
  });

  it('text and muted text on the panel', () => {
    expect(contrast(token(light, 'foreground'), token(v16Light, 'gc-panel'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(light, 'muted-foreground'), token(v16Light, 'gc-panel'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(dark, 'foreground'), token(v16Dark, 'gc-panel'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(dark, 'muted-foreground'), token(v16Dark, 'gc-panel'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('v16 bridge', () => {
  const theme = mergeMantineTheme(DEFAULT_THEME, mantineTheme);
  const resolved = cssVariablesResolver(theme);

  it.each(STATUS)('the %s light variant is its soft fill with the status color on it', (name) => {
    for (const scheme of [resolved.light, resolved.dark]) {
      expect(scheme[`--mantine-color-${name}-light`]).toBe(`var(--gc-${name}-soft)`);
      expect(scheme[`--mantine-color-${name}-light-color`]).toBe(`var(--gc-${name})`);
      expect(scheme[`--mantine-color-${name}-light-hover`]).toContain(`var(--gc-${name}-soft)`);
    }
  });

  it("Mantine's own success color is --gc-success", () => {
    expect(resolved.light['--mantine-color-success']).toBe('var(--gc-success)');
    expect(resolved.dark['--mantine-color-success']).toBe('var(--gc-success)');
  });

  it('every token the bridge names exists in both themes', () => {
    const named = new Set(
      [...Object.values(resolved.light), ...Object.values(mantineTheme.radius ?? {})].flatMap((value) =>
        [...String(value).matchAll(/var\(--(gc-[a-z-]+)\)/g)].map((m) => m[1]),
      ),
    );
    expect(named.size).toBeGreaterThan(0);
    for (const name of named) {
      expect(v16Light, `--${name} in light`).toContain(`--${name}:`);
      if (!name.startsWith('gc-radius-')) expect(v16Dark, `--${name} in dark`).toContain(`--${name}:`);
    }
  });

  it('a filled count badge and an Indicator on alert use --gc-on-alert', () => {
    const badge = mantineTheme.components!.Badge!.vars as (t: unknown, p: object) => object;
    expect(badge(theme, { color: 'alert' })).toEqual({ root: { '--badge-color': 'var(--gc-on-alert)' } });
    expect(badge(theme, { color: 'alert', variant: 'light' })).toEqual({});
    expect(badge(theme, { color: 'success' })).toEqual({});
    const indicator = mantineTheme.components!.Indicator!.vars as (t: unknown, p: object) => object;
    expect(indicator(theme, { color: 'alert' })).toEqual({ root: { '--indicator-text-color': 'var(--gc-on-alert)' } });
  });
});
