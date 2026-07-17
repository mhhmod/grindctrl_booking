import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/shopify/session-token';
import { recordTryOnShopSeen } from '@/lib/shopify/shops';
import { getTryOnSettings, saveTryOnSettings } from '@/lib/try-on/settings';

/* Embedded-admin settings API: authenticated by Shopify session token
   (Bearer, from App Bridge idToken()). The shop comes from the token,
   never from the request body. */
function authenticate(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return verifySessionToken(token);
}

export async function GET(request: NextRequest) {
  const session = authenticate(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await recordTryOnShopSeen(session.shop);
  const settings = await getTryOnSettings(session.shop);
  return NextResponse.json({ shop: session.shop, settings });
}

export async function POST(request: NextRequest) {
  const session = authenticate(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await recordTryOnShopSeen(session.shop);
  const body = (await request.json()) as {
    buttonLabel?: string;
    accentBg?: string;
    accentFg?: string;
    radiusPx?: number;
    widgetTheme?: string;
    iconBgFrom?: string;
    iconBgTo?: string;
    loadingStyle?: string;
    catalogLabel?: string;
    catalogIconPx?: number;
    catalogFontPx?: number;
    catalogPadPx?: number;
    buttonIconPx?: number;
    showDownload?: boolean;
    showWhatsapp?: boolean;
    showAddToCart?: boolean;
    showTryAgain?: boolean;
    disclaimerText?: string | null;
    loadingSteps?: string[] | null;
  };

  const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  };
  const radius = Number(body.radiusPx);
  const ok = await saveTryOnSettings(session.shop, {
    buttonLabel: body.buttonLabel?.trim() || undefined,
    accentBg: body.accentBg?.trim() || undefined,
    accentFg: body.accentFg?.trim() || undefined,
    radiusPx: Number.isFinite(radius) ? Math.max(0, Math.min(999, radius)) : undefined,
    widgetTheme: body.widgetTheme === 'dark' ? 'dark' : 'light',
    iconBgFrom: body.iconBgFrom?.trim() || undefined,
    iconBgTo: body.iconBgTo?.trim() || undefined,
    loadingStyle: (body.loadingStyle === 'pulse' || body.loadingStyle === 'bar'
      ? body.loadingStyle
      : 'steps') as 'steps' | 'pulse' | 'bar',
    catalogLabel: body.catalogLabel?.trim().slice(0, 24) || 'Try on',
    catalogIconPx: clamp(body.catalogIconPx, 10, 32, 14),
    catalogFontPx: clamp(body.catalogFontPx, 9, 20, 12),
    catalogPadPx: clamp(body.catalogPadPx, 2, 16, 6),
    buttonIconPx: clamp(body.buttonIconPx, 18, 40, 28),
    showDownload: body.showDownload !== false,
    showWhatsapp: body.showWhatsapp !== false,
    showAddToCart: body.showAddToCart !== false,
    showTryAgain: body.showTryAgain !== false,
    disclaimerText:
      typeof body.disclaimerText === 'string'
        ? body.disclaimerText.slice(0, 300).trim() || null
        : null,
    loadingSteps:
      Array.isArray(body.loadingSteps) && body.loadingSteps.length
        ? body.loadingSteps.map((s) => String(s).trim()).filter(Boolean)
        : null,
  });

  return NextResponse.json({ ok });
}
