import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { TryonEmailTouch } from '@/components/email/tryon-campaign-email';
import { sendTryonCampaignTouch } from '@/lib/email/tryon-campaign-sender';

export const runtime = 'nodejs';

type SendBody = {
  to?: unknown;
  touch?: unknown;
  businessName?: unknown;
  recipientName?: unknown;
  threadMessageId?: unknown;
};

function hasValidToken(request: NextRequest) {
  const expected = process.env.TRYON_EMAIL_SEND_TOKEN;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  if (!hasValidToken(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }
  if (process.env.TRYON_EMAIL_LIVE_SEND_ENABLED !== 'true') {
    return NextResponse.json({ ok: false, error: 'Campaign email sending is disabled.' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as SendBody;
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : undefined;
    const threadMessageId = typeof body.threadMessageId === 'string' ? body.threadMessageId.trim() : undefined;
    const touch = Number(body.touch) as TryonEmailTouch;

    if (!isEmail(to)) {
      return NextResponse.json({ ok: false, error: 'A valid recipient email is required.' }, { status: 400 });
    }
    if (!businessName || businessName.length > 140) {
      return NextResponse.json({ ok: false, error: 'businessName is required and must be 140 characters or fewer.' }, { status: 400 });
    }
    if (![1, 2, 3, 4].includes(touch)) {
      return NextResponse.json({ ok: false, error: 'touch must be 1, 2, 3, or 4.' }, { status: 400 });
    }
    if (recipientName && recipientName.length > 140) {
      return NextResponse.json({ ok: false, error: 'recipientName must be 140 characters or fewer.' }, { status: 400 });
    }
    if (touch > 1 && (!threadMessageId || !/^<[^<>\s]+>$/.test(threadMessageId))) {
      return NextResponse.json({ ok: false, error: 'A valid threadMessageId from touch 1 is required for follow-ups.' }, { status: 400 });
    }

    const result = await sendTryonCampaignTouch({ to, touch, businessName, recipientName, threadMessageId });
    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }
    console.error('Try-On campaign email send failed', error);
    return NextResponse.json({ ok: false, error: 'Unable to send campaign email.' }, { status: 500 });
  }
}
