// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  detectImageType,
  inspectAttachment,
  readImageDimensions,
  stripJpegMetadata,
  MAX_ATTACHMENT_BYTES,
} from './image';

/* Fixtures are hand-built byte structures rather than real photos: nothing
   in this module decodes pixels, so a correct header is the whole input. */

function png(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'latin1');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function segment(marker: number, payload: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head[0] = 0xff;
  head[1] = marker;
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

function sof0(width: number, height: number): Buffer {
  // precision(1) height(2) width(2) components(1) + one component descriptor
  const payload = Buffer.alloc(9);
  payload[0] = 8;
  payload.writeUInt16BE(height, 1);
  payload.writeUInt16BE(width, 3);
  payload[5] = 1;
  return segment(0xc0, payload);
}

const GPS_MARKER = Buffer.from('GPSLatitudeRef-51.5074N', 'latin1');

function jpeg(options: { width: number; height: number; withExif?: boolean; withIcc?: boolean }): Buffer {
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
  parts.push(segment(0xe0, Buffer.from('JFIF\0\0\0\0\0\0', 'latin1')));
  if (options.withExif) {
    parts.push(segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), GPS_MARKER])));
  }
  if (options.withIcc) {
    parts.push(segment(0xe2, Buffer.from('ICC_PROFILE\0 colour data', 'latin1')));
  }
  parts.push(segment(0xfe, Buffer.from('shot in London', 'latin1'))); // COM
  // A DHT sits in the 0xC0-0xCF range but is NOT a frame header.
  parts.push(segment(0xc4, Buffer.from([0x00, 0x01, 0x02, 0x03])));
  parts.push(sof0(options.width, options.height));
  parts.push(Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]));
  parts.push(Buffer.from([0x12, 0x34, 0x56, 0xff, 0xd9]));
  return Buffer.concat(parts);
}

function webpVp8x(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0, 'latin1');
  buf.write('WEBP', 8, 'latin1');
  buf.write('VP8X', 12, 'latin1');
  const w = width - 1;
  const h = height - 1;
  buf[24] = w & 0xff;
  buf[25] = (w >> 8) & 0xff;
  buf[26] = (w >> 16) & 0xff;
  buf[27] = h & 0xff;
  buf[28] = (h >> 8) & 0xff;
  buf[29] = (h >> 16) & 0xff;
  return buf;
}

describe('detectImageType', () => {
  it('identifies each accepted format by its magic bytes', () => {
    expect(detectImageType(png(4, 4))).toBe('image/png');
    expect(detectImageType(jpeg({ width: 4, height: 4 }))).toBe('image/jpeg');
    expect(detectImageType(webpVp8x(4, 4))).toBe('image/webp');
  });

  it('rejects a file whose extension lies about its contents', () => {
    // The classic upload bypass: %PDF- bytes named photo.png.
    expect(detectImageType(Buffer.from('%PDF-1.7 not an image at all', 'latin1'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a', 'latin1'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('readImageDimensions', () => {
  it('reads PNG IHDR', () => {
    expect(readImageDimensions(png(1200, 800), 'image/png')).toEqual({ width: 1200, height: 800 });
  });

  it('reads the JPEG frame header and is not fooled by the DHT before it', () => {
    expect(readImageDimensions(jpeg({ width: 640, height: 480 }), 'image/jpeg')).toEqual({
      width: 640,
      height: 480,
    });
  });

  it('reads a VP8X WebP canvas', () => {
    expect(readImageDimensions(webpVp8x(1920, 1080), 'image/webp')).toEqual({ width: 1920, height: 1080 });
  });
});

describe('stripJpegMetadata', () => {
  it('removes GPS-bearing Exif and the free-text comment', () => {
    const withGps = jpeg({ width: 100, height: 100, withExif: true });
    expect(withGps.includes(GPS_MARKER)).toBe(true);

    const cleaned = stripJpegMetadata(withGps);
    expect(cleaned.includes(GPS_MARKER)).toBe(false);
    expect(cleaned.includes(Buffer.from('shot in London', 'latin1'))).toBe(false);
  });

  it('keeps the colour profile, so the photo still looks like the photo', () => {
    const cleaned = stripJpegMetadata(jpeg({ width: 100, height: 100, withExif: true, withIcc: true }));
    expect(cleaned.includes(Buffer.from('ICC_PROFILE', 'latin1'))).toBe(true);
    // Still a readable JPEG afterwards — the rewrite must not desynchronise.
    expect(detectImageType(cleaned)).toBe('image/jpeg');
    expect(readImageDimensions(cleaned, 'image/jpeg')).toEqual({ width: 100, height: 100 });
  });

  it('preserves the entropy-coded scan data verbatim', () => {
    const cleaned = stripJpegMetadata(jpeg({ width: 8, height: 8, withExif: true }));
    expect(cleaned.subarray(cleaned.length - 5)).toEqual(
      Buffer.from([0x12, 0x34, 0x56, 0xff, 0xd9]),
    );
  });

  it('returns unparseable input untouched rather than corrupting it', () => {
    const junk = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]);
    expect(stripJpegMetadata(junk)).toEqual(junk);
  });
});

describe('inspectAttachment', () => {
  it('accepts a valid image and reports its true type', () => {
    const result = inspectAttachment(png(200, 200));
    expect('rejected' in result).toBe(false);
    if ('rejected' in result) return;
    expect(result.mime).toBe('image/png');
    expect(result.width).toBe(200);
  });

  it('rejects oversized, mistyped, unmeasurable and huge-canvas input', () => {
    expect(inspectAttachment(Buffer.alloc(MAX_ATTACHMENT_BYTES + 1))).toEqual({ rejected: 'too_large' });
    expect(inspectAttachment(Buffer.from('%PDF-1.7', 'latin1'))).toEqual({ rejected: 'bad_type' });
    expect(inspectAttachment(png(9000, 10))).toEqual({ rejected: 'too_many_pixels' });
    expect(inspectAttachment(Buffer.alloc(0))).toEqual({ rejected: 'unreadable' });
  });

  it('strips metadata as part of accepting a JPEG', () => {
    const result = inspectAttachment(jpeg({ width: 50, height: 50, withExif: true }));
    if ('rejected' in result) throw new Error('expected acceptance');
    expect(result.bytes.includes(GPS_MARKER)).toBe(false);
  });
});
