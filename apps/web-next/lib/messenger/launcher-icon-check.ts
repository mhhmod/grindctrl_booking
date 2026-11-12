/* What a custom launcher icon must be: a square PNG, SVG or WebP of at most
   256 KB. Pure, so the dashboard can refuse a wrong file before sending it
   and the server action can check the real bytes again (it never trusts the
   declared type). Safe to import from client code. */

export const ICON_MAX_BYTES = 256 * 1024;
export const ICON_MIMES = ['image/png', 'image/svg+xml', 'image/webp'] as const;
export type IconMime = (typeof ICON_MIMES)[number];
export const ICON_EXTENSIONS: Record<IconMime, string> = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp' };

export type IconProblem = 'too_big' | 'bad_type' | 'not_square' | 'unreadable' | 'unsafe';
/** `error` is an IconProblem or 'failed' for what the file or storage did, otherwise the action's own refusal text. */
export type LauncherIconResult = { ok: true; url: string } | { ok: false; error: string };
export type IconCheck ={ ok: true; mime: IconMime } | { ok: false; problem: IconProblem };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ascii = (bytes: Uint8Array, at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);

function pngSize(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 24 || !PNG_SIGNATURE.every((value, i) => bytes[i] === value) || ascii(bytes, 12, 4) !== 'IHDR') return null;
  return [u32be(bytes, 16), u32be(bytes, 20)];
}

function webpSize(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null;
  const kind = ascii(bytes, 12, 4);
  if (kind === 'VP8 ') return bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a ? [u16le(bytes, 26) & 0x3fff, u16le(bytes, 28) & 0x3fff] : null;
  if (kind === 'VP8L') {
    if (bytes[20] !== 0x2f) return null;
    const [b1, b2, b3, b4] = [bytes[21], bytes[22], bytes[23], bytes[24]];
    return [1 + (((b2 & 0x3f) << 8) | b1), 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))];
  }
  if (kind === 'VP8X') return [1 + u24le(bytes, 24), 1 + u24le(bytes, 27)];
  return null;
}

// Anything that could run or fetch when the file is opened on its own.
const UNSAFE_SVG = /<\s*(script|foreignObject|iframe|object|embed|image)\b|\son[a-z]+\s*=|javascript:|data:|<!ENTITY|@import|url\(\s*["']?(?!#)/i;

function svgSize(text: string): [number, number] | 'unsafe' | null {
  const source = text.replace(/^﻿/, '').trim();
  if (!/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg\b/i.test(source)) return null;
  if (UNSAFE_SVG.test(source)) return 'unsafe';
  // A reference may only point inside the file.
  for (const match of source.matchAll(/\b(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi)) if (!match[2].startsWith('#')) return 'unsafe';
  const root = /<svg\b[^>]*>/i.exec(source)?.[0] ?? '';
  const number = (name: string) => {
    const value = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([0-9.]+)\\s*(?:px)?\\s*["']`, 'i').exec(root)?.[1];
    return value ? Number(value) : NaN;
  };
  const box = /\sviewBox\s*=\s*["']\s*(-?[0-9.]+)[\s,]+(-?[0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*["']/i.exec(root);
  const [width, height] = box ? [Number(box[3]), Number(box[4])] : [number('width'), number('height')];
  return width > 0 && height > 0 ? [width, height] : null;
}

/** The real type and shape of a file's bytes, whatever its name or declared type says. */
export function checkLauncherIcon(bytes: Uint8Array): IconCheck {
  if (bytes.length > ICON_MAX_BYTES) return { ok: false, problem: 'too_big' };
  const png = pngSize(bytes);
  const webp = png ? null : webpSize(bytes);
  const svg = png || webp ? null : svgSize(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
  if (svg === 'unsafe') return { ok: false, problem: 'unsafe' };
  const size = png ?? webp ?? svg;
  if (!size) {
    // Right family of file, but the dimensions could not be read: say so plainly.
    const known = bytes.length > 12 && (ascii(bytes, 0, 4) === 'RIFF' || bytes[0] === 0x89 || /<svg/i.test(new TextDecoder().decode(bytes.subarray(0, 2048))));
    return { ok: false, problem: known ? 'unreadable' : 'bad_type' };
  }
  const [width, height] = size;
  if (width <= 0 || height <= 0) return { ok: false, problem: 'unreadable' };
  // Vector sizes are decimals, so a hair of difference is still square.
  const square = svg ? Math.abs(width - height) <= Math.max(width, height) * 0.01 : width === height;
  if (!square) return { ok: false, problem: 'not_square' };
  return { ok: true, mime: png ? 'image/png' : webp ? 'image/webp' : 'image/svg+xml' };
}
