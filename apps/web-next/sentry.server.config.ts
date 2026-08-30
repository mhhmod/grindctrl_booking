import * as Sentry from '@sentry/nextjs';
import { scrubUrl } from '@/lib/analytics/scrub-url';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1,
  debug: false,
  /* app/claim/page.tsx is a Server Component reached at /claim?token=...; a
     throw there is captured with event.request.url set to that full request
     URL (see instrumentation.ts's onRequestError → captureRequestError).
     `sendDefaultPii: false` (the default, unset here) only strips
     cookies/IP — it does not touch query params — so the claim token would
     otherwise sit in every server-side error report for its 5-minute
     lifetime. Same rewrite as instrumentation-client.ts, see
     lib/analytics/scrub-url.ts. */
  beforeSend(event) {
    if (event.request?.url) event.request.url = scrubUrl(event.request.url);
    return event;
  },
});
