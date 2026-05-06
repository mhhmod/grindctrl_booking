/* ─── Try-On Agent — Shared Types ─── */

/** Job status lifecycle */
export type TryOnJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** Runtime mode (env-driven) */
export type TryOnMode = 'mock' | 'live';

/** Seeded product definition */
export interface TryOnProduct {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  details: string[];
}

/** Session payload returned by POST /api/try-on/session */
export interface TryOnSession {
  sessionId: string;
  productId: string;
  createdAt: string;
}

/**
 * Photo source discriminator for generation requests.
 * - 'upload': A customer-supplied photo was uploaded.
 * - 'mock':   Use a demo placeholder (MVP mock mode only).
 */
export type TryOnPhotoSource = 'upload' | 'mock';

/** Generate request body (client → server) */
export interface TryOnGenerateRequest {
  sessionId: string;
  productId: string;
  /**
   * Required. Indicates how the customer photo was supplied.
   * The API rejects requests that omit this field so that callers
   * cannot accidentally trigger generation without a photo reference.
  */
  photoSource: TryOnPhotoSource;
  /** Lightweight server-facing reference for an uploaded photo. */
  photoReference?: string;
  /** Explicitly opts into the demo placeholder photo path. */
  useMockPhoto?: boolean;
}

/** Individual job record */
export interface TryOnJob {
  jobId: string;
  sessionId: string;
  productId: string;
  status: TryOnJobStatus;
  resultImageUrl?: string;
  message?: string;
  createdAt: string;
  completedAt?: string;
  meta: TryOnJobMeta;
}

/** Job metadata for future extensibility */
export interface TryOnJobMeta {
  runtime: TryOnMode;
  provider: string;
  costEstimate: number;
}

/** Normalized API envelope */
export interface TryOnApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** API envelope returned by try-on job endpoints. */
export interface TryOnJobApiResponse {
  ok: boolean;
  jobId?: string;
  status?: TryOnJobStatus;
  resultImageUrl?: string;
  productId?: string;
  message?: string;
  meta?: TryOnJobMeta;
  error?: string;
}

/** Validation result */
export interface TryOnValidationResult {
  ok: boolean;
  error?: string;
}

/** File validation config */
export const TRYON_FILE_CONFIG = {
  maxSizeBytes: 8 * 1024 * 1024, // 8 MB
  maxSizeMB: 8,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
} as const;
