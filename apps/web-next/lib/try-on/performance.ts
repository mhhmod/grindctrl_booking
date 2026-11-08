import posthog from 'posthog-js';
import { readAnalyticsConsent } from '@/lib/analytics/consent';
import { createAnalyticsTracker } from '@/lib/analytics/tracker';
import type { AnalyticsEventPayloadMap } from '@/lib/analytics/events';

type Phase = AnalyticsEventPayloadMap['tryon.phase_completed']['phase'];
const track = createAnalyticsTracker({ capture: (name, properties) => posthog.capture(name, properties) }, {
  getConsentState: () => readAnalyticsConsent(posthog),
});

/** No tenant, capability, product, photo or prompt enters performance events.
 *  Measurements are deliberately not queued while analytics consent is absent. */
export function recordTryOnPhase(phase: Phase, durationMs: number): void {
  if (typeof window === 'undefined' || !Number.isFinite(durationMs) || durationMs < 0) return;
  track({ name: 'tryon.phase_completed', context: { source: 'tryon_widget', channel: 'web' },
    properties: { phase, durationMs: Math.round(durationMs) } });
}

let openedAt: number | null = null;

/** Marketing SPA links can hand the tap time to the studio without storage. */
export function markTryOnOpen(): void {
  if (typeof window !== 'undefined') openedAt = Date.now();
}

/** Storefront loaders hand only a numeric tap time to the iframe. Direct
 *  visits have no tap measurement; navigation time is not mislabeled as one. */
export function recordTryOnOpen(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const raw = url.searchParams.get('gc_opened_at');
  if (raw !== null) {
    url.searchParams.delete('gc_opened_at');
    try {
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // A restricted iframe can forbid history writes; measurement must not
      // interfere with the session or the photo input.
    }
  }
  const start = raw === null ? openedAt : Number(raw);
  openedAt = null;
  if (start !== null && start > 0 && Date.now() - start <= 60_000) {
    recordTryOnPhase('tap_to_open', Date.now() - start);
  }
}
