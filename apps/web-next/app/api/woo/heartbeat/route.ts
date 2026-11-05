import { NextRequest, NextResponse } from 'next/server';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import {
  WOO_MIN_PLUGIN_VERSION,
  verifyWooSignedRequest,
  wooSignedRequestErrorResponse,
  type WooSignedRequestFailure,
} from '@/lib/woo/signed-request';
import { normalizeWooRestBase } from '@/lib/woo/rest-base';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 16 * 1024;
// WordPress reports "6.8" as readily as "6.8.1": two to four numeric parts.
const VERSION_RE = /^\d{1,5}(?:\.\d{1,5}){1,3}(?:[-+][0-9A-Za-z.-]{1,64})?$/;
const TIMEZONE_RE = /^[A-Za-z0-9_+:/-]{1,100}$/;

type HeartbeatInput = {
  homeUrl: string;
  pluginVersion: string;
  wpVersion: string;
  wcVersion: string | null;
  timezone: string | null;
  currency: string | null;
  restUrl: unknown;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function normalizeHomeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

function requiredVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const version = value.trim();
  return version.length <= 80 && VERSION_RE.test(version) ? version : null;
}

function optionalVersion(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  return requiredVersion(value) ?? undefined;
}

function optionalText(value: unknown, pattern: RegExp): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return pattern.test(normalized) ? normalized : undefined;
}

function parseInput(raw: unknown): HeartbeatInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const homeUrl = normalizeHomeUrl(body.homeUrl);
  const pluginVersion = requiredVersion(body.pluginVersion);
  const wpVersion = requiredVersion(body.wpVersion);
  const wcVersion = optionalVersion(body.wcVersion);
  const timezone = optionalText(body.timezone, TIMEZONE_RE);
  const currency = optionalText(
    typeof body.currency === 'string' ? body.currency.toUpperCase() : body.currency,
    /^[A-Z]{3}$/,
  );
  if (
    !homeUrl
    || !pluginVersion
    || !wpVersion
    || wcVersion === undefined
    || timezone === undefined
    || currency === undefined
  ) {
    return null;
  }
  return { homeUrl, pluginVersion, wpVersion, wcVersion, timezone, currency, restUrl: body.restUrl };
}

function reject(failure: WooSignedRequestFailure) {
  console.warn('[woo] heartbeat rejected', { code: failure.code, siteId: failure.siteId });
  return wooSignedRequestErrorResponse(failure);
}

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: 'invalid_request' }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return json({ error: 'invalid_request' }, 413);
  }

  const verified = await verifyWooSignedRequest(request, rawBody);
  if (!verified.ok) return reject(verified);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    console.warn('[woo] heartbeat rejected', { code: 'invalid_request', siteId: verified.siteId });
    return json({ error: 'invalid_request' }, 400);
  }
  const input = parseInput(parsed);
  if (!input) {
    console.warn('[woo] heartbeat rejected', { code: 'invalid_request', siteId: verified.siteId });
    return json({ error: 'invalid_request' }, 400);
  }

  // home_url stays the paired URL. A copied database reports a different URL
  // in last_home_url on every heartbeat, instead of overwriting the pairing
  // and being flagged only once.
  const pairedHomeUrl = normalizeHomeUrl(verified.homeUrl) ?? verified.homeUrl;
  const homeUrlMismatch = pairedHomeUrl !== input.homeUrl;
  try {
    const { data, error } = await getMessengerServiceClient()
      .from('woo_site_connections')
      .update({
        last_home_url: input.homeUrl,
        plugin_version: input.pluginVersion,
        wp_version: input.wpVersion,
        wc_version: input.wcVersion,
        timezone: input.timezone,
        currency: input.currency,
        last_seen_at: new Date().toISOString(),
      })
      .eq('widget_site_id', verified.siteId)
      .eq('status', 'active')
      .select('widget_site_id')
      .maybeSingle();
    if (error) {
      console.error('[woo] heartbeat failed', { code: 'unavailable', siteId: verified.siteId });
      return json({ error: 'unavailable' }, 503);
    }
    if (!data) {
      console.warn('[woo] heartbeat rejected', { code: 'site_disconnected', siteId: verified.siteId });
      return json({ error: 'site_disconnected' }, 403);
    }
  } catch {
    console.error('[woo] heartbeat failed', { code: 'unavailable', siteId: verified.siteId });
    return json({ error: 'unavailable' }, 503);
  }

  // The REST root follows the paired address only: a copied database that
  // reports another address must not re-aim the server's calls.
  if (!homeUrlMismatch) {
    const restBaseUrl = normalizeWooRestBase(pairedHomeUrl, input.restUrl);
    if (restBaseUrl) {
      // Best effort and separate: a database without the column keeps working.
      const { error } = await getMessengerServiceClient()
        .from('woo_site_connections')
        .update({ rest_base_url: restBaseUrl })
        .eq('widget_site_id', verified.siteId)
        .eq('status', 'active');
      if (error) console.warn('[woo] rest base not stored', { siteId: verified.siteId });
    }
  }

  return json({ ok: true, homeUrlMismatch, minPluginVersion: WOO_MIN_PLUGIN_VERSION });
}
