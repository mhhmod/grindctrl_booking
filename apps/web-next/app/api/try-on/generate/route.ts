import { NextRequest, NextResponse } from 'next/server';
import { generateTryOn, getTryOnMode } from '@/lib/try-on/service';
import { checkRateLimit } from '@/lib/try-on/rate-limit';
import { isAllowedGarmentUrl } from '@/lib/try-on/image-runner';
import { validateProductId, validateSessionId } from '@/lib/try-on/validator';
import { TRYON_FILE_CONFIG } from '@/lib/try-on/types';
import type {
  TryOnJob,
  TryOnJobApiResponse,
  TryOnPhotoSource,
} from '@/lib/try-on/types';

const VALID_PHOTO_SOURCES: TryOnPhotoSource[] = ['upload', 'mock'];

/* Base64 inflates bytes by ~4/3; allow the 8MB file cap plus data-URL header. */
const MAX_PHOTO_DATA_LENGTH = Math.ceil((TRYON_FILE_CONFIG.maxSizeBytes * 4) / 3) + 64;
const PHOTO_DATA_PREFIX_RE = /^data:image\/(jpeg|png|webp);base64,/;

function toJobResponse(job: TryOnJob): TryOnJobApiResponse {
  return {
    ok: true,
    jobId: job.jobId,
    status: job.status,
    resultImageUrl: job.resultImageUrl,
    productId: job.productId,
    message: job.message,
    meta: job.meta,
  };
}

/**
 * POST /api/try-on/generate
 * Triggers a try-on generation job.
 *
 * Body: {
 *   sessionId: string,
 *   productId: string,
 *   shop?: string,
 *   photoSource?: 'upload' | 'mock',
 *   photoReference?: string,
 *   useMockPhoto?: boolean
 * }
 *
 * The endpoint intentionally rejects calls that provide only sessionId +
 * productId. Callers must provide a customer photo reference or explicitly opt
 * into the mock photo path.
 */
export async function POST(request: NextRequest) {
  try {
    /* Real generations cost provider money: rate-limit per client IP. */
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limit = checkRateLimit(ip);
    if (!limit.ok) {
      const message = 'Too many try-on requests. Please try again in a few minutes.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec ?? 60) } },
      );
    }

    const body = (await request.json()) as {
      sessionId?: string;
      productId?: string;
      shop?: unknown;
      photoSource?: string;
      photoReference?: string;
      photoData?: string;
      garmentUrl?: string;
      productName?: string;
      useMockPhoto?: boolean;
    };

    const sessionId = body.sessionId ?? '';
    const productId = body.productId ?? '';
    const photoSource = body.photoSource ?? '';
    const photoReference = body.photoReference?.trim() ?? '';
    const hasPhotoReference =
      photoReference.length > 0 ||
      (typeof body.photoData === 'string' && body.photoData.length > 0);
    const usesMockPhoto = body.useMockPhoto === true || photoSource === 'mock';

    // ── Validate session ──
    const sv = validateSessionId(sessionId);
    if (!sv.ok) {
      const res: TryOnJobApiResponse = { ok: false, message: sv.error, error: sv.error };
      return NextResponse.json(res, { status: 400 });
    }

    // ── Validate product ──
    const pv = validateProductId(productId);
    if (!pv.ok) {
      const res: TryOnJobApiResponse = { ok: false, message: pv.error, error: pv.error };
      return NextResponse.json(res, { status: 400 });
    }

    // ── Validate photo source / explicit mock path ──
    if (!usesMockPhoto && !hasPhotoReference) {
      const message =
        'A customer photo reference is required, unless useMockPhoto is true for demo preview.';
      const res: TryOnJobApiResponse = {
        ok: false,
        message,
        error: message,
      };
      return NextResponse.json(res, { status: 400 });
    }

    const resolvedPhotoSource: TryOnPhotoSource = usesMockPhoto ? 'mock' : 'upload';
    if (!VALID_PHOTO_SOURCES.includes(resolvedPhotoSource)) {
      const res: TryOnJobApiResponse = {
        ok: false,
        message: 'Invalid photo source.',
        error: 'Invalid photo source.',
      };
      return NextResponse.json(res, { status: 400 });
    }

    // ── Validate photo payload (live mode requires the actual image) ──
    const photoData = body.photoData;
    if (photoData !== undefined) {
      if (
        typeof photoData !== 'string' ||
        !PHOTO_DATA_PREFIX_RE.test(photoData) ||
        photoData.length > MAX_PHOTO_DATA_LENGTH
      ) {
        const message = 'Photo must be a jpeg, png, or webp image up to 8 MB.';
        return NextResponse.json(
          { ok: false, message, error: message } satisfies TryOnJobApiResponse,
          { status: 400 },
        );
      }
    } else if (getTryOnMode() === 'live' && resolvedPhotoSource === 'upload') {
      const message = 'Photo upload is required for try-on generation.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 400 },
      );
    }

    // ── Optional store-product garment (Shopify CDN only; SSRF guard) ──
    const garmentUrl = typeof body.garmentUrl === 'string' ? body.garmentUrl : undefined;
    if (garmentUrl && !isAllowedGarmentUrl(garmentUrl)) {
      const message = 'Garment image must come from the Shopify CDN.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 400 },
      );
    }
    const productName =
      typeof body.productName === 'string' ? body.productName.slice(0, 120) : undefined;

    const job = await generateTryOn(
      sessionId,
      productId,
      resolvedPhotoSource,
      photoData,
      garmentUrl,
      productName,
      body.shop,
    );

    const res = toJobResponse(job);
    return NextResponse.json(res, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      const res: TryOnJobApiResponse = {
        ok: false,
        message: 'Invalid JSON payload.',
        error: 'Invalid JSON payload.',
      };
      return NextResponse.json(res, { status: 400 });
    }

    const message =
      error instanceof Error ? error.message : 'Unable to generate try-on preview.';
    const res: TryOnJobApiResponse = { ok: false, message, error: message };
    return NextResponse.json(res, { status: 500 });
  }
}
