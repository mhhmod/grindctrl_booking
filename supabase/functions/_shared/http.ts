export type JsonRecord = Record<string, unknown>;

export function getOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  return origin ? origin : null;
}

export function json(status: number, body: JsonRecord, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function errorJson(
  status: number,
  code: string,
  message: string,
  extra?: JsonRecord,
  headers?: HeadersInit
): Response {
  return json(status, { ok: false, error: code, message, ...(extra || {}) }, headers);
}

export async function safeJsonBody(req: Request): Promise<any> {
  if (!req.body) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function parseUrlOrigin(origin: string): { origin: string; host: string } | null {
  try {
    const u = new URL(origin);
    return { origin: `${u.protocol}//${u.host}`, host: u.hostname };
  } catch {
    return null;
  }
}
