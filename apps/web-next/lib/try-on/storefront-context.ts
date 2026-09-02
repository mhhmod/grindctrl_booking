import 'server-only';

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { validateProductId } from './validator';
import { isAllowedGarmentUrl } from './image-runner';

/*
 * Shopify proves the storefront shop with an App Proxy signature. This module
 * carries that proof across the untrusted browser in two short-lived,
 * purpose-separated capabilities:
 *
 *   App Proxy -> storefront context -> signed try-on session -> generation
 *
 * Neither token accepts a client-selected billing shop or request key. The
 * HMAC key is derived from the Shopify app secret so a token from another
 * app-secret use cannot be replayed as a Try-On capability.
 */

const ISSUER = 'grindctrl-tryon';
const STOREFRONT_AUDIENCE = 'tryon-session-api';
const SESSION_AUDIENCE = 'tryon-generation-api';
const ATTEMPT_AUDIENCE = 'tryon-generation-attempt-api';
const STOREFRONT_PURPOSE = 'storefront-context';
const ATTEMPT_PURPOSE = 'generation-attempt';
const TOKEN_KEY_CONTEXT = 'grindctrl:tryon:capability:v1';
const CLOCK_SKEW_SECONDS = 30;
const TOKEN_MAX_LENGTH = 4096;

export const STOREFRONT_CONTEXT_TTL_SECONDS = 2 * 60;
export const TRYON_SESSION_TTL_SECONDS = 10 * 60;

