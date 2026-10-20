/* The on-phone photo check (02-try-on.md TryOn-Check, phase zero item 17),
   run in our iframe before anything is sent. These are the checks simple
   pixel rules can make honestly, in well under a second: enough light, not
   washed out, and sharp. Head to feet, one person and standing straight
   need an on-device model, which waits for the owner's decision on its
   cost (06-phase-zero.md, the owner decisions), so they are not shown as
   passed. A failed check is advice: "Use this photo anyway" always works. */

export type PhotoIssue = 'dark' | 'bright' | 'blurry';

export type PhotoStats = {
  /** Mean luma, 0 to 255. */
  meanLuma: number;
  /** Share of pixels that are almost white, 0 to 1. */
  blownOut: number;
  /** Variance of the Laplacian over the grey image: higher is sharper. */
  sharpness: number;
};

export type PhotoCheck = { light: boolean; sharp: boolean; issue: PhotoIssue | null };

/** The longest side the check reads, so a 12 megapixel photo costs the same as a small one. */
export const CHECK_SIDE = 320;

const DARK_LUMA = 55;
const BLOWN_OUT_SHARE = 0.35;
const MIN_SHARPNESS = 25;

/** Stats from RGBA pixels (canvas ImageData order). */
export function photoStats(pixels: Uint8ClampedArray | number[], width: number, height: number): PhotoStats {
  const count = width * height;
  if (!count) return { meanLuma: 0, blownOut: 0, sharpness: 0 };
  const grey = new Float32Array(count);
  let sum = 0;
  let blown = 0;
  for (let i = 0; i < count; i += 1) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    grey[i] = luma;
    sum += luma;
    if (luma > 245) blown += 1;
  }

  // Variance of the 4-neighbour Laplacian, the usual blur measure.
  let lapSum = 0;
  let lapSq = 0;
  let lapCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap = grey[i - width] + grey[i + width] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      lapSum += lap;
      lapSq += lap * lap;
      lapCount += 1;
    }
  }
  const lapMean = lapCount ? lapSum / lapCount : 0;
  const sharpness = lapCount ? lapSq / lapCount - lapMean * lapMean : 0;

  return { meanLuma: sum / count, blownOut: blown / count, sharpness };
}

export function judgePhoto(stats: PhotoStats): PhotoCheck {
  const dark = stats.meanLuma < DARK_LUMA;
  const bright = !dark && stats.blownOut > BLOWN_OUT_SHARE;
  const sharp = stats.sharpness >= MIN_SHARPNESS;
  const light = !dark && !bright;
  const issue: PhotoIssue | null = dark ? 'dark' : bright ? 'bright' : sharp ? null : 'blurry';
  return { light, sharp, issue };
}

/** Reads a photo in the browser and judges it. Resolves to null when the
 *  browser cannot read it (an unusual format, no canvas): the shopper then
 *  goes on without a check rather than being blocked by one. */
export async function checkPhoto(dataUrl: string): Promise<PhotoCheck | null> {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('unreadable'));
      img.src = dataUrl;
    });
    const scale = Math.min(1, CHECK_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return judgePhoto(photoStats(data, width, height));
  } catch {
    return null;
  }
}
