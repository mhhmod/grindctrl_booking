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

type MarketingEvent =
  | { name: 'storefront.demo_started'; properties: { demo: 'try_on' | 'product_journey' } }
  | { name: 'storefront.demo_completed'; properties: { demo: 'try_on' | 'product_journey'; durationMs?: number } }
  | { name: 'storefront.product_tab_engaged'; properties: { tab: string } };

/* Marketing-site events other than CTA clicks, through the same
   consent-gated tracker. The public try-on page uses these instead of the
   tenant-scoped tryon.* events, which are dropped without a tenant and
   session. Never pass a photo, a result image or anything personal. */
export function trackMarketingEvent(event: MarketingEvent) {
  if (typeof window === 'undefined') return;
  trackAnalyticsEvent({
    name: event.name,
    context: { source: 'marketing_site', channel: 'web' },
    properties: event.properties,
  } as Parameters<typeof trackAnalyticsEvent>[0]);
}

/* No CTA on the site fired any event before this — the "which CTA converts"
   question was unanswerable from data. This wraps posthog.capture so call
   sites read as plain onClick handlers instead of repeating the guard. */
export function trackClick(name: LegacyClickEvent, properties: Record<string, string> = {}) {
  if (typeof window === 'undefined') return;

  const cta = name === 'plan_cta_clicked' ? 'choose_plan' : name === 'pack_cta_clicked' ? 'ask_about_pack' : properties.cta;
  if (!cta || !['try_on', 'book_call', 'start_trial', 'choose_plan', 'ask_about_pack', 'open_store'].includes(cta)) return;

  trackAnalyticsEvent({
    name: 'storefront.cta_clicked',
    context: { source: 'marketing_site', channel: 'web' },
    properties: {
      cta: cta as 'try_on' | 'book_call' | 'start_trial' | 'choose_plan' | 'ask_about_pack' | 'open_store',
      placement: properties.section ?? (name === 'plan_cta_clicked' ? 'pricing_plan' : 'pricing_pack'),
      ...(properties.plan ? { planKey: properties.plan } : {}),
      ...(properties.pack ? { packKey: properties.pack } : {}),
    },
  });
}
