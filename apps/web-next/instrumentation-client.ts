import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

/* Next.js 15.3+ loads this file automatically on the client — no <Script>
   tag, no provider. Runs before the app renders. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1,
  integrations: [Sentry.browserTracingIntegration()],
  debug: false,
});

// Reports App Router client-side navigations as spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
