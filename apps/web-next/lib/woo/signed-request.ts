import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { deriveWooSiteSecret } from '@/lib/woo/site-secret';

// 0.4.0 is the first version that updates itself; older stores see a one-time update notice.
export const WOO_MIN_PLUGIN_VERSION = '0.4.0';
export const WOO_SITE_HEADER = 'X-GC-Site';
export const WOO_TIMESTAMP_HEADER = 'X-GC-Timestamp';
export const WOO_NONCE_HEADER = 'X-GC-Nonce';
export const WOO_SIGNATURE_HEADER = 'X-GC-Signature';

const CLOCK_SKEW_SECONDS = 300;
const NONCE_TTL_SECONDS = 600;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIMESTAMP_RE = /^\d{1,12}$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export type WooSignedRequestErrorCode =
  | 'bad_signature'
  | 'stale_timestamp'
  | 'replayed'
  | 'site_disconnected'
  | 'unavailable';

export type WooSignedRequestFailure = {
  ok: false;
  code: WooSignedRequestErrorCode;
  status: 401 | 403 | 409 | 503;
  siteId: string | null;
  serverTime?: number;
};

export type WooSignedRequestSuccess = {
  ok: true;
  siteId: string;
  secretVersion: number;
  connectionStatus: 'active' | 'disconnected';
  homeUrl: string;
};

export type WooSignedRequestResult = WooSignedRequestSuccess | WooSignedRequestFailure;

export type WooReplayStore = {
  /** True claims the nonce; false means it was already claimed. */
  claim(key: string, ttlSeconds: number): Promise<boolean>;
};

let replayStoreOverride: WooReplayStore | null | undefined;

/** Test seam for deterministic replay and outage coverage. */
export function setWooReplayStoreForTests(store: WooReplayStore | null): () => void {
  const previous = replayStoreOverride;
  replayStoreOverride = store;
  return () => {
    replayStoreOverride = previous;
  };
}

function configuredReplayStore(): WooReplayStore | null {
  if (replayStoreOverride !== undefined) return replayStoreOverride;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  return {
    async claim(key, ttlSeconds) {
      try {
        // NX + EX is the single distributed claim. A lost/invalid response
        // denies the request; retrying an ambiguous write could authorize a
        // replay, so this client does not retry.
        const redis = new Redis({
          url,
          token,
          retry: false,
          signal: AbortSignal.timeout(5_000),
        });
        const result = await redis.set(key, '1', { nx: true, ex: ttlSeconds });
        if (result === 'OK') return true;
        if (result === null) return false;
        throw new Error('Invalid nonce claim result');
      } catch {
        throw new Error('Nonce store unavailable');
      }
    },
  };
}

function bodyHash(body: string | Uint8Array): string {
  return createHash('sha256').update(body).digest('hex');
}

/** Exact cross-language signature input. PATH is the URL pathname, without
 * a query string. BODY is hashed as the exact UTF-8 bytes sent on the wire. */
export function wooSignatureCanonicalString(input: {
  method: string;
  path: string;
  timestamp: number | string;
  nonce: string;
  body: string | Uint8Array;
}): string {
  return [
    input.method.toUpperCase(),
    input.path,
    String(input.timestamp),
    input.nonce,
    bodyHash(input.body),
  ].join('\n');
}

export function signWooRequest(input: {
  secret: string;
  siteId: string;
  method: string;
  path: string;
  body: string | Uint8Array;
  timestamp?: number;
  nonce?: string;
}): Record<string, string> {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = input.nonce ?? randomBytes(16).toString('base64url');
  const canonical = wooSignatureCanonicalString({ ...input, timestamp, nonce });
  const signature = createHmac('sha256', input.secret).update(canonical, 'utf8').digest('base64url');

  return {
    [WOO_SITE_HEADER]: input.siteId,
    [WOO_TIMESTAMP_HEADER]: String(timestamp),
    [WOO_NONCE_HEADER]: nonce,
    [WOO_SIGNATURE_HEADER]: signature,
  };
}

function failure(
  code: WooSignedRequestErrorCode,
  status: WooSignedRequestFailure['status'],
  siteId: string | null,
  serverTime?: number,
): WooSignedRequestFailure {
  return {
    ok: false,
    code,
    status,
    siteId,
    ...(serverTime === undefined ? {} : { serverTime }),
  };
}

function decodeBase64Url(value: string, expectedBytes?: number): Buffer | null {
  if (!value || !BASE64URL_RE.test(value)) return null;
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.toString('base64url') !== value) return null;
    if (expectedBytes !== undefined && decoded.byteLength !== expectedBytes) return null;
    return decoded;
  } catch {
    return null;
  }
}

