import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateTryOn,
  getTryOnMode,
  TryOnFinalizationPendingError,
  TryOnResultPersistenceError,
  TryOnResultSchemaNotReadyError,
  TryOnResultUnavailableError,
} from '@/lib/try-on/service';
import { TryOnUnavailableError } from '@/lib/try-on/entitlement';
import { clientIp, publicApiRatelimit } from '@/lib/ratelimit';
import { isAllowedGarmentUrl } from '@/lib/try-on/image-runner';
import { validateProductId, validateSessionId } from '@/lib/try-on/validator';
import {
  normalizeVariantId,
  verifyTryOnAttempt,
  verifyTryOnSession,
} from '@/lib/try-on/storefront-context';
import {
  legacyStorefrontCompatEnabled,
  warnLegacyStorefrontCompat,
} from '@/lib/try-on/legacy-compat';
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
 *   sessionId: string, // short-lived signed capability
 *   productId: string,
 *   storefrontNonce?: string,
 *   variantId?: string,
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
    /* Real generations cost provider money: rate-limit per client network.
       No trusted proxy header at all → one shared bucket (fail closed). */
    const ip = clientIp(request) ?? 'unknown';
    const limit = await publicApiRatelimit.limit(ip);
    if (!limit.success) {
      const message = 'Too many try-on requests. Please try again in a few minutes.';
      const retryAfterSec = Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000));
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      );
    }

    const body = (await request.json()) as {
      sessionId?: string;
      attemptId?: unknown;
      productId?: string;
      storefrontNonce?: unknown;
      variantId?: unknown;
      shop?: unknown;
      requestKey?: unknown;
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

    if (body.requestKey !== undefined) {
      const message = 'Client billing overrides are not allowed.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 400 },
      );
    }

    // â”€â”€ Validate session â”€â”€
    const sv = validateSessionId(sessionId);
    if (!sv.ok) {
      const res: TryOnJobApiResponse = { ok: false, message: sv.error, error: sv.error };
      return NextResponse.json(res, { status: 400 });
    }

    // â”€â”€ Validate product â”€â”€
    const pv = validateProductId(productId);
    if (!pv.ok) {
      const res: TryOnJobApiResponse = { ok: false, message: pv.error, error: pv.error };
      return NextResponse.json(res, { status: 400 });
    }

    const secret = process.env.SHOPIFY_API_SECRET?.trim();
    if (!secret) {
      const message = 'Try-on is not configured.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 503 },
      );
    }

    const rawVariantId = body.variantId;
    const variantId = normalizeVariantId(rawVariantId);
    if (rawVariantId !== undefined && rawVariantId !== null && rawVariantId !== '' && !variantId) {
      const message = 'Invalid storefront variant.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 400 },
      );
    }
    const storefrontNonce = typeof body.storefrontNonce === 'string'
      ? body.storefrontNonce
      : undefined;
    const sessionAuthorization = verifyTryOnSession(secret, sessionId, {
      productId,
      variantId: rawVariantId === undefined ? undefined : variantId,
      nonce: storefrontNonce,
    });
    if (!sessionAuthorization) {
      const message = 'Invalid or expired try-on session.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 401 },
      );
    }
    if (
      sessionAuthorization.purpose === 'legacy-compat' &&
      !legacyStorefrontCompatEnabled()
    ) {
      const message = 'Legacy compatibility is not enabled.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 401 },
      );
    }
    if (
      sessionAuthorization.purpose === 'legacy-compat' &&
      !publicApiRatelimit.configured
    ) {
      const message = 'Legacy compatibility is temporarily unavailable.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 503 },
      );
    }

    const attemptId = typeof body.attemptId === 'string' ? body.attemptId : '';
    const compatibilityRequest =
      !attemptId &&
      sessionAuthorization.purpose === 'legacy-compat' &&
      legacyStorefrontCompatEnabled();
    let authorization = attemptId
      ? verifyTryOnAttempt(secret, attemptId, sessionAuthorization)
      : null;
    if (attemptId && body.shop !== undefined) {
      const message = 'Client billing overrides are not allowed.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 400 },
      );
    }
    if (compatibilityRequest) {
      // Old clients echo the returned `shop` field, which is now null. Any
      // non-null shop remains a forbidden authority injection.
      if (body.shop !== undefined && body.shop !== null) {
        const message = 'Legacy compatibility sessions cannot select a billing shop.';
        return NextResponse.json(
          { ok: false, message, error: message } satisfies TryOnJobApiResponse,
          { status: 401 },
        );
      }
      authorization = sessionAuthorization;
      warnLegacyStorefrontCompat('generation_non_billable', null);
    }
    if (
      !authorization ||
      (authorization.purpose === 'storefront' &&
        !storefrontNonce &&
        !compatibilityRequest)
    ) {
      const message = 'Invalid or missing generation attempt.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 401 },
      );
    }

    // â”€â”€ Validate photo source / explicit mock path â”€â”€
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

    // â”€â”€ Validate photo payload (live mode requires the actual image) â”€â”€
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

    // â”€â”€ Optional store-product garment (Shopify CDN only; SSRF guard) â”€â”€
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

    if (authorization.purpose === 'public-demo' && garmentUrl) {
      const message = 'Public demo sessions cannot select a storefront garment.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 400 },
      );
    }
    if (
      (authorization.purpose === 'storefront' || authorization.purpose === 'legacy-compat') &&
      (!garmentUrl || garmentUrl !== authorization.canonicalGarmentUrl)
    ) {
      const message = 'Garment does not match the verified storefront product.';
      return NextResponse.json(
        { ok: false, message, error: message } satisfies TryOnJobApiResponse,
        { status: 401 },
      );
    }

    const job = await generateTryOn(
      authorization,
      resolvedPhotoSource,
      photoData,
      authorization.purpose === 'storefront' || authorization.purpose === 'legacy-compat'
        ? authorization.canonicalGarmentUrl ?? undefined
        : undefined,
      productName,
    );

    const res = toJobResponse(job);
    return NextResponse.json(res, { status: 200 });
  } catch (error) {
    if (
      error instanceof TryOnFinalizationPendingError ||
      error instanceof TryOnResultUnavailableError ||
      error instanceof TryOnResultSchemaNotReadyError ||
      error instanceof TryOnResultPersistenceError
    ) {
      if (
        error instanceof TryOnResultSchemaNotReadyError ||
        error instanceof TryOnResultPersistenceError
      ) {
        console.error('[try-on] result_persistence_failed', {
          reason: error.code,
          jobId: error.jobId,
        });
      }
      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          jobId: error.jobId,
          message: error.message,
          error: error.message,
        } satisfies TryOnJobApiResponse,
        {
          status:
            error instanceof TryOnResultUnavailableError
              ? 409
              : 503,
        },
      );
    }
    if (error instanceof TryOnUnavailableError) {
      return NextResponse.json(
        {
          ok: false,
          code: 'TRYON_UNAVAILABLE',
          message: error.message,
        } satisfies TryOnJobApiResponse,
        { status: 200 },
      );
    }

    if (error instanceof SyntaxError) {
      const res: TryOnJobApiResponse = {
        ok: false,
        message: 'Invalid JSON payload.',
        error: 'Invalid JSON payload.',
      };
      return NextResponse.json(res, { status: 400 });
    }

    /* Log the real cause server-side; never echo internal error strings
       (paths, provider messages) back to an anonymous caller. */
    console.error('[try-on] generation_failed', {
      correlationId: randomUUID(),
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    const message = 'Unable to generate try-on preview right now. Please try again.';
    const res: TryOnJobApiResponse = { ok: false, message, error: message };
    return NextResponse.json(res, { status: 500 });
  }
}
