/* The payload of a storefront `config_fetch_failed` event (phase zero
   item 5): why Store Chat could not load, on which host, and the status the
   loader saw. The reason comes from the server's own origin check and the
   host from the browser's Origin header, never from the payload, so the
   loader can only contribute the status it read. */
export function configFailurePayload(
  raw: unknown,
  origin: string | null,
  originAllowed: boolean,
): { reason: 'origin_not_allowed' | 'http_error' | 'unreachable'; host: string | null; status: number } {
  const reported = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>).status : undefined);
  const status = typeof reported === 'number' && Number.isInteger(reported) && reported >= 100 && reported <= 599
    ? reported
    : 0;
  let host: string | null = null;
  try {
    const parsed = origin ? new URL(origin).hostname.toLowerCase() : '';
    host = parsed && parsed.length <= 253 ? parsed : null;
  } catch {
    host = null;
  }
  const reason = !originAllowed ? 'origin_not_allowed' : status > 0 ? 'http_error' : 'unreachable';
  return { reason, host, status };
}

