import { TRYON_FILE_CONFIG } from './types';
import type { TryOnTranslator } from './i18n';
import { recordTryOnPhase } from './performance';

/* Shared by the storefront photo inputs and the public studio. The server
   still enforces the same formats and byte cap independently. */
export function photoFileError(file: File, t: TryOnTranslator): string | null {
  const allowedTypes = TRYON_FILE_CONFIG.allowedTypes as readonly string[];
  if (!allowedTypes.includes(file.type)) {
    return t.errUnsupported(TRYON_FILE_CONFIG.allowedExtensions.join(', '));
  }
  if (file.size > TRYON_FILE_CONFIG.maxSizeBytes) return t.errTooLarge(TRYON_FILE_CONFIG.maxSizeMB);
  return null;
}

export const TRYON_PHOTO_LONG_SIDE = 1536;
export const TRYON_PHOTO_JPEG_QUALITY = 0.9;

function fileDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('unreadable'));
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'));
    reader.readAsDataURL(file);
  });
}

/* Small JPEGs can keep their original bytes unless their orientation must
   be baked into the pixels. Large images are always drawn and need no EXIF
   inspection: both browser decoders below already apply the orientation. */
async function needsOrientation(file: File): Promise<boolean> {
  if (file.type !== 'image/jpeg') return false;
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('unreadable'));
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'));
    reader.readAsArrayBuffer(file);
  });
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return false;
  for (let offset = 2; offset + 4 <= view.byteLength;) {
    const marker = view.getUint16(offset);
    if (marker === 0xffda || marker === 0xffd9 || (marker & 0xff00) !== 0xff00) break;
    const length = view.getUint16(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > view.byteLength) break;
    if (marker === 0xffe1 && length >= 16 && view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0) {
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949;
      if ((!little && view.getUint16(tiff) !== 0x4d4d) || view.getUint16(tiff + 2, little) !== 42) break;
      const directory = tiff + view.getUint32(tiff + 4, little);
      if (directory < tiff + 8 || directory + 2 > end) break;
      const entries = view.getUint16(directory, little);
      for (let i = 0; i < entries; i += 1) {
        const entry = directory + 2 + i * 12;
        if (entry + 12 > end) break;
        if (view.getUint16(entry, little) === 0x0112 && view.getUint16(entry + 2, little) === 3 && view.getUint32(entry + 4, little) === 1) {
          const orientation = view.getUint16(entry + 8, little);
          return orientation >= 2 && orientation <= 8;
        }
      }
    }
    offset = end;
  }
  return false;
}

async function decodePhoto(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: image, width: image.width, height: image.height, release: () => image.close() };
    } catch {
      // Some browsers decode an accepted format through Image but not ImageBitmap.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('unreadable'));
      img.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Decode and prepare on the device, before any upload. Drawing applies
 *  EXIF orientation, never upscales and flattens transparency on white. */
export async function readPhotoAsDataUrl(file: File): Promise<string> {
  const startedAt = performance.now();
  if (!(TRYON_FILE_CONFIG.allowedTypes as readonly string[]).includes(file.type)) throw new Error('unreadable');
  const image = await decodePhoto(file);
  try {
    if (image.width < 1 || image.height < 1) throw new Error('unreadable');
    const scale = Math.min(1, TRYON_PHOTO_LONG_SIDE / Math.max(image.width, image.height));
    const oriented = scale === 1 && await needsOrientation(file);
    let result: string;
    if (scale === 1 && file.type === 'image/jpeg' && !oriented && file.size <= TRYON_FILE_CONFIG.maxSizeBytes) {
      result = await fileDataUrl(file);
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('unreadable');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
      const pixels = scale === 1 && !oriented && file.size <= TRYON_FILE_CONFIG.maxSizeBytes && file.type !== 'image/jpeg'
        ? context.getImageData(0, 0, canvas.width, canvas.height).data : null;
      let alpha = false;
      if (pixels) {
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] !== 255) { alpha = true; break; }
        }
      }
      if (pixels && !alpha) {
        result = await fileDataUrl(file);
      } else {
        context.globalCompositeOperation = 'destination-over';
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL('image/jpeg', TRYON_PHOTO_JPEG_QUALITY);
        if (!result.startsWith('data:image/jpeg;base64,')) throw new Error('unreadable');
      }
    }
    recordTryOnPhase('photo_prepare', performance.now() - startedAt);
    return result;
  } finally {
    image.release();
  }
}
