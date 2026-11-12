import { describe, expect, it } from 'vitest';
import { checkLauncherIcon, ICON_MAX_BYTES } from './launcher-icon-check';

const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};
const webpX = (w: number, h: number) => {
  const b = new Uint8Array(30);
  b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
  b.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8);
  for (const [at, v] of [[24, w - 1], [27, h - 1]]) b.set([v & 255, (v >> 8) & 255, (v >> 16) & 255], at);
  return b;
};
const svg = (source: string) => new TextEncoder().encode(source);

describe('a custom launcher icon', () => {
  it('takes a square PNG, WebP or SVG', () => {
    expect(checkLauncherIcon(png(128, 128))).toEqual({ ok: true, mime: 'image/png' });
    expect(checkLauncherIcon(webpX(96, 96))).toEqual({ ok: true, mime: 'image/webp' });
    expect(checkLauncherIcon(svg('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>'))).toEqual({ ok: true, mime: 'image/svg+xml' });
    expect(checkLauncherIcon(svg('<svg xmlns="http://www.w3.org/2000/svg" width="48px" height="48"><circle r="4"/></svg>'))).toEqual({ ok: true, mime: 'image/svg+xml' });
  });

  it('refuses a rectangle, naming the problem', () => {
    expect(checkLauncherIcon(png(128, 64))).toEqual({ ok: false, problem: 'not_square' });
    expect(checkLauncherIcon(webpX(96, 48))).toEqual({ ok: false, problem: 'not_square' });
    expect(checkLauncherIcon(svg('<svg viewBox="0 0 40 20"></svg>'))).toEqual({ ok: false, problem: 'not_square' });
  });

  it('refuses a file over 256 KB, and a type that is not an image it can use', () => {
    expect(checkLauncherIcon(new Uint8Array(ICON_MAX_BYTES + 1))).toEqual({ ok: false, problem: 'too_big' });
    expect(checkLauncherIcon(new TextEncoder().encode('GIF89a not supported'))).toEqual({ ok: false, problem: 'bad_type' });
    // A JPEG renamed .png is judged by its bytes.
    expect(checkLauncherIcon(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]))).toEqual({ ok: false, problem: 'bad_type' });
  });

  it('refuses an SVG that could run or fetch anything', () => {
    for (const body of [
      '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>',
      '<svg viewBox="0 0 1 1" onload="alert(1)"></svg>',
      '<svg viewBox="0 0 1 1"><foreignObject/></svg>',
      '<svg viewBox="0 0 1 1"><image href="https://evil.example/x.png"/></svg>',
      '<svg viewBox="0 0 1 1"><use href="https://evil.example/x.svg#a"/></svg>',
      '<svg viewBox="0 0 1 1"><a xlink:href="javascript:alert(1)"/></svg>',
      '<svg viewBox="0 0 1 1"><style>@import url(https://evil.example/a.css);</style></svg>',
    ]) expect(checkLauncherIcon(svg(body))).toEqual({ ok: false, problem: 'unsafe' });
    // A reference inside the file is fine.
    expect(checkLauncherIcon(svg('<svg viewBox="0 0 8 8"><defs><path id="a" d="M0 0h8v8z"/></defs><use href="#a"/></svg>')).ok).toBe(true);
  });
});
