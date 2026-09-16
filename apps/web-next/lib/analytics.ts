import posthog from 'posthog-js';
import { readAnalyticsConsent } from '@/lib/analytics/consent';
import { createAnalyticsTracker } from '@/lib/analytics/tracker';

export * from '@/lib/analytics/consent';
export * from '@/lib/analytics/events';
export * from '@/lib/analytics/tracker';

type LegacyClickEvent = 'cta_clicked' | 'plan_cta_clicked' | 'pack_cta_clicked';

const trackAnalyticsEvent = createAnalyticsTracker({
  capture: (name, properties) => posthog.capture(name, properties),
}, {
  getConsentState: () => readAnalyticsConsent(posthog),
});

/* No CTA on the site fired any event before this — the "which CTA converts"
   question was unanswerable from data. This wraps posthog.capture so call
   sites read as plain onClick handlers instead of repeating the guard. */
export function trackClick(name: LegacyClickEvent, properties: Record<string, string> = {}) {
  if (typeof window === 'undefined') return;

  const cta = name === 'plan_cta_clicked' ? 'choose_plan' : name === 'pack_cta_clicked' ? 'ask_about_pack' : properties.cta;
  if (!cta || !['try_on', 'book_call', 'start_trial', 'choose_plan', 'ask_about_pack'].includes(cta)) return;

  trackAnalyticsEvent({
    name: 'storefront.cta_clicked',
    context: { source: 'marketing_site', channel: 'web' },
    properties: {
      cta: cta as 'try_on' | 'book_call' | 'start_trial' | 'choose_plan' | 'ask_about_pack',
      placement: properties.section ?? (name === 'plan_cta_clicked' ? 'pricing_plan' : 'pricing_pack'),
      ...(properties.plan ? { planKey: properties.plan } : {}),
      ...(properties.pack ? { packKey: properties.pack } : {}),
    },
  });
}
