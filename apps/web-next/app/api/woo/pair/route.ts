import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { publicApiRatelimit, clientIp } from '@/lib/ratelimit';
import {
  RequestRateLimitError,
  rateLimitErrorResponse,
  requireRateLimit,
} from '@/lib/request-rate-limit';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { deriveWooSiteSecret } from '@/lib/woo/site-secret';
import { WOO_MIN_PLUGIN_VERSION } from '@/lib/woo/signed-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 16 * 1024;
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;
// WordPress reports "6.8" as readily as "6.8.1": two to four numeric parts.
const VERSION_RE = /^\d{1,5}(?:\.\d{1,5}){1,3}(?:[-+][0-9A-Za-z.-]{1,64})?$/;
const TIMEZONE_RE = /^[A-Za-z0-9_+:/-]{1,100}$/;

type Platform = 'woocommerce' | 'wordpress';

type PairInput = {
  code: string;
  homeUrl: string;
  pluginVersion: string;
  wpVersion: string;
  wcVersion: string | null;
  timezone: string | null;
  currency: string | null;
  platform: Platform;
};

type PairingCodeRow = {
  widget_site_id: string;
  created_by: string;
  expires_at: string;
  consumed_at: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function fail(
  code: 'invalid_code' | 'expired_code' | 'invalid_request' | 'unavailable',
  status: number,
  siteId: string | null = null,
) {
  if (code === 'unavailable') console.error('[woo] pair failed', { code, siteId });
  return json({ error: code }, status);
}

function normalizePairingCode(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 32) return null;
  const code = value.trim().replace(/[\s-]+/g, '').toUpperCase();
  return CODE_RE.test(code) ? code : null;
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

function normalizeVersion(value: unknown, required: true): string | null;
function normalizeVersion(value: unknown, required: false): string | null | undefined;
function normalizeVersion(value: unknown, required: boolean): string | null | undefined {
  if ((value === null || value === undefined || value === '') && !required) return null;
  if (typeof value !== 'string') return required ? null : undefined;
  const version = value.trim();
  return version.length <= 80 && VERSION_RE.test(version) ? version : required ? null : undefined;
}

function optionalText(value: unknown, pattern: RegExp): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return pattern.test(normalized) ? normalized : undefined;
}

type ParsedInput = { ok: true; input: PairInput } | { ok: false; error: 'invalid_code' | 'invalid_request' };

