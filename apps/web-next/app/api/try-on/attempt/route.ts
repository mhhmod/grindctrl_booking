import { NextRequest, NextResponse } from 'next/server';
import { clientIp, publicApiRatelimit, rateLimitedResponse } from '@/lib/ratelimit';
import {
  isTryOnNonce,
  normalizeVariantId,
  signTryOnAttempt,
  verifyTryOnSession,
} from '@/lib/try-on/storefront-context';
import { validateProductId } from '@/lib/try-on/validator';
import type { TryOnApiResponse, TryOnAttempt } from '@/lib/try-on/types';

/** Mints one server-authorized generation attempt from a valid base session.
 * The browser nonce distinguishes explicit user actions; retrying this exact
 * request deterministically returns the same attempt/request key. */
export async function POST(request: NextRequest) {
  try {
    const limit = await publicApiRatelimit.limit(clientIp(request) ?? 'unknown');
    if (!limit.success) return rateLimitedResponse(limit.reset);

    const body = (await request.json()) as {
      sessionId?: unknown;
      productId?: unknown;
      variantId?: unknown;
      storefrontNonce?: unknown;
      attemptNonce?: unknown;
      shop?: unknown;
      requestKey?: unknown;
    };
    if (body.shop !== undefined || body.requestKey !== undefined) {
      return NextResponse.json(
        { ok: false, error: 'Client billing overrides are not allowed.' } satisfies TryOnApiResponse,
        { status: 400 },
      );
    }
    if (typeof body.sessionId !== 'string' || typeof body.productId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Invalid try-on session.' } satisfies TryOnApiResponse,
        { status: 400 },
      );
    }
    if (!validateProductId(body.productId).ok || !isTryOnNonce(body.attemptNonce)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid generation attempt.' } satisfies TryOnApiResponse,
        { status: 400 },
      );
    }

    const secret = process.env.SHOPIFY_API_SECRET?.trim();
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: 'Try-on is not configured.' } satisfies TryOnApiResponse,
        { status: 503 },
      );
    }

    const rawVariantId = body.variantId;
    const variantId = normalizeVariantId(rawVariantId);
    if (rawVariantId !== undefined && rawVariantId !== null && rawVariantId !== '' && !variantId) {
      return NextResponse.json(
        { ok: false, error: 'Invalid storefront variant.' } satisfies TryOnApiResponse,
        { status: 400 },
      );
    }
    const storefrontNonce = typeof body.storefrontNonce === 'string'
      ? body.storefrontNonce
      : undefined;
    const session = verifyTryOnSession(secret, body.sessionId, {
      productId: body.productId,
      variantId: rawVariantId === undefined ? undefined : variantId,
      nonce: storefrontNonce,
    });
    if (!session || (session.purpose === 'storefront' && !storefrontNonce)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired try-on session.' } satisfies TryOnApiResponse,
        { status: 401 },
      );
    }

    const attempt = signTryOnAttempt(secret, {
      session,
      attemptNonce: body.attemptNonce,
    });
    return NextResponse.json(
      {
        ok: true,
        data: {
          attemptId: attempt.token,
          expiresAt: new Date(attempt.claims.exp * 1000).toISOString(),
        },
      } satisfies TryOnApiResponse<TryOnAttempt>,
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON payload.' } satisfies TryOnApiResponse,
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'Unable to create generation attempt.' } satisfies TryOnApiResponse,
      { status: 500 },
    );
  }
}
