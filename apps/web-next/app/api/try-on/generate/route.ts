import { NextRequest, NextResponse } from 'next/server';
import { generateTryOn } from '@/lib/try-on/service';
import { validateProductId, validateSessionId } from '@/lib/try-on/validator';
import type { TryOnApiResponse, TryOnJob, TryOnPhotoSource } from '@/lib/try-on/types';

const VALID_PHOTO_SOURCES: TryOnPhotoSource[] = ['upload', 'mock'];

/**
 * POST /api/try-on/generate
 * Triggers a try-on generation job.
 *
 * Body: {
 *   sessionId: string,
 *   productId: string,
 *   photoSource?: 'upload' | 'mock',
 *   customerPhotoDataUrl?: string,
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
    const body = (await request.json()) as {
      sessionId?: string;
      productId?: string;
      photoSource?: string;
      customerPhotoDataUrl?: string;
      photoReference?: string;
      useMockPhoto?: boolean;
    };

    const sessionId = body.sessionId ?? '';
    const productId = body.productId ?? '';
    const photoSource = body.photoSource ?? '';
    const customerPhotoDataUrl = body.customerPhotoDataUrl?.trim() ?? '';
    const photoReference = body.photoReference?.trim() ?? '';
    const hasPhotoReference = customerPhotoDataUrl.length > 0 || photoReference.length > 0;
    const usesMockPhoto = body.useMockPhoto === true || photoSource === 'mock';

    // ── Validate session ──
    const sv = validateSessionId(sessionId);
    if (!sv.ok) {
      const res: TryOnApiResponse = { ok: false, error: sv.error };
      return NextResponse.json(res, { status: 400 });
    }

    // ── Validate product ──
    const pv = validateProductId(productId);
    if (!pv.ok) {
      const res: TryOnApiResponse = { ok: false, error: pv.error };
      return NextResponse.json(res, { status: 400 });
    }

    // ── Validate photo source / explicit mock path ──
    if (!usesMockPhoto && !hasPhotoReference) {
      const res: TryOnApiResponse = {
        ok: false,
        error:
          'A customer photo reference is required, unless useMockPhoto is true for demo preview.',
      };
      return NextResponse.json(res, { status: 400 });
    }

    const resolvedPhotoSource: TryOnPhotoSource = usesMockPhoto ? 'mock' : 'upload';
    if (!VALID_PHOTO_SOURCES.includes(resolvedPhotoSource)) {
      const res: TryOnApiResponse = {
        ok: false,
        error: 'Invalid photo source.',
      };
      return NextResponse.json(res, { status: 400 });
    }

    const job = await generateTryOn(sessionId, productId, resolvedPhotoSource);

    const res: TryOnApiResponse<TryOnJob> = { ok: true, data: job };
    return NextResponse.json(res, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      const res: TryOnApiResponse = { ok: false, error: 'Invalid JSON payload.' };
      return NextResponse.json(res, { status: 400 });
    }

    const message =
      error instanceof Error ? error.message : 'Unable to generate try-on preview.';
    const res: TryOnApiResponse = { ok: false, error: message };
    return NextResponse.json(res, { status: 500 });
  }
}
