// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { sanitizeShopperPhoto } from './photo-sanitize';

/* A phone photo as a phone writes it: GPS coordinates, the device, and a
   rotation the pixels do not have yet (EXIF Orientation 6, 90° clockwise). */
async function phonePhoto(): Promise<string> {
  const bytes = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#c33' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Make: 'PhoneMaker', Model: 'Phone 15' },
      IFD3: {
        GPSLatitudeRef: 'N', GPSLatitude: '30/1 2/1 4/1',
        GPSLongitudeRef: 'E', GPSLongitude: '31/1 14/1 9/1',
      },
    })
    .toBuffer();
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

function bytesOf(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

describe('sanitizeShopperPhoto', () => {
  it('strips GPS and every other EXIF field from a small JPEG, applying its orientation', async () => {
    const original = await phonePhoto();
    const before = await sharp(bytesOf(original)).metadata();
    expect(before.orientation).toBe(6);
    expect(bytesOf(original).includes(Buffer.from('PhoneMaker'))).toBe(true);
    // The GPS IFD pointer (tag 0x8825), in either byte order.
    expect(before.exif!.includes(Buffer.from([0x88, 0x25])) || before.exif!.includes(Buffer.from([0x25, 0x88]))).toBe(true);

    const cleaned = await sanitizeShopperPhoto(original);

    expect(cleaned).toMatch(/^data:image\/jpeg;base64,/);
    const out = bytesOf(cleaned!);
    const after = await sharp(out).metadata();
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.iptc).toBeUndefined();
    expect(after.orientation).toBeUndefined();
    expect(out.includes(Buffer.from('Exif\0\0'))).toBe(false);
    expect(out.includes(Buffer.from('PhoneMaker'))).toBe(false);
    // Orientation 6 is now in the pixels: the 40x20 photo stands 20x40.
    expect([after.width, after.height]).toEqual([20, 40]);
  });

  it('re-encodes png and webp as metadata-free JPEG too', async () => {
    for (const format of ['png', 'webp'] as const) {
      const bytes = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .toFormat(format)
        .withExif({ IFD0: { Make: 'PhoneMaker' } })
        .toBuffer();
      const cleaned = await sanitizeShopperPhoto(`data:image/${format};base64,${bytes.toString('base64')}`);
      const meta = await sharp(bytesOf(cleaned!)).metadata();
      expect(meta.format).toBe('jpeg');
      expect(meta.exif).toBeUndefined();
    }
  });

  it('refuses what is not a readable image', async () => {
    expect(await sanitizeShopperPhoto('data:image/png;base64,PGh0bWw+')).toBeNull();
    expect(await sanitizeShopperPhoto('data:text/html;base64,PGI+aGk8L2I+')).toBeNull();
    // A real JPEG signature with nothing decodable after it.
    expect(await sanitizeShopperPhoto(`data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0, 1, 2, 3]).toString('base64')}`)).toBeNull();
  });
});
