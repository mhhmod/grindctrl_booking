import { TRYON_FILE_CONFIG } from './types';
import type { TryOnTranslator } from './i18n';

/* The checks every try-on photo input makes before reading a file: an
   allowed type (HEIC included, which the server converts) and the size cap. */
export function photoFileError(file: File, t: TryOnTranslator): string | null {
  const allowedTypes = TRYON_FILE_CONFIG.allowedTypes as readonly string[];
  if (!allowedTypes.includes(file.type)) {
    return t.errUnsupported(TRYON_FILE_CONFIG.allowedExtensions.join(', '));
  }
  if (file.size > TRYON_FILE_CONFIG.maxSizeBytes) return t.errTooLarge(TRYON_FILE_CONFIG.maxSizeMB);
  return null;
}

export function readPhotoAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'));
    reader.readAsDataURL(file);
  });
}
