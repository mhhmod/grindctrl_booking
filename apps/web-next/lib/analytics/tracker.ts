import {
  ANALYTICS_CHANNELS,
  ANALYTICS_EVENTS,
  ANALYTICS_PROPERTY_RULES,
  ANALYTICS_SOURCES,
  ANALYTICS_TAXONOMY_VERSION,
  type AnalyticsChannel,
  type AnalyticsEventName,
  type AnalyticsEventPayloadMap,
  type AnalyticsPropertyRule,
  type AnalyticsSource,
} from '@/lib/analytics/events';
import type { AnalyticsConsentProvider } from '@/lib/analytics/consent';

declare const analyticsIdBrand: unique symbol;
export type AnalyticsId<Kind extends string> = string & { readonly [analyticsIdBrand]: Kind };
export type TenantAnalyticsId = AnalyticsId<'tenant'>;
export type SessionAnalyticsId = AnalyticsId<'session'>;
export type CustomerAnalyticsId = AnalyticsId<'customer'>;

export type AnalyticsContext = {
  source: AnalyticsSource;
  channel?: AnalyticsChannel;
  tenantId?: TenantAnalyticsId;
  sessionId?: SessionAnalyticsId;
  customerId?: CustomerAnalyticsId;
  experimentId?: string;
};

export type AnalyticsTrackRequest<Name extends AnalyticsEventName = AnalyticsEventName> = {
  name: Name;
  context: AnalyticsContext;
  properties: AnalyticsEventPayloadMap[Name];
};

export type AnalyticsEnvelope = Readonly<{
  name: AnalyticsEventName;
  properties: Readonly<Record<string, string | number | boolean>>;
}>;

export type AnalyticsTrackResult =
  | { status: 'captured' }
  | { status: 'skipped'; reason: 'consent_required' | 'unknown_event' | 'invalid_context' | 'unsafe_payload' | 'transport_error' };

export type AnalyticsTransport = {
  capture(name: AnalyticsEventName, properties: Readonly<Record<string, string | number | boolean>>): void;
};

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_STRING_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const SENSITIVE_KEY_PATTERN = /(address|attachment|auth|base64|blob|content|cookie|email|file|image|message|phone|photo|prompt|raw|secret|token|url)/i;
const COMMON_TOKEN_PREFIX_PATTERN = /^(?:bearer|eyj|gh[opusr]_?|sk_(?:live|test)_|pk_(?:live|test)_|xox[baprs]-)/i;
const JWT_PATTERN = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
const LONG_HEX_PATTERN = /^[a-f0-9]{32,}$/i;
const LONG_OPAQUE_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9_-]{32,}$/;
const PHONE_LIKE_PATTERN = /^\+?[\d(). -]{7,20}$/;
const SHOPIFY_NUMERIC_ID_PATTERN = /^[1-9]\d{0,19}$/;
const SHOPIFY_ID_PROPERTY_KEYS = new Set(['productId', 'variantId']);
const CONTEXT_KEYS = new Set(['source', 'channel', 'tenantId', 'sessionId', 'customerId', 'experimentId']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resemblesSensitiveValue(value: string): boolean {
  const normalized = value.trim();
  return normalized.includes('@')
    || /^data:/i.test(normalized)
    || /^(?:https?:\/\/|\/\/)/i.test(normalized)
    || PHONE_LIKE_PATTERN.test(normalized)
    || COMMON_TOKEN_PREFIX_PATTERN.test(normalized)
    || JWT_PATTERN.test(normalized)
    || LONG_HEX_PATTERN.test(normalized)
    || LONG_OPAQUE_PATTERN.test(normalized);
}

export function toAnalyticsId<Kind extends string>(value: string): AnalyticsId<Kind> | null {
  const normalized = value.trim();
  return IDENTIFIER_PATTERN.test(normalized) && !resemblesSensitiveValue(normalized)
    ? (normalized as AnalyticsId<Kind>)
    : null;
}

function matchesPropertyRule(value: unknown, rule: AnalyticsPropertyRule): value is string | number | boolean {
  if (rule.type === 'string') {
    return typeof value === 'string'
      && SAFE_STRING_PATTERN.test(value)
      && !resemblesSensitiveValue(value)
      && (!rule.values || rule.values.includes(value));
  }
  if (rule.type === 'number') {
    return typeof value === 'number'
      && Number.isFinite(value)
      && (!rule.values || rule.values.includes(value))
      && (!rule.integer || Number.isInteger(value))
      && (rule.min === undefined || value >= rule.min);
  }
  return typeof value === 'boolean' && (rule.value === undefined || value === rule.value);
}

function normalizePropertyValue(
  key: string,
  value: unknown,
  rule: AnalyticsPropertyRule,
): string | number | boolean | null {
  /* Shopify's REST IDs are decimal integers and frequently cross the runtime
     boundary as numbers. Permit that exception only on the two taxonomy fields
     that explicitly carry Shopify IDs. Unsafe JS integers are rejected rather
     than rounded; string IDs retain their full precision. */
  if (SHOPIFY_ID_PROPERTY_KEYS.has(key)) {
    if (typeof value === 'number') {
      return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
    }
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (SHOPIFY_NUMERIC_ID_PATTERN.test(normalized)) return normalized;
    }
  }

  return matchesPropertyRule(value, rule) ? value : null;
}

