import { describe, expect, it } from 'vitest';
import { minimizeTryOnPerformanceEvent } from './tryon-performance-envelope';

describe('try-on performance events after SDK enrichment', () => {
  it('removes embed images, product names, referrers and person data while retaining delivery and duration fields', () => {
    const timestamp = new Date('2026-11-06T12:00:00Z');
    const embed = 'https://app.example/embed/try-on?title=Private%20dress&garment=https%3A%2F%2Fcdn.example%2Fprivate.jpg';
    const event = {
      uuid: '019a592f-4a00-7000-8000-000000000001', event: 'tryon.phase_completed', timestamp,
      properties: {
        phase: 'upload', durationMs: 315, taxonomy_version: 1, occurred_at: timestamp.toISOString(),
        consent_state: 'granted', source: 'tryon_widget', channel: 'web',
        token: 'test-project-key', distinct_id: 'anonymous-sdk-id', $lib: 'web', $lib_version: '1.417.1',
        $current_url: embed, $initial_current_url: embed, $session_entry_url: embed,
        $pathname: '/embed/try-on', $referrer: 'https://shop.example/products/private-dress?gc_preview=secret',
        $initial_referrer: embed, $session_entry_referrer: embed,
        $session_id: 'sdk-session', $window_id: 'sdk-window', $process_person_profile: true,
        name: 'Shopper name', email: 'shopper@example.com',
        $stored_person_properties: { email: 'shopper@example.com' },
      },
      $set: { name: 'Shopper name' },
      $set_once: { $initial_current_url: embed, $referrer: embed, email: 'shopper@example.com' },
      $unset: ['private-profile-field'],
    };
    const minimized = minimizeTryOnPerformanceEvent(event);
    expect(minimized).toEqual({
      uuid: event.uuid, event: event.event, timestamp,
      properties: {
        phase: 'upload', durationMs: 315, taxonomy_version: 1, occurred_at: timestamp.toISOString(),
        consent_state: 'granted', source: 'tryon_widget', channel: 'web',
        token: 'test-project-key', distinct_id: 'anonymous-sdk-id', $lib: 'web', $lib_version: '1.417.1',
        $process_person_profile: false,
      },
    });
    expect(JSON.stringify(minimized)).not.toMatch(/private|Shopper|shopper|example\.com|gc_preview|sdk-session/);
    // No mutation of the SDK's persisted data or the input envelope.
    expect(event.properties.$current_url).toBe(embed);
    expect(event.properties.$process_person_profile).toBe(true);
  });

  it('leaves every other event and its existing policy unchanged', () => {
    const event = { uuid: 'id', event: 'storefront.demo_completed', properties: {
      durationMs: 315, $current_url: 'https://app.example/try-on',
    }, $set_once: { $initial_current_url: 'https://app.example/' } };
    expect(minimizeTryOnPerformanceEvent(event)).toBe(event);
    expect(minimizeTryOnPerformanceEvent(null)).toBeNull();
  });

  it('does not admit unexpected objects through the retained primitive fields', () => {
    const event = { uuid: 'id', event: 'tryon.phase_completed', properties: {
      distinct_id: '019a592f-4a00-7000-8000-000000000001',
      phase: { image: 'data:image/jpeg;base64,private' }, durationMs: Infinity,
    } };
    expect(minimizeTryOnPerformanceEvent(event)?.properties).toEqual({
      distinct_id: '019a592f-4a00-7000-8000-000000000001', $process_person_profile: false,
    });
  });

  it.each([
    'shopper@example.com', 'https://shop.example/person', 'data:image/jpeg;base64,cHJpdmF0ZQ==',
    'eyJhbGciOiJIUzI1NiJ9.payloadvalue.signaturevalue', 'sk_live_abcd1234', 'Shopper name',
    '$device:shopper@example.com', '$device:sk_live_abcd1234',
  ])('drops the measurement if SDK identity contains contact data or bearer material: %s', (distinctId) => {
    const event = { uuid: 'id', event: 'tryon.phase_completed', properties: {
      distinct_id: distinctId, phase: 'upload', durationMs: 315,
    } };
    expect(minimizeTryOnPerformanceEvent(event)).toBeNull();
  });

  it.each([
    '019a592f-4a00-7000-8000-000000000001',
    '$device:019a592f-4a00-7000-8000-000000000001',
  ])('preserves SDK-generated anonymous identity %s', (distinctId) => {
    const event = { uuid: 'id', event: 'tryon.phase_completed', properties: {
      distinct_id: distinctId, phase: 'upload', durationMs: 315,
    } };
    expect(minimizeTryOnPerformanceEvent(event)?.properties.distinct_id).toBe(distinctId);
  });
});
