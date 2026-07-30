/* Derives the second gradient stop from a single merchant colour.

   The widget's icon gradient used to ask for two hex pickers (start, end).
   Picking a pair that reads as "on purpose" rather than "random" is a
   designer's call, so most merchants either left the default or produced
   something muddy. Here the merchant picks ONE brand colour and we derive
   a partner stop from it, with an intensity slider controlling how far
   apart the two stops sit.

   Kept dependency-free (no colour library) so it can be imported by the
   settings form, the live preview, and the storefront embed alike. */

export type GradientStops = { from: string; to: string };

export const DEFAULT_GRADIENT_INTENSITY = 55;

// Used when the stored hex is missing or unparseable. A neutral grey pair
// keeps the gradient visible instead of throwing or rendering "#NaNNaNNaN".
const FALLBACK: GradientStops = { from: '#3a3a3a', to: '#6b6b6b' };

// How far the derived stop can rotate around the hue wheel, in degrees.
const HUE_ROTATION_DEG = 8;

// Cap on derived lightness. 1.0 is pure white, which reads as "no gradient"
// against light UI backgrounds, so stop just short of it.
const MAX_LIGHTNESS = 0.97;

/* Parses "#rrggbb" or "rrggbb", any case, into lowercase "#rrggbb".
   Returns null for anything else so callers can fall back rather than
   propagate a NaN-shaped colour. */
export function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value ?? '');
  if (!match) return null;
  return `#${match[1].toLowerCase()}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const int = parseInt(hex.slice(1), 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

function hueToRgbChannel(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) {
    const v = Math.round(l * 255);
    const hex = v.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }

  const hueNorm = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgbChannel(p, q, hueNorm + 1 / 3);
  const g = hueToRgbChannel(p, q, hueNorm);
  const b = hueToRgbChannel(p, q, hueNorm - 1 / 3);

  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clampIntensity(intensity: number): number {
  if (!Number.isFinite(intensity)) return DEFAULT_GRADIENT_INTENSITY;
  return Math.min(100, Math.max(0, intensity));
}

export function deriveGradient(baseHex: string, intensity: number): GradientStops {
  const from = normalizeHex(baseHex);
  if (!from) return FALLBACK;

  const amount = clampIntensity(intensity) / 100; // 0..1
  const [r, g, b] = hexToRgb(from);
  const [h, s, l] = rgbToHsl(r, g, b);

  // Lift lightness toward white across the REMAINING headroom (1 - l), not
  // by a fixed amount. A fixed lift (e.g. l + 0.3) clips at 1.0 for pale
  // brand colours, so a near-white base and its "lighter" partner would
  // both round to the same hex — an invisible gradient. Lifting a fraction
  // of the headroom always leaves visible daylight above the base, however
  // close to white it already is.
  const liftedL = Math.min(MAX_LIGHTNESS, l + (1 - l) * amount);

  // Saturation eases off as lightness rises, otherwise a dark, saturated
  // base (which has plenty of headroom) drags its lightened partner into a
  // muddy, over-saturated pastel instead of a clean tint.
  const easedS = s * (1 - amount * 0.4);

  const to = hslToHex(h + HUE_ROTATION_DEG, easedS, liftedL);

  return { from, to };
}
