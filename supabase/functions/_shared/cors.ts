export const DEFAULT_ALLOW_HEADERS = [
  'authorization',
  'content-type',
  'x-client-info',
  'x-grindctrl-widget-version'
].join(', ');

export function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': DEFAULT_ALLOW_HEADERS,
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  } as Record<string, string>;
}

export function handleOptions(req: Request, origin: string | null): Response | null {
  if (req.method !== 'OPTIONS') return null;
  if (!origin) return new Response(null, { status: 204 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
