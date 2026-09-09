// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readProviderBody } from './provider-http';

describe('bounded provider bodies', () => {
  it('accepts a bounded body without Content-Length', async () => {
    expect((await readProviderBody(new Response('ok'), 2)).toString()).toBe('ok');
  });
  it('rejects declared oversized bodies before reading them', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ cancel });
    await expect(readProviderBody(new Response(stream, { headers: { 'content-length': '100' } }), 3)).rejects.toThrow('size');
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('cancels an oversized chunked stream even when Content-Length lies', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(4)); }, cancel });
    await expect(readProviderBody(new Response(stream, { headers: { 'content-length': '1' } }), 3)).rejects.toThrow('size');
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('rejects an empty body', async () => {
    await expect(readProviderBody(new Response(null), 3)).rejects.toThrow('empty');
  });
});
