import type { NextRequest } from 'next/server';
import { readLimitedJson, isJsonObject } from '@/lib/http/read-limited-body';
import { clientIp, publicApiRatelimit, proxyShopReadRatelimit } from '@/lib/ratelimit';
import { requireRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';
import { pickMerchantCopy } from '@/lib/try-on/merchant-copy';
import { getTryOnSettings } from '@/lib/try-on/settings';
import { checkPickToken, isStoreOrigin, savePickedSpot } from '@/lib/try-on/pick-token';
import { parseSpot } from '@/lib/try-on/placement';

/* POST /api/try-on/pick/verify and /api/try-on/pick/save, called by the
   store tab Pick a spot opened (tryon-engine.js, pick-spot.js).

   Bodies are text/plain JSON with credentials omitted: a simple request, so
   no preflight has to grant an origin before the link is checked, and no
   dashboard cookie is ever involved on the store's origin. The response is
   readable only by the store origin the link was signed for. */

type Reply = { body: Record<string, unknown>; status: number; origin?: string; retryAfter?: number };

function respond({ body, status, origin, retryAfter }: Reply): Response {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  if (retryAfter) headers['Retry-After'] = String(retryAfter);
  return Response.json(body, { status, headers });
}

async function handle(request: NextRequest, save: boolean): Promise<Reply> {
  await requireRateLimit(publicApiRatelimit, `pick:ip:${clientIp(request) ?? 'unknown'}`);
  const origin = request.headers.get('origin');
  if (!isStoreOrigin(origin)) return { body: { code: 'forbidden' }, status: 403 };
  const read = await readLimitedJson(request, 4096);
  if (!read.ok || !isJsonObject(read.value)) return { body: { code: 'invalid' }, status: 400 };
  const body = read.value;
  const expired = (cors: boolean): Reply => ({ body: { code: 'expired' }, status: 410, origin: cors ? origin : undefined });
  const checked = await checkPickToken(body.token, origin, body.claim);
  if (!checked.ok) return expired(checked.cors);
  await requireRateLimit(proxyShopReadRatelimit, `pick:shop:${checked.shop}`);
  if (save) {
    // An invalid spot never spends the link: the tab keeps its selection.
    const spot = parseSpot(body);
    if (!spot) return { body: { code: 'invalid' }, status: 400, origin };
    const saved = await savePickedSpot(body.token, origin, body.claim, spot);
    return saved.ok ? { body: { ok: true }, status: 200, origin } : expired(saved.cors);
  }
  // The preview is the real button in the owner's colours, also where the page has none yet.
  const settings = await getTryOnSettings(checked.shop);
  const copy = pickMerchantCopy(settings, body.locale === 'ar' ? 'ar' : 'en');
  return {
    status: 200,
    origin,
    body: {
      ok: true,
      preset: checked.preset,
      button: {
        buttonLabel: copy.buttonLabel,
        accentBg: settings.accentBg,
        accentFg: settings.accentFg,
        radiusPx: settings.radiusPx,
        iconBgFrom: settings.iconBgFrom,
        iconBgTo: settings.iconBgTo,
        buttonIconPx: settings.buttonIconPx,
      },
    },
  };
}

export async function pickRequest(request: NextRequest, save: boolean): Promise<Response> {
  try {
    return respond(await handle(request, save));
  } catch (error) {
    // No CORS grant: the store tab reads these as a failed request and offers a retry.
    if (error instanceof RequestRateLimitError) {
      return respond({ body: { code: 'rate_limited' }, status: error.status, retryAfter: error.retryAfterSeconds });
    }
    console.error('[pick] request failed', { code: save ? 'pick_save' : 'pick_verify' });
    return respond({ body: { code: 'unavailable' }, status: 503 });
  }
}
