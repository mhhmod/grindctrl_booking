import type { BeforeSendFn } from 'posthog-js';
import { toAnalyticsId } from './tracker';

const PERFORMANCE_PROPERTIES = [
  'phase', 'durationMs', 'taxonomy_version', 'occurred_at', 'consent_state', 'source', 'channel',
  // PostHog's delivery identity and SDK provenance, never a shopper's fields.
  'token', 'distinct_id', '$lib', '$lib_version',
] as const;
const SDK_DEVICE_ID = /^\$device:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Run after SDK enrichment. A plain capture override is insufficient:
 *  PostHog also attaches the embed's garment URL/title through session-entry
 *  URLs, persisted referrers and person properties. This event needs none of
 *  them. All other analytics events retain their existing policy. */
export const minimizeTryOnPerformanceEvent: BeforeSendFn = (event) => {
  if (!event || event.event !== 'tryon.phase_completed') return event;
  // The SDK normally generates a UUID. An application can identify a visitor
  // with arbitrary text, so do not forward contact data or bearer material
  // merely because it reached a transport field rather than an event prop.
  const distinctId: unknown = event.properties.distinct_id;
  if (typeof distinctId !== 'string' || (!toAnalyticsId(distinctId) && !SDK_DEVICE_ID.test(distinctId))) return null;
  const properties: Record<string, string | number | boolean> = {};
  for (const key of PERFORMANCE_PROPERTIES) {
    const value: unknown = event.properties[key];
    if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      properties[key] = value;
    }
  }
  // These measurements do not update a person profile, including when the
  // visitor has previously identified themselves on the first-party site.
  properties.$process_person_profile = false;
  return {
    uuid: event.uuid,
    event: event.event,
    properties,
    ...(event.timestamp ? { timestamp: event.timestamp } : {}),
  };
};
