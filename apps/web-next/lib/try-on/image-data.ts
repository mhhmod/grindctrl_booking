export type RasterMime = 'image/jpeg' | 'image/png' | 'image/webp';
export const TRYON_RESULT_MAX_BYTES = 16 * 1024 * 1024;

/** Validate bounded canonical base64 and raster signatures, not just the
 * caller/provider's MIME claim. This is not an image-quality evaluation. */
export function decodeRasterDataUrl(
  value: string,
  maxBytes: number,
): {
  mime: RasterMime;
  bytes: Buffer;
} | null {
  if (value.length > 32 + Math.ceil(maxBytes / 3) * 4) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 === 1) return null;
  const mime = match[1] as RasterMime;
  const bytes = Buffer.from(match[2], 'base64');
  if (
    !bytes.length ||
    bytes.length > maxBytes ||
    bytes.toString('base64').replace(/=+$/u, '') !== match[2].replace(/=+$/u, '')
  )
    return null;
  const matches =
    mime === 'image/jpeg'
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : mime === 'image/png'
        ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.length >= 12 &&
          bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
          bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return matches ? { mime, bytes } : null;
}
