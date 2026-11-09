/* Reads a public request body without ever holding more than `limit`
   bytes (plus the one chunk that crossed it). request.json(), text() and
   formData() buffer the whole body first, and Content-Length is optional
   and client-chosen, so neither is a size rule. A declared length above the
   limit is refused before reading; an undeclared or understated one is cut
   off as soon as the received bytes cross the limit. */

export type LimitedJson = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function declaredTooLarge(request: Request, limit: number): boolean {
  const declared = request.headers.get('content-length')?.trim();
  return declared !== undefined && /^\d+$/.test(declared) && Number(declared) > limit;
}

/** The body bytes, or null when they exceed `limit`. Rejects only when the
 *  stream itself fails (a client that went away). */
export async function readLimitedBody(request: Request, limit: number): Promise<Buffer | null> {
  if (declaredTooLarge(request, limit)) {
    await request.body?.cancel().catch(() => {});
    return null;
  }
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

/** The body as text within `limit` bytes, decoded exactly like
 *  request.text() (UTF-8, BOM dropped), so a MAC over it still matches:
 *  413 when larger, 400 when the stream failed. */
export async function readLimitedText(request: Request, limit: number): Promise<{ ok: true; text: string } | { ok: false; status: 400 | 413 }> {
  let bytes: Buffer | null;
  try {
    bytes = await readLimitedBody(request, limit);
  } catch {
    return { ok: false, status: 400 };
  }
  if (!bytes) return { ok: false, status: 413 };
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

/** UTF-8 JSON within `limit` bytes: 413 when larger, 400 when unreadable or
 *  not JSON. The caller still validates the shape. */
export async function readLimitedJson(request: Request, limit: number): Promise<LimitedJson> {
  const read = await readLimitedText(request, limit);
  if (!read.ok) return read;
  try {
    return { ok: true, value: JSON.parse(read.text) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}

/** Multipart after the byte ceiling: the form is parsed from the bytes
 *  already received, never from the live stream. */
export async function readLimitedFormData(request: Request, limit: number): Promise<FormData | 413 | 400> {
  let bytes: Buffer | null;
  try {
    bytes = await readLimitedBody(request, limit);
  } catch {
    return 400;
  }
  if (!bytes) return 413;
  try {
    return await new Response(new Uint8Array(bytes), {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData();
  } catch {
    return 400;
  }
}
