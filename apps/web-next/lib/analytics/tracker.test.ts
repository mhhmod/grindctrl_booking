import { describe, expect, it, vi } from 'vitest';
import { ANALYTICS_EVENTS, ANALYTICS_PROPERTY_RULES } from '@/lib/analytics/events';
import { createAnalyticsTracker, toAnalyticsId } from '@/lib/analytics/tracker';

const tenantId = toAnalyticsId<'tenant'>('tenant-1')!;
const sessionId = toAnalyticsId<'session'>('session-1')!;
const granted = () => 'granted' as const;

describe('analytics taxonomy', () => {
  it('uses stable namespaces and declares no sensitive payload keys', () => {
    const names = Object.keys(ANALYTICS_EVENTS);
    expect(names).toEqual(expect.arrayContaining([
      'tryon.widget_viewed',
      'tryon.photo_uploaded',
      'tryon.generation_succeeded',
      'conversation.handoff',
      'lead.routed',
      'workflow.failed',
      'order.completed',
      'reporting.report_viewed',
    ]));
    expect(names.every((name) => /^[a-z]+\.[a-z_]+$/.test(name))).toBe(true);
    expect(Object.values(ANALYTICS_EVENTS).flatMap((event) => event.allowedProperties))
      .not.toEqual(expect.arrayContaining(['image', 'photo', 'email', 'phone', 'message', 'content', 'url']));
  });

  it('has a runtime rule for every declared event property', () => {
    const properties = new Set(Object.values(ANALYTICS_EVENTS).flatMap((event) => event.allowedProperties));
    expect([...properties].sort()).toEqual(Object.keys(ANALYTICS_PROPERTY_RULES).sort());
  });
});

