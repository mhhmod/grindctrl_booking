import 'server-only';
import sharp from 'sharp';
import { decodeRasterDataUrl } from './image-data';

/* Every shopper photo is decoded and re-encoded here before it leaves for
   the image provider, whatever the browser did to it first. The browser
   path keeps small JPEGs byte for byte, original EXIF included (GPS, device,
   time), and a caller can skip the browser entirely. Re-encoding applies
   the EXIF orientation to the pixels and writes no metadata at all: sharp
   drops EXIF, XMP, IPTC and ICC unless asked to keep them, and it is never
   asked here. */

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
/** A decompression bomb stops here, well above any real phone photo. */
const MAX_INPUT_PIXELS = 50_000_000;

/** A metadata-free JPEG data URL of the photo, or null when it is not a
 *  readable jpeg, png or webp. */
export async function sanitizeShopperPhoto(dataUrl: string): Promise<string | null> {
  const parsed = decodeRasterDataUrl(dataUrl, MAX_PHOTO_BYTES);
  if (!parsed) return null;
  try {
    // Lenient decoding: a photo with a recoverable flaw (a bad checksum, a
    // truncated tail) still makes a look; one that cannot decode throws.
    const output = await sharp(parsed.bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'none' })
      .rotate()
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${output.toString('base64')}`;
  } catch {
    return null;
  }
}
