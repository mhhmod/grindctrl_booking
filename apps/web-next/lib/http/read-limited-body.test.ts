// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readLimitedBody, readLimitedFormData, readLimitedJson, readLimitedText } from './read-limited-body';

const CHUNK = 1024;

/** An endless body with no Content-Length, counting what the reader pulls. */
function endless(headers: Record<string, string> = {}) {
  const stats = { pulled: 0, cancelled: false };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (stats.cancelled) return;
      stats.pulled += CHUNK;
      controller.enqueue(new Uint8Array(CHUNK).fill(0x61));
    },
    cancel() { stats.cancelled = true; },
  }, { highWaterMark: 0 });
  return { stats, request: new Request('https://grindctrl.cloud/api/x', { method: 'POST', body, headers, duplex: 'half' } as RequestInit) };
}

function post(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request('https://grindctrl.cloud/api/x', { method: 'POST', body, headers });
}

describe('readLimitedBody', () => {
  it('stops an oversized stream without Content-Length after at most limit + one chunk', async () => {
    const limit = 10 * CHUNK + 17;
    const { stats, request } = endless();
    expect(request.headers.get('content-length')).toBeNull();
    expect(await readLimitedBody(request, limit)).toBeNull();
    expect(stats.pulled).toBeLessThanOrEqual(limit + CHUNK);
    expect(stats.cancelled).toBe(true);
  });

  it('refuses a declared length above the limit before reading anything', async () => {
    const { stats, request } = endless({ 'content-length': String(1024 * 1024) });
    expect(await readLimitedBody(request, 4096)).toBeNull();
    expect(stats.pulled).toBe(0);
  });

  it('does not trust an understated Content-Length', async () => {
    const big = new TextEncoder().encode('x'.repeat(5000));
    const request = new Request('https://grindctrl.cloud/api/x', {
      method: 'POST', duplex: 'half',
      body: new ReadableStream({ start(controller) { controller.enqueue(big); controller.close(); } }),
      headers: { 'content-length': '10' },
    } as RequestInit);
    expect(await readLimitedBody(request, 4096)).toBeNull();
  });

  it('returns a body at or under the limit unchanged, and an empty one as empty', async () => {
    expect((await readLimitedBody(post('a'.repeat(4096)), 4096))?.length).toBe(4096);
    expect((await readLimitedBody(new Request('https://grindctrl.cloud/api/x', { method: 'POST' }), 10))?.length).toBe(0);
  });
});

describe('readLimitedJson', () => {
  it('parses a normal request exactly as request.json() would', async () => {
    const value = { key: 'gc_public_key_42', text: 'مرحبا', nested: { n: 1 } };
    expect(await readLimitedJson(post(JSON.stringify(value), { 'content-type': 'application/json' }), 1024)).toEqual({ ok: true, value });
  });
  it('answers 413 for too large and 400 for broken JSON or a failed stream', async () => {
    expect(await readLimitedJson(post(JSON.stringify({ text: 'x'.repeat(2000) })), 1024)).toEqual({ ok: false, status: 413 });
    expect(await readLimitedJson(post('{"key":'), 1024)).toEqual({ ok: false, status: 400 });
    expect(await readLimitedJson(post(''), 1024)).toEqual({ ok: false, status: 400 });
    const broken = new Request('https://grindctrl.cloud/api/x', {
      method: 'POST', duplex: 'half', body: new ReadableStream({ pull(controller) { controller.error(new Error('client went away')); } }),
    } as RequestInit);
    expect(await readLimitedJson(broken, 1024)).toEqual({ ok: false, status: 400 });
  });
  it('cuts an endless JSON stream off with 413', async () => {
    const { stats, request } = endless();
    expect(await readLimitedJson(request, 8192)).toEqual({ ok: false, status: 413 });
    expect(stats.pulled).toBeLessThanOrEqual(8192 + CHUNK);
  });
});

describe('readLimitedText', () => {
  it('decodes exactly like request.text(), BOM and invalid bytes included, so a MAC over the text still matches', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"a":"مرحبا"}'), 0xff]);
    expect(await readLimitedText(post(bytes), 1024)).toEqual({ ok: true, text: await post(bytes).text() });
  });
  it('answers 413 above the limit, without Content-Length', async () => {
    const { stats, request } = endless();
    expect(await readLimitedText(request, 4096)).toEqual({ ok: false, status: 413 });
    expect(stats.pulled).toBeLessThanOrEqual(4096 + CHUNK);
  });
});

describe('readLimitedFormData', () => {
  it('parses multipart within the ceiling and refuses it above, before parsing', async () => {
    const form = new FormData();
    form.set('clientKey', '11111111-1111-4111-8111-111111111111');
    form.set('file', new File([new Uint8Array(2000)], 'photo.png', { type: 'image/png' }));
    // Serialized once, as a browser sends it (undici's own FormData pump
    // keeps writing after a cancel, which is a test-fixture artefact).
    const encoded = new Response(form);
    const type = encoded.headers.get('content-type')!;
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const request = () => post(bytes, { 'content-type': type });
    const parsed = await readLimitedFormData(request(), 64 * 1024);
    expect(parsed).toBeInstanceOf(FormData);
    expect(((parsed as FormData).get('file') as File).size).toBe(2000);
    expect(await readLimitedFormData(request(), 1000)).toBe(413);
    expect(await readLimitedFormData(post('not multipart', { 'content-type': 'multipart/form-data; boundary=x' }), 1000)).toBe(400);
  });
  it('cuts an endless upload off with 413', async () => {
    const { stats, request } = endless();
    expect(await readLimitedFormData(request, 16 * CHUNK)).toBe(413);
    expect(stats.pulled).toBeLessThanOrEqual(17 * CHUNK);
  });
});