describe('createAnalyticsTracker', () => {
  it.each(['denied', 'unknown'] as const)('does not capture when centrally derived consent is %s', (consent) => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: () => consent });
    expect(track({
      name: 'storefront.demo_started',
      context: { source: 'marketing_site' },
      properties: { demo: 'try_on' },
    })).toEqual({ status: 'skipped', reason: 'consent_required' });
    expect(capture).not.toHaveBeenCalled();
  });

  it('fails closed when no consent provider exists or the provider throws', () => {
    const capture = vi.fn();
    const request = {
      name: 'storefront.pricing_viewed' as const,
      context: { source: 'marketing_site' as const },
      properties: {},
    };
    expect(createAnalyticsTracker({ capture })(request)).toEqual({ status: 'skipped', reason: 'consent_required' });
    expect(createAnalyticsTracker({ capture }, { getConsentState: () => { throw new Error('sdk unavailable'); } })(request))
      .toEqual({ status: 'skipped', reason: 'consent_required' });
    expect(capture).not.toHaveBeenCalled();
  });

  it('returns a skipped result for unknown names instead of throwing', () => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    const request = { name: 'storefront.not_registered', context: { source: 'marketing_site' }, properties: {} } as never;
    expect(() => track(request)).not.toThrow();
    expect(track(request)).toEqual({ status: 'skipped', reason: 'unknown_event' });
    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    [{ source: 'unknown_source' }, 'unknown source'],
    [{ source: 'marketing_site', channel: 'carrier_pigeon' }, 'unknown channel'],
    [{ source: 1 }, 'non-string source'],
    [{ source: 'marketing_site', channel: true }, 'non-string channel'],
  ])('rejects invalid runtime context: %s (%s)', (context, _description) => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    expect(track({ name: 'storefront.demo_started', context, properties: { demo: 'try_on' } } as never))
      .toEqual({ status: 'skipped', reason: 'invalid_context' });
    expect(capture).not.toHaveBeenCalled();
  });

  it('requires tenant and session identifiers for product events', () => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    expect(track({
      name: 'tryon.opened',
      context: { source: 'tryon_widget', tenantId },
      properties: { productId: 'product-1' },
    })).toEqual({ status: 'skipped', reason: 'invalid_context' });
    expect(capture).not.toHaveBeenCalled();
  });

  it('rejects unknown, nested, and content-bearing properties before transport', () => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    for (const properties of [
      { productId: 'product-1', photoBase64: 'data:image/jpeg;base64,shopper-data' },
      { productId: { nested: true } },
    ]) {
      expect(track({ name: 'tryon.photo_uploaded', context: { source: 'tryon_widget', tenantId, sessionId }, properties } as never))
        .toEqual({ status: 'skipped', reason: 'unsafe_payload' });
    }
    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    ['storefront.demo_started', { demo: 'not-a-demo' }, 'invalid string enum'],
    ['storefront.scroll_depth', { percent: 10 }, 'invalid number enum'],
    ['storefront.demo_completed', { demo: 'try_on', durationMs: '1200' }, 'wrong primitive type'],
    ['storefront.demo_completed', { demo: 'try_on', durationMs: -1 }, 'negative duration'],
  ])('rejects %s with %s (%s)', (name, properties, _description) => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    expect(track({ name, context: { source: 'marketing_site' }, properties } as never))
      .toEqual({ status: 'skipped', reason: 'unsafe_payload' });
  });

  it.each([
    ['tryon.contact_captured', { kind: 'email', consentRecorded: false }],
    ['conversation.handoff', { reasonCode: 'manual_review', humanIntervention: false }],
    ['workflow.failed', { workflowId: 'workflow-1', errorCode: 'timeout', retryable: 'true' }],
  ])('enforces boolean semantics for %s', (name, properties) => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    expect(track({ name, context: { source: 'workflow', tenantId, sessionId }, properties } as never))
      .toEqual({ status: 'skipped', reason: 'unsafe_payload' });
  });

  it('rejects missing required properties and free-form strings', () => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    expect(track({
      name: 'workflow.failed',
      context: { source: 'workflow', tenantId, sessionId },
      properties: { workflowId: 'workflow-1' },
    } as never)).toEqual({ status: 'skipped', reason: 'unsafe_payload' });
    expect(track({
      name: 'conversation.handoff',
      context: { source: 'api', tenantId, sessionId },
      properties: { reasonCode: 'shopper wrote sensitive free form text', humanIntervention: true },
    })).toEqual({ status: 'skipped', reason: 'unsafe_payload' });
    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    ['15551234567', 'phone-like value'],
    ['eyJhbGciOiJIUzI1NiJ9.payloadvalue.signaturevalue', 'JWT-like value'],
    ['sk_live_abcd1234', 'secret-prefix value'],
    ['0123456789abcdef0123456789abcdef', 'long hex value'],
  ])('rejects %s as a %s in properties and identifiers', (unsafeValue) => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    expect(toAnalyticsId(unsafeValue)).toBeNull();
    expect(track({
      name: 'storefront.product_tab_engaged',
      context: { source: 'marketing_site' },
      properties: { tab: unsafeValue },
    })).toEqual({ status: 'skipped', reason: 'unsafe_payload' });
  });

  it('accepts and string-normalizes numeric Shopify IDs only in ID fields', () => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, {
      getConsentState: granted,
      now: () => new Date('2026-09-13T10:00:00.000Z'),
    });

    expect(track({
      name: 'tryon.opened',
      context: { source: 'shopify_app', tenantId, sessionId },
      properties: { productId: 9876543210123, variantId: ' 4567890123456 ' },
    } as never)).toEqual({ status: 'captured' });
    expect(capture).toHaveBeenCalledWith('tryon.opened', expect.objectContaining({
      productId: '9876543210123',
      variantId: '4567890123456',
    }));
  });

  it.each([
    [{ productId: Number.MAX_SAFE_INTEGER + 1 }, 'unsafe numeric precision'],
    [{ productId: 0 }, 'zero ID'],
    [{ productId: -123 }, 'negative ID'],
    [{ productId: 123.5 }, 'fractional ID'],
    [{ productId: '0123456789' }, 'non-canonical numeric string'],
  ])('rejects Shopify IDs with %s (%s)', (properties, _description) => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    expect(track({
      name: 'tryon.product_retried',
      context: { source: 'tryon_widget', tenantId, sessionId },
      properties,
    } as never)).toEqual({ status: 'skipped', reason: 'unsafe_payload' });
    expect(capture).not.toHaveBeenCalled();
  });

  it('continues to reject phone-like numbers in every non-ID string field', () => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, { getConsentState: granted });
    expect(track({
      name: 'storefront.product_tab_engaged',
      context: { source: 'marketing_site' },
      properties: { tab: '15551234567' },
    })).toEqual({ status: 'skipped', reason: 'unsafe_payload' });
    expect(capture).not.toHaveBeenCalled();
  });

  it('captures a content-free tenant envelope with explicit provenance', () => {
    const capture = vi.fn();
    const track = createAnalyticsTracker({ capture }, {
      getConsentState: granted,
      now: () => new Date('2026-09-13T10:00:00.000Z'),
    });
    expect(track({
      name: 'tryon.generation_succeeded',
      context: { source: 'tryon_widget', channel: 'web', tenantId, sessionId },
      properties: { productId: 'product-1', durationMs: 1200, provider: 'provider-key', model: 'model-key' },
    })).toEqual({ status: 'captured' });
    expect(capture).toHaveBeenCalledWith('tryon.generation_succeeded', {
      productId: 'product-1',
      durationMs: 1200,
      provider: 'provider-key',
      model: 'model-key',
      taxonomy_version: 1,
      occurred_at: '2026-09-13T10:00:00.000Z',
      consent_state: 'granted',
      source: 'tryon_widget',
      channel: 'web',
      tenant_id: 'tenant-1',
      session_id: 'session-1',
    });
  });

  it('returns transport_error when capture fails', () => {
    const track = createAnalyticsTracker({ capture: () => { throw new Error('offline'); } }, { getConsentState: granted });
    expect(track({ name: 'storefront.pricing_viewed', context: { source: 'marketing_site' }, properties: {} }))
      .toEqual({ status: 'skipped', reason: 'transport_error' });
  });

  it('rejects identifiers that resemble contact data or URLs', () => {
    expect(toAnalyticsId('shopper@example.com')).toBeNull();
    expect(toAnalyticsId('https://example.com/image.jpg')).toBeNull();
    expect(toAnalyticsId(' valid-id ')).toBe('valid-id');
  });
});