const NONCE_RE = /^[A-Za-z0-9_-]{22,128}$/;
const VARIANT_ID_RE = /^[1-9][0-9]{0,19}$/;
const SESSION_ID_RE = /^ts_[A-Za-z0-9_-]{24}$/;
const JTI_RE = /^[A-Za-z0-9_-]{16,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_GID_RE = /^gid:\/\/shopify\/Product\/[1-9]\d*$/;
const VARIANT_GID_RE = /^gid:\/\/shopify\/ProductVariant\/[1-9]\d*$/;
const GARMENT_DIGEST_RE = /^[A-Za-z0-9_-]{43}$/;

type CapabilityHeader = {
  alg: 'HS256';
  typ: 'JWT';
  kid: 'tryon-v1';
};

export type StorefrontContextClaims = {
  iss: typeof ISSUER;
  aud: typeof STOREFRONT_AUDIENCE;
  purpose: typeof STOREFRONT_PURPOSE;
  shop: string;
  productId: string;
  variantId: string | null;
  productGid: string;
  variantGid: string;
  canonicalGarmentUrl: string;
  garmentUrlDigest: string;
  nonce: string;
  iat: number;
  exp: number;
  jti: string;
};

export type TryOnSessionPurpose = 'storefront' | 'public-demo' | 'legacy-compat';

export type VerifiedTryOnSession = {
  iss: typeof ISSUER;
  aud: typeof SESSION_AUDIENCE;
  purpose: TryOnSessionPurpose;
  sessionId: string;
  shop: string | null;
  productId: string;
  variantId: string | null;
  productGid: string | null;
  variantGid: string | null;
  canonicalGarmentUrl: string | null;
  garmentUrlDigest: string | null;
  nonce: string;
  requestKey: string;
  iat: number;
  exp: number;
  jti: string;
};

type TryOnAttemptPayload = {
  iss: typeof ISSUER;
  aud: typeof ATTEMPT_AUDIENCE;
  purpose: typeof ATTEMPT_PURPOSE;
  sessionPurpose: TryOnSessionPurpose;
  sessionJti: string;
  attemptNonce: string;
  sessionId: string;
  shop: string | null;
  productId: string;
  variantId: string | null;
  productGid: string | null;
  variantGid: string | null;
  canonicalGarmentUrl: string | null;
  garmentUrlDigest: string | null;
  nonce: string;
  requestKey: string;
  iat: number;
  exp: number;
  jti: string;
};

type VerifiedEnvelope = {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
};

function b64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function derivedKey(secret: string): Buffer {
  return createHmac('sha256', secret).update(TOKEN_KEY_CONTEXT, 'utf8').digest();
}

function signature(secret: string, value: string): string {
  return createHmac('sha256', derivedKey(secret)).update(value, 'utf8').digest('base64url');
}

function deterministicBytes(secret: string, purpose: string, value: string): Buffer {
  return createHmac('sha256', derivedKey(requireSecret(secret)))
    .update(`${purpose}:${value}`, 'utf8')
    .digest();
}

function deterministicUuid(secret: string, value: string): string {
  const bytes = Buffer.from(deterministicBytes(secret, 'request-key', value).subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function deterministicStorefrontJti(
  secret: string,
  identity: {
    shop: string;
    productGid: string;
    variantGid: string;
    garmentUrlDigest: string;
    nonce: string;
  },
): string {
  // JSON-array encoding keeps the HMAC input unambiguous. The purpose label
  // domain-separates storefront context identities from session IDs and
  // request keys derived with the same application secret.
  const material = JSON.stringify([
    identity.shop,
    identity.productGid,
    identity.variantGid,
    identity.garmentUrlDigest,
    identity.nonce,
  ]);
  return deterministicBytes(secret, 'storefront-context-jti:v1', material)
    .subarray(0, 24)
    .toString('base64url');
}

export function digestGarmentUrl(garmentUrl: string): string {
  return createHash('sha256').update(garmentUrl, 'utf8').digest('base64url');
}

function requireSecret(secret: string): string {
  const normalized = secret.trim();
  if (!normalized) throw new Error('Try-On signing secret is not configured');
  return normalized;
}

function signPayload(secret: string, payload: Record<string, unknown>): string {
  const header: CapabilityHeader = { alg: 'HS256', typ: 'JWT', kid: 'tryon-v1' };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${signature(requireSecret(secret), body)}`;
}

function verifyEnvelope(secret: string, token: string): VerifiedEnvelope | null {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret || !token || token.length > TOKEN_MAX_LENGTH) return null;

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  const expected = Buffer.from(signature(normalizedSecret, `${parts[0]}.${parts[1]}`), 'utf8');
  const actual = Buffer.from(parts[2], 'utf8');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as unknown;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown;
    if (!isRecord(header) || !isRecord(payload)) return null;
    if (header.alg !== 'HS256' || header.typ !== 'JWT' || header.kid !== 'tryon-v1') return null;
    return { header, payload };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTimes(
  payload: Record<string, unknown>,
  nowSeconds: number,
  maxTtlSeconds: number,
): payload is Record<string, unknown> & { iat: number; exp: number } {
  const { iat, exp } = payload;
  return (
    typeof iat === 'number' &&
    Number.isSafeInteger(iat) &&
    typeof exp === 'number' &&
    Number.isSafeInteger(exp) &&
    iat <= nowSeconds + CLOCK_SKEW_SECONDS &&
    exp > nowSeconds &&
    exp > iat &&
    exp - iat <= maxTtlSeconds
  );
}

function validProductId(productId: unknown): productId is string {
  return typeof productId === 'string' && validateProductId(productId).ok;
}

export function normalizeVariantId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return VARIANT_ID_RE.test(normalized) ? normalized : null;
}

export function isTryOnNonce(value: unknown): value is string {
  return typeof value === 'string' && NONCE_RE.test(value);
}

export function createTryOnNonce(): string {
  return randomBytes(18).toString('base64url');
}

export function signStorefrontContext(
  secret: string,
  input: {
    shop: unknown;
    productId: unknown;
    variantId?: unknown;
    productGid: unknown;
    variantGid: unknown;
    canonicalGarmentUrl: unknown;
    nonce: unknown;
  },
  nowSeconds = Math.floor(Date.now() / 1000),
): { token: string; claims: StorefrontContextClaims } {
  requireSecret(secret);
  const shop = normalizeShopDomain(input.shop);
  if (!shop) throw new Error('Invalid storefront shop');
  if (!validProductId(input.productId)) throw new Error('Invalid storefront product');
  if (!isTryOnNonce(input.nonce)) throw new Error('Invalid storefront nonce');
  if (typeof input.productGid !== 'string' || !PRODUCT_GID_RE.test(input.productGid)) {
    throw new Error('Invalid Shopify product ID');
  }
  if (typeof input.variantGid !== 'string' || !VARIANT_GID_RE.test(input.variantGid)) {
    throw new Error('Invalid Shopify variant ID');
  }
  if (
    typeof input.canonicalGarmentUrl !== 'string' ||
    !isAllowedGarmentUrl(input.canonicalGarmentUrl)
  ) {
    throw new Error('Invalid authoritative garment URL');
  }

  const variantId = normalizeVariantId(input.variantId);
  if (input.variantId !== undefined && input.variantId !== null && input.variantId !== '' && !variantId) {
    throw new Error('Invalid storefront variant');
  }

  const garmentUrlDigest = digestGarmentUrl(input.canonicalGarmentUrl);
  const jti = deterministicStorefrontJti(secret, {
    shop,
    productGid: input.productGid,
    variantGid: input.variantGid,
    garmentUrlDigest,
    nonce: input.nonce,
  });

  const claims: StorefrontContextClaims = {
    iss: ISSUER,
    aud: STOREFRONT_AUDIENCE,
    purpose: STOREFRONT_PURPOSE,
    shop,
    productId: input.productId,
    variantId,
    productGid: input.productGid,
    variantGid: input.variantGid,
    canonicalGarmentUrl: input.canonicalGarmentUrl,
    garmentUrlDigest,
    nonce: input.nonce,
    iat: nowSeconds,
    exp: nowSeconds + STOREFRONT_CONTEXT_TTL_SECONDS,
    jti,
  };
  return { token: signPayload(secret, claims), claims };
}

export function verifyStorefrontContext(
  secret: string,
  token: string,
  expected: {
    productId?: string;
    variantId?: string | null;
    nonce?: string;
  } = {},
  nowSeconds = Math.floor(Date.now() / 1000),
): StorefrontContextClaims | null {
  const envelope = verifyEnvelope(secret, token);
  if (!envelope) return null;
  const payload = envelope.payload;
  if (
    payload.iss !== ISSUER ||
    payload.aud !== STOREFRONT_AUDIENCE ||
    payload.purpose !== STOREFRONT_PURPOSE ||
    !validTimes(payload, nowSeconds, STOREFRONT_CONTEXT_TTL_SECONDS)
  ) {
    return null;
  }

  const shop = normalizeShopDomain(payload.shop);
  if (!shop || shop !== payload.shop || !validProductId(payload.productId)) return null;
  const variantId = normalizeVariantId(payload.variantId);
  if (payload.variantId !== null && !variantId) return null;
  if (!isTryOnNonce(payload.nonce) || typeof payload.jti !== 'string' || !JTI_RE.test(payload.jti)) {
    return null;
  }
  if (
    typeof payload.productGid !== 'string' ||
    !PRODUCT_GID_RE.test(payload.productGid) ||
    typeof payload.variantGid !== 'string' ||
    !VARIANT_GID_RE.test(payload.variantGid) ||
    typeof payload.canonicalGarmentUrl !== 'string' ||
    !isAllowedGarmentUrl(payload.canonicalGarmentUrl) ||
    typeof payload.garmentUrlDigest !== 'string' ||
    !GARMENT_DIGEST_RE.test(payload.garmentUrlDigest) ||
    digestGarmentUrl(payload.canonicalGarmentUrl) !== payload.garmentUrlDigest
  ) {
    return null;
  }
  if (expected.productId !== undefined && payload.productId !== expected.productId) return null;
  if (expected.variantId !== undefined && variantId !== expected.variantId) return null;
  if (expected.nonce !== undefined && payload.nonce !== expected.nonce) return null;

  return {
    iss: ISSUER,
    aud: STOREFRONT_AUDIENCE,
    purpose: STOREFRONT_PURPOSE,
    shop,
    productId: payload.productId,
    variantId,
    productGid: payload.productGid,
    variantGid: payload.variantGid,
    canonicalGarmentUrl: payload.canonicalGarmentUrl,
    garmentUrlDigest: payload.garmentUrlDigest,
    nonce: payload.nonce,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
  };
}

export function signTryOnSession(
  secret: string,
  input:
    | { purpose: 'storefront'; context: StorefrontContextClaims }
    | { purpose: 'legacy-compat'; context: StorefrontContextClaims }
    | { purpose: 'public-demo'; productId: string },
  nowSeconds = Math.floor(Date.now() / 1000),
): { token: string; claims: VerifiedTryOnSession } {
  requireSecret(secret);

  const context = input.purpose === 'public-demo' ? null : input.context;
  const productId = input.purpose === 'public-demo' ? input.productId : input.context.productId;
  if (!validProductId(productId)) throw new Error('Invalid session product');

  const storefrontIdentity = context?.jti;
  const sessionId = storefrontIdentity
    ? `ts_${deterministicBytes(secret, 'session-id', storefrontIdentity).subarray(0, 18).toString('base64url')}`
    : `ts_${randomBytes(18).toString('base64url')}`;
  const requestKey = storefrontIdentity
    ? deterministicUuid(secret, storefrontIdentity)
    : randomUUID();
  const issuedAt = context?.iat ?? nowSeconds;

  const claims: VerifiedTryOnSession = {
    iss: ISSUER,
    aud: SESSION_AUDIENCE,
    purpose: input.purpose,
    sessionId,
    // The temporary unsigned compatibility purpose is intentionally
    // shopless. It carries an authoritative garment but can never select a
    // merchant entitlement or enter the billable storefront branch.
    shop: input.purpose === 'storefront' ? context?.shop ?? null : null,
    productId,
    variantId: context?.variantId ?? null,
    productGid: context?.productGid ?? null,
    variantGid: context?.variantGid ?? null,
    canonicalGarmentUrl: context?.canonicalGarmentUrl ?? null,
    garmentUrlDigest: context?.garmentUrlDigest ?? null,
    nonce: context?.nonce ?? createTryOnNonce(),
    requestKey,
    iat: issuedAt,
    exp: issuedAt + TRYON_SESSION_TTL_SECONDS,
    jti: storefrontIdentity ?? randomBytes(12).toString('base64url'),
  };
  return { token: signPayload(secret, claims), claims };
}

export function verifyTryOnSession(
  secret: string,
  token: string,
  expected: {
    productId?: string;
    variantId?: string | null;
    nonce?: string;
  } = {},
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifiedTryOnSession | null {
  const envelope = verifyEnvelope(secret, token);
  if (!envelope) return null;
  const payload = envelope.payload;
  if (
    payload.iss !== ISSUER ||
    payload.aud !== SESSION_AUDIENCE ||
    (payload.purpose !== 'storefront' &&
      payload.purpose !== 'public-demo' &&
      payload.purpose !== 'legacy-compat') ||
    !validTimes(payload, nowSeconds, TRYON_SESSION_TTL_SECONDS)
  ) {
    return null;
  }

  if (
    typeof payload.sessionId !== 'string' ||
    !SESSION_ID_RE.test(payload.sessionId) ||
    !validProductId(payload.productId) ||
    !isTryOnNonce(payload.nonce) ||
    typeof payload.requestKey !== 'string' ||
    !UUID_RE.test(payload.requestKey) ||
    typeof payload.jti !== 'string' ||
    !JTI_RE.test(payload.jti)
  ) {
    return null;
  }

  const variantId = normalizeVariantId(payload.variantId);
  if (payload.variantId !== null && !variantId) return null;
  const shop = payload.shop === null ? null : normalizeShopDomain(payload.shop);
  if (payload.shop !== null && (!shop || shop !== payload.shop)) return null;
  if (payload.purpose === 'storefront' && !shop) return null;
  if (payload.purpose !== 'storefront' && shop !== null) return null;
  const storefrontProductValid =
    typeof payload.productGid === 'string' &&
    PRODUCT_GID_RE.test(payload.productGid) &&
    typeof payload.variantGid === 'string' &&
    VARIANT_GID_RE.test(payload.variantGid) &&
    typeof payload.canonicalGarmentUrl === 'string' &&
    isAllowedGarmentUrl(payload.canonicalGarmentUrl) &&
    typeof payload.garmentUrlDigest === 'string' &&
    GARMENT_DIGEST_RE.test(payload.garmentUrlDigest) &&
    digestGarmentUrl(payload.canonicalGarmentUrl) === payload.garmentUrlDigest;
  const demoProductValid =
    payload.productGid === null &&
    payload.variantGid === null &&
    payload.canonicalGarmentUrl === null &&
    payload.garmentUrlDigest === null;
  if (payload.purpose === 'storefront' && !storefrontProductValid) return null;
  if (payload.purpose === 'legacy-compat' && !storefrontProductValid) return null;
  if (payload.purpose === 'public-demo' && !demoProductValid) return null;

  if (expected.productId !== undefined && payload.productId !== expected.productId) return null;
  if (expected.variantId !== undefined && variantId !== expected.variantId) return null;
  if (expected.nonce !== undefined && payload.nonce !== expected.nonce) return null;

  return {
    iss: ISSUER,
    aud: SESSION_AUDIENCE,
    purpose: payload.purpose,
    sessionId: payload.sessionId,
    shop,
    productId: payload.productId,
    variantId,
    productGid: payload.productGid as string | null,
    variantGid: payload.variantGid as string | null,
    canonicalGarmentUrl: payload.canonicalGarmentUrl as string | null,
    garmentUrlDigest: payload.garmentUrlDigest as string | null,
    nonce: payload.nonce,
    requestKey: payload.requestKey,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
  };
}

export function signTryOnAttempt(
  secret: string,
  input: { session: VerifiedTryOnSession; attemptNonce: unknown },
): { token: string; claims: VerifiedTryOnSession } {
  requireSecret(secret);
  if (!isTryOnNonce(input.attemptNonce)) throw new Error('Invalid generation attempt nonce');

  const { session } = input;
  const attemptIdentity = deterministicBytes(
    secret,
    'generation-attempt-jti:v1',
    JSON.stringify([session.jti, input.attemptNonce]),
  ).subarray(0, 24).toString('base64url');
  const requestKey = deterministicUuid(secret, attemptIdentity);
  const payload: TryOnAttemptPayload = {
    iss: ISSUER,
    aud: ATTEMPT_AUDIENCE,
    purpose: ATTEMPT_PURPOSE,
    sessionPurpose: session.purpose,
    sessionJti: session.jti,
    attemptNonce: input.attemptNonce,
    sessionId: session.sessionId,
    shop: session.shop,
    productId: session.productId,
    variantId: session.variantId,
    productGid: session.productGid,
    variantGid: session.variantGid,
    canonicalGarmentUrl: session.canonicalGarmentUrl,
    garmentUrlDigest: session.garmentUrlDigest,
    nonce: session.nonce,
    requestKey,
    // Anchor the attempt to the parent session lifetime. Reissuing the same
    // HTTP attempt therefore returns the same token and never extends access.
    iat: session.iat,
    exp: session.exp,
    jti: attemptIdentity,
  };
  return {
    token: signPayload(secret, payload),
    claims: { ...session, requestKey, jti: attemptIdentity },
  };
}

export function verifyTryOnAttempt(
  secret: string,
  token: string,
  session: VerifiedTryOnSession,
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifiedTryOnSession | null {
  const envelope = verifyEnvelope(secret, token);
  if (!envelope) return null;
  const payload = envelope.payload;
  if (
    payload.iss !== ISSUER ||
    payload.aud !== ATTEMPT_AUDIENCE ||
    payload.purpose !== ATTEMPT_PURPOSE ||
    payload.sessionPurpose !== session.purpose ||
    payload.sessionJti !== session.jti ||
    !isTryOnNonce(payload.attemptNonce) ||
    !validTimes(payload, nowSeconds, TRYON_SESSION_TTL_SECONDS) ||
    payload.sessionId !== session.sessionId ||
    payload.shop !== session.shop ||
    payload.productId !== session.productId ||
    payload.variantId !== session.variantId ||
    payload.productGid !== session.productGid ||
    payload.variantGid !== session.variantGid ||
    payload.canonicalGarmentUrl !== session.canonicalGarmentUrl ||
    payload.garmentUrlDigest !== session.garmentUrlDigest ||
    payload.nonce !== session.nonce ||
    typeof payload.requestKey !== 'string' ||
    !UUID_RE.test(payload.requestKey) ||
    typeof payload.jti !== 'string' ||
    !JTI_RE.test(payload.jti)
  ) {
    return null;
  }

  return {
    ...session,
    requestKey: payload.requestKey,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
  };
}
