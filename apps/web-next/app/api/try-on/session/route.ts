import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/try-on/service';
import { validateProductId } from '@/lib/try-on/validator';
import type { TryOnApiResponse, TryOnSession } from '@/lib/try-on/types';

/**
 * POST /api/try-on/session
 * Creates a new try-on session for a product.
 * Body: { productId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { productId?: string };
    const productId = body.productId ?? '';

    const validation = validateProductId(productId);
    if (!validation.ok) {
      const res: TryOnApiResponse = { ok: false, error: validation.error };
      return NextResponse.json(res, { status: 400 });
    }

    const session = createSession(productId);
    const res: TryOnApiResponse<TryOnSession> = { ok: true, data: session };
    return NextResponse.json(res, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      const res: TryOnApiResponse = { ok: false, error: 'Invalid JSON payload.' };
      return NextResponse.json(res, { status: 400 });
    }

    const res: TryOnApiResponse = { ok: false, error: 'Unable to create try-on session.' };
    return NextResponse.json(res, { status: 500 });
  }
}