function parseInput(raw: unknown): ParsedInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'invalid_request' };
  const body = raw as Record<string, unknown>;
  const code = normalizePairingCode(body.code);
  if (!code) return { ok: false, error: 'invalid_code' };
  const homeUrl = normalizeHomeUrl(body.homeUrl);
  const pluginVersion = normalizeVersion(body.pluginVersion, true);
  const wpVersion = normalizeVersion(body.wpVersion, true);
  const wcVersion = normalizeVersion(body.wcVersion, false);
  const timezone = optionalText(body.timezone, TIMEZONE_RE);
  const currency = optionalText(
    typeof body.currency === 'string' ? body.currency.toUpperCase() : body.currency,
    /^[A-Z]{3}$/,
  );
  const platform = body.platform === 'woocommerce' || body.platform === 'wordpress'
    ? body.platform
    : null;

  if (
    !homeUrl
    || !pluginVersion
    || !wpVersion
    || wcVersion === undefined
    || timezone === undefined
    || currency === undefined
    || !platform
    || (platform === 'woocommerce' && wcVersion === null)
  ) {
    return { ok: false, error: 'invalid_request' };
  }

  return {
    ok: true,
    input: { code, homeUrl, pluginVersion, wpVersion, wcVersion, timezone, currency, platform },
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireRateLimit(publicApiRatelimit, `woo-pair:${clientIp(request) ?? 'unknown'}`);
  } catch (error) {
    if (error instanceof RequestRateLimitError) return rateLimitErrorResponse(error);
    throw error;
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return fail('invalid_request', 413);
  }

  let bodyText: string;
  let parsed: unknown;
  try {
    bodyText = await request.text();
    if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) return fail('invalid_request', 413);
    parsed = JSON.parse(bodyText);
  } catch {
    return fail('invalid_request', 400);
  }

  const parsedInput = parseInput(parsed);
  if (!parsedInput.ok) return fail(parsedInput.error, 400);
  const input = parsedInput.input;

  const codeHash = createHash('sha256').update(input.code, 'utf8').digest('hex');
  const supabase = getMessengerServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  let siteId: string | null = null;

  try {
    const pairingResult = await supabase
      .from('woo_pairing_codes')
      .select('widget_site_id, created_by, expires_at, consumed_at')
      .eq('code_hash', codeHash)
      .maybeSingle();
    if (pairingResult.error) return fail('unavailable', 503);
    const pairing = pairingResult.data as PairingCodeRow | null;
    if (!pairing || pairing.consumed_at) return fail('invalid_code', 400);
    siteId = pairing.widget_site_id;
    if (!Number.isFinite(Date.parse(pairing.expires_at)) || Date.parse(pairing.expires_at) <= now.getTime()) {
      return fail('expired_code', 410, siteId);
    }

    // Resolve every prerequisite before consuming the one-time code. This
    // avoids burning it for missing configuration, while the guarded update
    // below still makes two simultaneous pair attempts mutually exclusive.
    const siteResult = await supabase
      .from('widget_sites')
      .select('id, embed_key')
      .eq('id', siteId)
      .maybeSingle();
    if (siteResult.error || !siteResult.data || typeof siteResult.data.embed_key !== 'string') {
      return fail('unavailable', 503, siteId);
    }

    const connectionResult = await supabase
      .from('woo_site_connections')
      .select('secret_version')
      .eq('widget_site_id', siteId)
      .maybeSingle();
    if (connectionResult.error) return fail('unavailable', 503, siteId);
    const storedVersion = (connectionResult.data as { secret_version?: unknown } | null)?.secret_version;
    const secretVersion = connectionResult.data === null
      ? 1
      : Number.isSafeInteger(storedVersion) && Number(storedVersion) > 0
        ? Number(storedVersion)
        : null;
    if (!secretVersion) return fail('unavailable', 503, siteId);

    const tenantKey = siteTenantKey(siteId);
    const secret = deriveWooSiteSecret(siteId, secretVersion);
    if (!secret) return fail('unavailable', 503, siteId);

    const consumed = await supabase
      .from('woo_pairing_codes')
      .update({ consumed_at: nowIso })
      .eq('code_hash', codeHash)
      .eq('widget_site_id', siteId)
      .is('consumed_at', null)
      .gt('expires_at', nowIso)
      .select('widget_site_id')
      .maybeSingle();
    if (consumed.error) return fail('unavailable', 503, siteId);
    if (!consumed.data) return fail('invalid_code', 400, siteId);

    const connectionWrite = await supabase.from('woo_site_connections').upsert({
      widget_site_id: siteId,
      platform: input.platform,
      status: 'active',
      secret_version: secretVersion,
      home_url: input.homeUrl,
      last_home_url: input.homeUrl,
      plugin_version: input.pluginVersion,
      wp_version: input.wpVersion,
      wc_version: input.wcVersion,
      timezone: input.timezone,
      currency: input.currency,
      paired_at: nowIso,
      last_seen_at: nowIso,
      disconnected_at: null,
      redact_after: null,
      redacted_at: null,
      paired_by: pairing.created_by,
    }, { onConflict: 'widget_site_id' });
    if (connectionWrite.error) return fail('unavailable', 503, siteId);

    const tenantWrite = await supabase.from('tryon_shops').upsert({
      shop_domain: tenantKey,
      platform: input.platform,
      widget_site_id: siteId,
      status: 'installed',
      uninstalled_at: null,
      last_seen_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: 'shop_domain' });
    if (tenantWrite.error) return fail('unavailable', 503, siteId);

    return json({
      siteId,
      embedKey: siteResult.data.embed_key,
      secret,
      secretVersion,
      minPluginVersion: WOO_MIN_PLUGIN_VERSION,
    });
  } catch {
    return fail('unavailable', 503, siteId);
  }
}
