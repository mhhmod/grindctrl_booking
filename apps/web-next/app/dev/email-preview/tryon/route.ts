import { NextRequest } from 'next/server';
import type { TryonEmailTouch } from '@/components/email/tryon-campaign-email';
import { renderTryonCampaignEmail } from '@/lib/email/tryon-campaign';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  const touchValue = Number(request.nextUrl.searchParams.get('touch') || 1);
  const touch = ([1, 2, 3, 4].includes(touchValue) ? touchValue : 1) as TryonEmailTouch;
  const businessName = request.nextUrl.searchParams.get('businessName')?.trim() || 'M10 Sabry';
  const recipientName = request.nextUrl.searchParams.get('recipientName')?.trim() || undefined;
  const origin = request.nextUrl.origin;
  const rendered = await renderTryonCampaignEmail({
    touch,
    businessName,
    recipientName,
    logoSrc: `${origin}/campaigns/grindctrl-logo-white.png`,
    proofImageSrc: `${origin}/campaigns/grindctrl-tryon-proof.png`,
  });

  return new Response(rendered.html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
