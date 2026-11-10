import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { readLimitedText } from '@/lib/http/read-limited-body';
import { publicApiRatelimit } from '@/lib/ratelimit';
import {
  RequestRateLimitError,
  rateLimitErrorResponse,
  requireRateLimit,
} from '@/lib/request-rate-limit';
import { parsePrivacyRequest, wooPrivacyEmailHash } from '@/lib/woo/privacy';
import { verifyWooSignedRequest, wooSignedRequestErrorResponse } from '@/lib/woo/signed-request';

const MAX_BODY_BYTES = 4 * 1024;

export function privacyJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export type PrivacyCall =
  | { ok: true; siteId: string; email: string; page: number; emailHash: string }
  | { ok: false; response: Response };

/** Shared front half of the export and erase routes: bounded body, signature
 * and nonce, per-site rate limit, then validation. The limiter runs only
 * after the signature so unsigned callers cannot spend a site's budget. */
export async function readPrivacyCall(request: NextRequest, label: string): Promise<PrivacyCall> {
  const read = await readLimitedText(request, MAX_BODY_BYTES);
  if (!read.ok) return { ok: false, response: privacyJson({ error: 'invalid_request' }, read.status) };
  const rawBody = read.text;

  const verified = await verifyWooSignedRequest(request, rawBody);
  if (!verified.ok) {
    console.warn(`[woo] ${label} rejected`, { code: verified.code, siteId: verified.siteId });
    return { ok: false, response: wooSignedRequestErrorResponse(verified) };
  }

  try {
    await requireRateLimit(publicApiRatelimit, `woo-privacy:${verified.siteId}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) {
      return { ok: false, response: rateLimitErrorResponse(error) };
    }
    throw error;
  }

  let input: ReturnType<typeof parsePrivacyRequest> = null;
  try {
    input = parsePrivacyRequest(JSON.parse(rawBody));
  } catch {
    input = null;
  }
  if (!input) {
    console.warn(`[woo] ${label} rejected`, { code: 'invalid_request', siteId: verified.siteId });
    return { ok: false, response: privacyJson({ error: 'invalid_request' }, 400) };
  }

  const emailHash = wooPrivacyEmailHash(verified.siteId, input.email);
  if (!emailHash) {
    console.error(`[woo] ${label} failed`, { code: 'unavailable', siteId: verified.siteId });
    return { ok: false, response: privacyJson({ error: 'unavailable' }, 503) };
  }
  return { ok: true, siteId: verified.siteId, email: input.email, page: input.page, emailHash };
}
