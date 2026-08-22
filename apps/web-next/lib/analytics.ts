import posthog from 'posthog-js';

/* No CTA on the site fired any event before this — the "which CTA converts"
   question was unanswerable from data. This wraps posthog.capture so call
   sites read as plain onClick handlers instead of repeating the guard. */
export function trackClick(name: string, properties?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  posthog.capture(name, properties);
}
