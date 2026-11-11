import { type NextRequest, NextResponse } from 'next/server';
import { clientIp, publicApiRatelimit } from '@/lib/ratelimit';
import { rateLimitErrorResponse, RequestRateLimitError, requireRateLimit } from '@/lib/request-rate-limit';
import { WOO_PLUGIN_RELEASE } from '@/lib/woo/plugin-release';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public WordPress updater metadata, built from the exact downloadable ZIP. */
export async function GET(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `woo-plugin-update:${clientIp(request) ?? 'unknown'}`);
    return NextResponse.json(WOO_PLUGIN_RELEASE, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
