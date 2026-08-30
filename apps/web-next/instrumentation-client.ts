import * as Sentry from '@sentry/nextjs';
import posthog, { type BeforeSendFn } from 'posthog-js';
import { scrubUrl } from '@/lib/analytics/scrub-url';

/* Next.js 15.3+ loads this file automatically on the client — no <Script>
   tag, no provider. Runs before the app renders. */

/* The claim flow (see lib/analytics/scrub-url.ts) puts a short-lived bearer
   token in the URL, twice — once as /claim?token=..., again as /sign-in's
   redirect_url. Both Sentry's httpContext integration (event.request.url =
   document.location.href) and browserTracingIntegration record the full URL
   on every event and span, so both hooks below scrub it before send rather
   than trusting `sendDefaultPii: false` to do it — that only strips
   cookies/IP, not query params. */
function scrubEventUrl<T extends { request?: { url?: string } }>(event: T): T {
  if (event.request?.url) event.request.url = scrubUrl(event.request.url);
  return event;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  /* 10% of navigations traced: enough spans to debug slow routes without
     paying full-sample cost as traffic grows. Errors are always captured
     regardless of this rate. */
  tracesSampleRate: 0.1,
  integrations: [Sentry.browserTracingIntegration()],
  debug: false,
  beforeSend: scrubEventUrl,
  beforeSendTransaction: scrubEventUrl,
});

// Reports App Router client-side navigations as spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  /* Pageview capture is on with no URL allowlist, so $current_url carries
     the raw query string on every navigation — including the claim token.
     before_send is posthog-js's supported rewrite hook (confirmed present
     in the installed 1.417.1); it runs on every event, not just pageviews,
     so this also catches $initial_current_url (a one-time $set_once person
     property from the same location.href) and defensively $pathname, which
     is normally query-free but isn't worth trusting blindly here. */
  const scrubPostHogUrls: BeforeSendFn = (data) => {
    if (!data) return data;
    if (typeof data.properties?.$current_url === 'string') {
      data.properties.$current_url = scrubUrl(data.properties.$current_url);
    }
    if (typeof data.properties?.$pathname === 'string' && data.properties.$pathname.includes('?')) {
      data.properties.$pathname = scrubUrl(data.properties.$pathname);
    }
    if (typeof data.$set_once?.$initial_current_url === 'string') {
      data.$set_once.$initial_current_url = scrubUrl(data.$set_once.$initial_current_url);
    }
    return data;
  };

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    /* Was installed for analytics only -- its error tracking dashboard
       existed but had zero issues in it, because nothing was opting client
       exceptions into it. Sentry already captures these (that's the
       primary path); this is a second, independent record in case Sentry
       config ever drifts. */
    capture_exceptions: true,
    before_send: scrubPostHogUrls,
  });
}
