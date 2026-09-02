/* Browser extensions run in the page and their unhandled rejections reach the
   same global handlers the Sentry/PostHog browser SDKs install, so they arrive
   as if the app threw them. One such extension produced 70 escalating events
   ("Cannot read properties of undefined (reading 'M_ID')", frames in
   app:///executors/200.js) while a real single-event Server Component crash
   sat underneath it — which is the actual cost: noise this loud hides the
   errors worth reading.

   The test is deliberately conservative, because dropping a real error is far
   worse than keeping a fake one: an event is discarded only when it HAS stack
   frames and NOT ONE of them comes from this app's own bundle. Anything
   ambiguous — no frames at all, a single recognisable frame, a manually
   captured message — is kept.

   Client-side only. Server events go through instrumentation.ts and a
   different SDK instance, and never reach this. */

/** Next.js serves every client chunk from a /_next/ path, so a frame that
 *  references it is ours regardless of host, scheme, or `app:///` rewriting. */
function isAppFrame(filename: unknown): boolean {
  return typeof filename === 'string' && filename.includes('/_next/');
}

type EventShape = {
  exception?: {
    values?: Array<{ stacktrace?: { frames?: Array<{ filename?: unknown }> } }>;
  };
};

/** True when the event carries stack frames and every one of them is foreign
 *  (a browser extension, an injected script, an unrelated bundle).
 *
 *  Takes `unknown` rather than Sentry's Event: the exact type moves between
 *  SDK versions, and this only ever reads two optional properties. A shape
 *  that does not match simply yields no frames, which is kept. */
export function isForeignScriptEvent(event: unknown): boolean {
  const values = (event as EventShape | null | undefined)?.exception?.values;
  if (!Array.isArray(values)) return false;

  const frames = values.flatMap((value) => value?.stacktrace?.frames ?? []);
  if (frames.length === 0) return false;
  return !frames.some((frame) => isAppFrame(frame?.filename));
}