function isKnownValue<const Values extends readonly string[]>(values: Values, value: unknown): value is Values[number] {
  return typeof value === 'string' && values.includes(value);
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value) && !resemblesSensitiveValue(value);
}

function hasSafeContext(context: unknown, requiresTenant: boolean): context is AnalyticsContext {
  if (!isRecord(context)) return false;
  if (Object.keys(context).some((key) => !CONTEXT_KEYS.has(key) || SENSITIVE_KEY_PATTERN.test(key))) return false;
  if (!isKnownValue(ANALYTICS_SOURCES, context.source)) return false;
  if (context.channel !== undefined && !isKnownValue(ANALYTICS_CHANNELS, context.channel)) return false;
  if (requiresTenant && (!isSafeIdentifier(context.tenantId) || !isSafeIdentifier(context.sessionId))) return false;
  if (context.tenantId !== undefined && !isSafeIdentifier(context.tenantId)) return false;
  if (context.sessionId !== undefined && !isSafeIdentifier(context.sessionId)) return false;
  if (context.customerId !== undefined && !isSafeIdentifier(context.customerId)) return false;
  return context.experimentId === undefined || isSafeIdentifier(context.experimentId);
}

function safeProperties(
  name: AnalyticsEventName,
  properties: unknown,
): Record<string, string | number | boolean> | null {
  if (!isRecord(properties)) return null;

  const allowed = new Set<string>(ANALYTICS_EVENTS[name].allowedProperties);
  const required = new Set<string>(ANALYTICS_EVENTS[name].requiredProperties);
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key) || SENSITIVE_KEY_PATTERN.test(key)) return null;
    const rule = ANALYTICS_PROPERTY_RULES[key as keyof typeof ANALYTICS_PROPERTY_RULES];
    if (!rule) return null;
    const normalized = normalizePropertyValue(key, value, rule);
    if (normalized === null) return null;
    output[key] = normalized;
  }
  if ([...required].some((key) => !(key in output))) return null;
  return output;
}

function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ANALYTICS_EVENTS, value);
}

type AnalyticsTrackerOptions = {
  getConsentState?: AnalyticsConsentProvider;
  now?: () => Date;
};

export function createAnalyticsTracker(transport: AnalyticsTransport, options: AnalyticsTrackerOptions = {}) {
  const getConsentState = options.getConsentState ?? (() => 'unknown');
  const now = options.now ?? (() => new Date());

  return function track<Name extends AnalyticsEventName>(request: AnalyticsTrackRequest<Name>): AnalyticsTrackResult {
    let consentState;
    try {
      consentState = getConsentState();
    } catch {
      consentState = 'unknown' as const;
    }
    if (consentState !== 'granted') {
      return { status: 'skipped', reason: 'consent_required' };
    }

    if (!isRecord(request) || !isAnalyticsEventName(request.name)) {
      return { status: 'skipped', reason: 'unknown_event' };
    }

    const definition = ANALYTICS_EVENTS[request.name];
    if (!hasSafeContext(request.context, definition.scope === 'tenant')) {
      return { status: 'skipped', reason: 'invalid_context' };
    }

    const properties = safeProperties(request.name, request.properties);
    if (!properties) return { status: 'skipped', reason: 'unsafe_payload' };

    const envelope: Record<string, string | number | boolean> = {
      ...properties,
      taxonomy_version: ANALYTICS_TAXONOMY_VERSION,
      occurred_at: now().toISOString(),
      consent_state: consentState,
      source: request.context.source,
    };
    if (request.context.channel) envelope.channel = request.context.channel;
    if (request.context.tenantId) envelope.tenant_id = request.context.tenantId;
    if (request.context.sessionId) envelope.session_id = request.context.sessionId;
    if (request.context.customerId) envelope.customer_id = request.context.customerId;
    if (request.context.experimentId) envelope.experiment_id = request.context.experimentId;

    try {
      transport.capture(request.name, Object.freeze(envelope));
      return { status: 'captured' };
    } catch {
      return { status: 'skipped', reason: 'transport_error' };
    }
  };
}
