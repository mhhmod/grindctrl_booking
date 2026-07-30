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
// Chosen by eye — not derived from any colour theory, just what reads as
// "a matching partner" rather than "a random hue" across test swatches.
const HUE_ROTATION_DEG = 8;

// Cap on derived lightness. 1.0 is pure white, which reads as "no gradient"
// against light UI backgrounds, so stop just short of it.
const MAX_LIGHTNESS = 0.97;

// Symmetric floor for the darkening branch, so a near-black base doesn't
// bottom out at pure black either.
const MIN_LIGHTNESS = 1 - MAX_LIGHTNESS;

// Above this lightness there isn't enough headroom left to lighten without
// hitting MAX_LIGHTNESS partway through the intensity range, so those bases
// darken instead. Deliberately NOT a 0.5 midpoint: a plain "#1a73e8" blue
// (l ≈ 0.506) is common mid-range input and must keep lightening exactly as
// before — only the pale end (cream/off-white territory) needs to flip.
const LIGHTEN_UNTIL_L = 0.85;

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

  // Move lightness across whichever headroom the base actually has, not
  // always toward white. Always-lighten was the original approach, but a
  // fixed direction runs out of room for a pale base: once l is near
  // MAX_LIGHTNESS, (1 - l) is tiny, so every intensity above ~25 saturates
  // the cap and collapses to the same hex — the slider goes dead exactly
  // for the common case of white/cream/off-white brand colours.
  //
  // Instead, pick the direction with room in it: lighten toward white when
  // the base is dark (headroom = 1 - l), darken toward black when the base
  // is already light (headroom = l). Either way the distance moved is a
  // fraction of the ACTUAL headroom, so the slider stays live across the
  // full 0..100 range regardless of how pale or how dark the base is.
  const liftedL =
    l < LIGHTEN_UNTIL_L
      ? Math.min(MAX_LIGHTNESS, l + (1 - l) * amount)
      : Math.max(MIN_LIGHTNESS, l - l * amount);

  // Saturation eases off as lightness rises, otherwise a dark, saturated
  // base (which has plenty of headroom) drags its lightened partner into a
  // muddy, over-saturated pastel instead of a clean tint.
  const easedS = s * (1 - amount * 0.4);

  const to = hslToHex(h + HUE_ROTATION_DEG, easedS, liftedL);

  return { from, to };
}