function validNonce(value: string): boolean {
  if (value.length > 172) return false;
  const decoded = decodeBase64Url(value);
  return decoded !== null && decoded.byteLength >= 16 && decoded.byteLength <= 128;
}

type ConnectionRow = {
  secret_version: number;
  status: 'active' | 'disconnected';
  home_url: string;
};

/** Verify a plugin request, then claim its nonce. A nonce is spent only after
 * the signature is valid, preventing unsigned callers from burning another
 * site's nonce. Redis and database failures deny the request. */
export async function verifyWooSignedRequest(
  request: Request,
  body: string | Uint8Array,
  options: { nowSeconds?: number; allowDisconnected?: boolean } = {},
): Promise<WooSignedRequestResult> {
  const siteId = request.headers.get(WOO_SITE_HEADER)?.trim() ?? '';
  const timestampRaw = request.headers.get(WOO_TIMESTAMP_HEADER)?.trim() ?? '';
  const nonce = request.headers.get(WOO_NONCE_HEADER)?.trim() ?? '';
  const signatureRaw = request.headers.get(WOO_SIGNATURE_HEADER)?.trim() ?? '';
  const safeSiteId = UUID_RE.test(siteId) ? siteId : null;

  if (!safeSiteId || !TIMESTAMP_RE.test(timestampRaw) || !validNonce(nonce)) {
    return failure('bad_signature', 401, safeSiteId);
  }

  const signature = decodeBase64Url(signatureRaw, 32);
  if (!signature) return failure('bad_signature', 401, safeSiteId);

  const timestamp = Number(timestampRaw);
  const serverTime = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(serverTime - timestamp) > CLOCK_SKEW_SECONDS) {
    return failure('stale_timestamp', 401, safeSiteId, serverTime);
  }

  let row: ConnectionRow | null;
  try {
    const { data, error } = await getMessengerServiceClient()
      .from('woo_site_connections')
      .select('secret_version, status, home_url')
      .eq('widget_site_id', safeSiteId)
      .maybeSingle();
    if (error) return failure('unavailable', 503, safeSiteId);
    row = data as ConnectionRow | null;
  } catch {
    return failure('unavailable', 503, safeSiteId);
  }

  // Unknown ids answer like a bad MAC so the connection registry cannot be
  // enumerated from this public route.
  if (!row) return failure('bad_signature', 401, safeSiteId);
  if (
    !Number.isSafeInteger(row.secret_version)
    || row.secret_version < 1
    || (row.status !== 'active' && row.status !== 'disconnected')
    || typeof row.home_url !== 'string'
  ) {
    return failure('unavailable', 503, safeSiteId);
  }

  const secret = deriveWooSiteSecret(safeSiteId, row.secret_version);
  if (!secret) return failure('unavailable', 503, safeSiteId);

  const path = new URL(request.url).pathname;
  const expected = createHmac('sha256', secret)
    .update(wooSignatureCanonicalString({
      method: request.method,
      path,
      timestamp: timestampRaw,
      nonce,
      body,
    }), 'utf8')
    .digest();
  if (!timingSafeEqual(expected, signature)) {
    return failure('bad_signature', 401, safeSiteId);
  }

  if (row.status === 'disconnected' && !options.allowDisconnected) {
    return failure('site_disconnected', 403, safeSiteId);
  }

  const replayStore = configuredReplayStore();
  if (!replayStore) return failure('unavailable', 503, safeSiteId);

  const nonceDigest = createHash('sha256')
    .update(`${safeSiteId}\n${nonce}`, 'utf8')
    .digest('hex');
  try {
    const claimed = await replayStore.claim(
      `gc-woo:nonce:v1:${safeSiteId}:${nonceDigest}`,
      NONCE_TTL_SECONDS,
    );
    if (!claimed) return failure('replayed', 409, safeSiteId);
  } catch {
    return failure('unavailable', 503, safeSiteId);
  }

  return {
    ok: true,
    siteId: safeSiteId,
    secretVersion: row.secret_version,
    connectionStatus: row.status,
    homeUrl: row.home_url,
  };
}

export function wooSignedRequestErrorResponse(failureResult: WooSignedRequestFailure): Response {
  return Response.json({
    error: failureResult.code,
    ...(failureResult.serverTime === undefined ? {} : { serverTime: failureResult.serverTime }),
  }, {
    status: failureResult.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
