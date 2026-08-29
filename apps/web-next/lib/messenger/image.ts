/* Image inspection for shopper attachments — pure byte work, no I/O, no
   secrets, no dependencies. Deliberately not 'server-only' so every rule
   here is directly unit-testable.

   The premise: a Content-Type header is a claim by whoever uploaded the
   file. Nothing in this module trusts it. Type comes from magic bytes,
   dimensions come from the header the format actually carries, and a JPEG
   is rewritten to drop the segments that carry a shopper's location. */

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 8000;

export type AttachmentMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const ATTACHMENT_EXTENSIONS: Record<AttachmentMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Type by content, never by the declared Content-Type. A `.png` that is
 *  actually something else returns null and the upload is rejected. */
export function detectImageType(buf: Buffer): AttachmentMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (
    buf.length >= 12 &&
    buf.toString('latin1', 0, 4) === 'RIFF' &&
    buf.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/** Null means "could not read the header" — treated as a rejection by the
 *  caller, because an image we cannot measure is one we cannot bound. */
export function readImageDimensions(buf: Buffer, mime: AttachmentMime): ImageDimensions | null {
  if (mime === 'image/png') return readPngDimensions(buf);
  if (mime === 'image/jpeg') return readJpegDimensions(buf);
  return readWebpDimensions(buf);
}

function readPngDimensions(buf: Buffer): ImageDimensions | null {
  // IHDR is mandatory and always the first chunk: length(4) type(4) w(4) h(4).
  if (buf.length < 24 || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegDimensions(buf: Buffer): ImageDimensions | null {
  let offset = 2; // past SOI
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) return null; // desynchronised — not a JPEG we can read
    const marker = buf[offset + 1];
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null;
    /* SOFn holds the frame dimensions. 0xC4 (DHT), 0xC8 (JPG) and 0xCC (DAC)
       sit inside the same numeric range and are NOT frame headers — reading
       them as one is the classic way this parser returns nonsense. */
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      if (offset + 9 >= buf.length) return null;
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    if (marker === 0xda) return null; // reached scan data without a frame header
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(buf: Buffer): ImageDimensions | null {
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8X' && buf.length >= 30) {
    // Canvas size is stored minus one, 24-bit little-endian.
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  if (chunk === 'VP8 ' && buf.length >= 30) {
    // Lossy: 14-bit dimensions follow the 3-byte start code at offset 23.
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    // Lossless: 1 signature byte, then 14 bits width-1 and 14 bits height-1.
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

/* Segments dropped when rewriting a JPEG.
   APP1  — Exif (GPS coordinates) and XMP (also carries location).
   APP13 — Photoshop IRB, which wraps IPTC location fields.
   COM   — free-text comment, where cameras and editors put anything.

   APP0 (JFIF) and APP2 (ICC colour profile) are KEPT on purpose: stripping
   the profile would visibly shift the colours of the very photo a shopper
   sent to show us a colour problem. The spec asked for "APP1/APPn"; this
   removes every APPn that can carry location and keeps the one that only
   affects rendering. */
const JPEG_SEGMENTS_TO_DROP = new Set([0xe1, 0xed, 0xfe]);

/** Rewrites a JPEG without its location-bearing metadata. Returns the input
 *  unchanged for anything it cannot parse — a photo that reaches staff is
 *  better than an upload that fails, and the caller has already confirmed
 *  the magic bytes. Non-JPEG input is returned untouched. */
export function stripJpegMetadata(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;

  const kept: Buffer[] = [buf.subarray(0, 2)];
  let offset = 2;

  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) return buf; // desynchronised; don't guess
    const marker = buf[offset + 1];

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(buf.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    // Start of scan: everything after it is entropy-coded image data with no
    // segment structure to walk, so it is copied verbatim to the end.
    if (marker === 0xda) {
      kept.push(buf.subarray(offset));
      return Buffer.concat(kept);
    }

    const length = buf.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buf.length) return buf;
    if (!JPEG_SEGMENTS_TO_DROP.has(marker)) kept.push(buf.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  return Buffer.concat(kept);
}

export type ImageRejection = 'too_large' | 'bad_type' | 'too_many_pixels' | 'unreadable';

export interface InspectedImage {
  mime: AttachmentMime;
  bytes: Buffer;
  width: number;
  height: number;
}

/** The whole gate, in the order that costs least: size, then type, then
 *  dimensions, then the rewrite. */
export function inspectAttachment(raw: Buffer): InspectedImage | { rejected: ImageRejection } {
  if (raw.length === 0) return { rejected: 'unreadable' };
  if (raw.length > MAX_ATTACHMENT_BYTES) return { rejected: 'too_large' };

  const mime = detectImageType(raw);
  if (!mime) return { rejected: 'bad_type' };

  const dims = readImageDimensions(raw, mime);
  if (!dims || dims.width <= 0 || dims.height <= 0) return { rejected: 'unreadable' };
  if (dims.width > MAX_IMAGE_DIMENSION || dims.height > MAX_IMAGE_DIMENSION) {
    return { rejected: 'too_many_pixels' };
  }

  const bytes = mime === 'image/jpeg' ? stripJpegMetadata(raw) : raw;
  return { mime, bytes, width: dims.width, height: dims.height };
}
