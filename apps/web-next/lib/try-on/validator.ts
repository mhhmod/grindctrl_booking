/* ─── Try-On Agent — Input Validation ─── */

import { TRYON_FILE_CONFIG, type TryOnValidationResult } from './types';
import { getProduct } from './products';

/**
 * Validates an uploaded file on the client side.
 * Returns { ok: true } or { ok: false, error: "..." }.
 */
export function validateUploadedFile(file: File): TryOnValidationResult {
  if (!file) {
    return { ok: false, error: 'No file provided.' };
  }

  if (!TRYON_FILE_CONFIG.allowedTypes.includes(file.type as typeof TRYON_FILE_CONFIG.allowedTypes[number])) {
    const allowed = TRYON_FILE_CONFIG.allowedExtensions.join(', ');
    return {
      ok: false,
      error: `Unsupported file type. Please upload an image file (${allowed}).`,
    };
  }

  if (file.size > TRYON_FILE_CONFIG.maxSizeBytes) {
    return {
      ok: false,
      error: `File is too large. Maximum size is ${TRYON_FILE_CONFIG.maxSizeMB} MB.`,
    };
  }

  return { ok: true };
}

/* Shopify product handles: lowercase slugs. Catalog products also match. */
const PRODUCT_HANDLE_RE = /^[a-z0-9][a-z0-9\-_]{0,99}$/;

/**
 * Validates a product ID: either a seeded catalog product or a
 * store-product handle (whose garment image arrives with the request).
 */
export function validateProductId(productId: string): TryOnValidationResult {
  if (!productId) {
    return { ok: false, error: 'Product ID is required.' };
  }

  if (!getProduct(productId) && !PRODUCT_HANDLE_RE.test(productId)) {
    return { ok: false, error: `Product "${productId}" not found.` };
  }

  return { ok: true };
}

/**
 * Validates a session ID is present.
 */
export function validateSessionId(sessionId: string): TryOnValidationResult {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    return { ok: false, error: 'Session ID is required.' };
  }

  return { ok: true };
}
