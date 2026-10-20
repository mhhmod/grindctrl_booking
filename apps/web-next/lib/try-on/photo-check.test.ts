import { describe, expect, it } from 'vitest';
import { judgePhoto, photoStats } from './photo-check';

/* Synthetic photos, as canvas pixels (RGBA). */
function image(width: number, height: number, pixel: (x: number, y: number) => number): number[] {
  const out: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = pixel(x, y);
      out.push(v, v, v, 255);
    }
  }
  return out;
}

const W = 40;
const H = 60;
const detailed = (base: number) => image(W, H, (x, y) => base + (((x >> 1) + (y >> 1)) % 2 ? 40 : -40));

describe('the on-phone photo check', () => {
  it('passes a well-lit, detailed photo', () => {
    expect(judgePhoto(photoStats(detailed(130), W, H))).toEqual({ light: true, sharp: true, issue: null });
  });

  it('asks for more light on a dark photo', () => {
    expect(judgePhoto(photoStats(detailed(30), W, H))).toMatchObject({ light: false, issue: 'dark' });
  });

  it('asks to step out of the light on a washed-out photo', () => {
    const washed = image(W, H, (x, y) => (y < 40 ? 252 : 120 + ((x + y) % 2 ? 30 : -30)));
    expect(judgePhoto(photoStats(washed, W, H))).toMatchObject({ light: false, issue: 'bright' });
  });

  it('asks to hold still on a photo with no detail', () => {
    expect(judgePhoto(photoStats(image(W, H, () => 128), W, H))).toEqual({ light: true, sharp: false, issue: 'blurry' });
  });

  it('measures sharpness the same way at any size', () => {
    const small = photoStats(detailed(130), 20, 30);
    expect(small.sharpness).toBeGreaterThan(25);
    expect(photoStats([], 0, 0)).toEqual({ meanLuma: 0, blownOut: 0, sharpness: 0 });
  });
});
