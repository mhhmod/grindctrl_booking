import { NextRequest, NextResponse } from 'next/server';
import { getTryOnSettings } from '@/lib/try-on/settings';

/* Public, non-sensitive styling config for the storefront block.
   CORS-open on purpose: it only exposes what the button looks like. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get('shop');
  const settings = await getTryOnSettings(shop);

  return NextResponse.json(
    {
      buttonLabel: settings.buttonLabel,
      accentBg: settings.accentBg,
      accentFg: settings.accentFg,
      radiusPx: settings.radiusPx,
      widgetTheme: settings.widgetTheme,
      iconBgFrom: settings.iconBgFrom,
      iconBgTo: settings.iconBgTo,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
