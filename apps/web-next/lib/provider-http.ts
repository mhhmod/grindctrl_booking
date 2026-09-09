/** Bound decoded response bytes before buffering. Content-Length alone is
 * insufficient: responses may be chunked, compressed or misreported. */
export async function readProviderBody(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new Error('Provider response exceeds the allowed size.');
  }
  if (!response.body) throw new Error('Provider returned an empty body.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('Provider response exceeds the allowed size.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0) throw new Error('Provider returned an empty body.');
  return Buffer.concat(chunks, size);
}
