/* The Mantine palettes are hex copies of the oklch tokens in globals.css
   (Mantine needs real colors to compute shades and contrast). This fails when
   a token changes and the matching palette entry does not. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mantineTheme } from './theme';

const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');

function block(selectorStart: string): string {
  const start = css.indexOf(selectorStart);
  expect(start, `no ${selectorStart} block`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

function token(scope: string, name: string): string {
  const match = new RegExp(String.raw`--${name}:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)`).exec(scope);
  expect(match, `--${name} missing`).not.toBeNull();
  const [L, C, H] = match!.slice(1).map(Number);
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

const light = block(':root,\n.light {'.replace('\n', css.includes('\r\n') ? '\r\n' : '\n'));
const dark = block('.dark {');
const { colors, white, black } = mantineTheme;

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
