// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TryOnLocaleProvider } from './locale-provider';
import { pollTryOnJob, TryOnDemo } from './try-on-demo';
import { resetStorefrontProofForTests } from '@/lib/try-on/storefront-bootstrap';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const CONTEXT_TOKEN = 'header.payload.signature';
const STOREFRONT_NONCE = 'abcdefghijklmnopqrstuvwx';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderStorefront(locale: 'en' | 'ar' = 'en') {
  return render(
    <TryOnLocaleProvider initialLocale={locale}>
      <TryOnDemo
        productId="premium-ringer-tee"
        shop="demo.myshopify.com"
        variantId="123"
        shopProduct={{
          handle: 'premium-ringer-tee',
          name: 'Premium tee',
          imageUrl: 'https://cdn.shopify.com/s/files/garment.png',
        }}
      />
    </TryOnLocaleProvider>,
  );
}

async function selectPhoto(name: string) {
  const input = document.querySelector<HTMLInputElement>('#photo-upload-input');
  expect(input).not.toBeNull();
  fireEvent.change(input!, {
    target: { files: [new File(['photo'], name, { type: 'image/png' })] },
  });
  await screen.findByRole('button', { name: 'Generate Try-On Preview' });
}

describe('TryOnDemo storefront session lifecycle', () => {
  beforeEach(() => {
    resetStorefrontProofForTests();
    window.history.replaceState(
      {},
      '',
      `/embed/try-on?product=premium-ringer-tee#storefrontContext=${CONTEXT_TOKEN}&storefrontNonce=${STOREFRONT_NONCE}`,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('exchanges context on mount and supports a new-photo render after context TTL', async () => {
    const attempts: Array<Record<string, unknown>> = [];
    const generations: Array<Record<string, unknown>> = [];
    const releases: Array<{ url: string; authorization: string | null }> = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') {
        releases.push({ url, authorization: new Headers(init.headers).get('authorization') });
        return new Response(null, { status: 204 });
      }
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (url.endsWith('/api/try-on/session')) {
        return jsonResponse({
          ok: true,
          data: {
            sessionId: 'signed-session-token',
            productId: 'premium-ringer-tee',
            shop: 'demo.myshopify.com',
            variantId: '123',
            garmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
            nonce: STOREFRONT_NONCE,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        });
      }
      if (url.endsWith('/api/try-on/attempt')) {
        attempts.push(body);
        return jsonResponse({
          ok: true,
          data: {
            attemptId: `signed-attempt-${attempts.length}`,
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        });
      }
      if (url.endsWith('/api/try-on/generate')) {
        generations.push(body);
        return jsonResponse({
          ok: true,
          jobId: `tryon_${generations.length}`,
          status: 'completed',
          resultImageUrl: `data:image/png;base64,RESULT${generations.length}`,
          productId: 'premium-ringer-tee',
          message: 'complete',
          meta: { runtime: 'live', provider: 'test', costEstimate: 0.01 },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderStorefront();

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/try-on/session'))).toBe(true);
    });
    expect(window.location.hash).toBe('');

    // The original 2-minute context can now expire without affecting the
    // already exchanged 10-minute session held in component memory.
    const originalNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(originalNow + 121_000);

    await selectPhoto('first.png');
    fireEvent.click(screen.getByRole('button', { name: 'Generate Try-On Preview' }));
    await screen.findByAltText('Try-on preview of Premium tee');

    fireEvent.click(screen.getByRole('button', { name: 'Try with a different photo' }));
    await selectPhoto('second.png');
    fireEvent.click(screen.getByRole('button', { name: 'Generate Try-On Preview' }));
    await waitFor(() => expect(generations).toHaveLength(2));

    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/try-on/session'))).toHaveLength(1);
    expect(attempts).toHaveLength(2);
    expect(attempts[1].attemptNonce).not.toBe(attempts[0].attemptNonce);
    expect(generations.map((request) => request.attemptId)).toEqual([
      'signed-attempt-1',
      'signed-attempt-2',
    ]);
    /* Phase zero item 2: each look, once in the page, leaves our server. */
    await waitFor(() => expect(releases).toHaveLength(2));
    expect(releases).toEqual([
      { url: '/api/try-on/jobs/tryon_1', authorization: 'Bearer signed-session-token' },
      { url: '/api/try-on/jobs/tryon_2', authorization: 'Bearer signed-session-token' },
    ]);
  });

  it('polls an overlapping processing job with the signed session until its result is ready', async () => {
    const pollRequests: RequestInit[] = [];
    const releases: string[] = [];
    let pollCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') {
        releases.push(url);
        return new Response(null, { status: 204 });
      }
      if (url.endsWith('/api/try-on/session')) {
        return jsonResponse({
          ok: true,
          data: {
            sessionId: 'signed-session-token',
            productId: 'premium-ringer-tee',
            shop: 'demo.myshopify.com',
            variantId: '123',
            garmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
            nonce: STOREFRONT_NONCE,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        });
      }
      if (url.endsWith('/api/try-on/attempt')) {
        return jsonResponse({
          ok: true,
          data: {
            attemptId: 'signed-overlap-attempt',
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        });
      }
      if (url.endsWith('/api/try-on/generate')) {
        return jsonResponse({
          ok: true,
          jobId: 'tryon_overlap',
          status: 'processing',
          productId: 'premium-ringer-tee',
          message: 'processing',
          meta: { runtime: 'live', provider: 'test', costEstimate: 0.01 },
        });
      }
      if (url.endsWith('/api/try-on/jobs/tryon_overlap')) {
        pollRequests.push(init ?? {});
        pollCount += 1;
        return jsonResponse({
          ok: true,
          jobId: 'tryon_overlap',
          status: pollCount === 1 ? 'processing' : 'completed',
          resultImageUrl:
            pollCount === 1 ? undefined : 'data:image/png;base64,POLLED_RESULT',
          productId: 'premium-ringer-tee',
          message: pollCount === 1 ? 'processing' : 'complete',
          meta: { runtime: 'live', provider: 'test', costEstimate: 0.01 },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderStorefront();
    await selectPhoto('overlap.png');
    const generateButton = screen.getByRole('button', { name: 'Generate Try-On Preview' });
    await waitFor(() => expect(generateButton).toBeEnabled());
    fireEvent.click(generateButton);

    // The real poll-policy backoff waits a genuine 1s before the second poll
    // (tryOnPollDelayMs), which races testing-library's 1s default findBy*
    // timeout under real timers — widen it rather than shorten production's
    // deliberate backoff. A left-over timeout here previously orphaned this
    // test's real setTimeout past its own lifetime, letting it fire during
    // the next test and steal one of that test's mocked fetch responses.
    expect(await screen.findByAltText('Try-on preview of Premium tee', {}, { timeout: 3_000 })).toBeVisible();
    expect(pollCount).toBe(2);
    expect(pollRequests).toHaveLength(2);
    expect(releases).toEqual(['/api/try-on/jobs/tryon_overlap']);
    for (const request of pollRequests) {
      expect(new Headers(request.headers).get('authorization')).toBe(
        'Bearer signed-session-token',
      );
    }
  });

  it('follows a look made after the answer (202) to its result', async () => {
    const polls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url.endsWith('/api/try-on/session')) {
        return jsonResponse({
          ok: true,
          data: {
            sessionId: 'signed-session-token',
            productId: 'premium-ringer-tee',
            shop: 'demo.myshopify.com',
            variantId: '123',
            garmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
            nonce: STOREFRONT_NONCE,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        });
      }
      if (url.endsWith('/api/try-on/attempt')) {
        return jsonResponse({ ok: true, data: { attemptId: 'signed-async-attempt', expiresAt: new Date(Date.now() + 600_000).toISOString() } });
      }
      if (url.endsWith('/api/try-on/generate')) {
        return jsonResponse(
          {
            ok: true,
            jobId: 'tryon_async',
            status: 'processing',
            stage: 'received',
            productId: 'premium-ringer-tee',
            meta: { runtime: 'live', provider: 'test', costEstimate: null },
          },
          202,
        );
      }
      if (url.endsWith('/api/try-on/jobs/tryon_async')) {
        polls.push(url);
        const done = polls.length > 1;
        return jsonResponse({
          ok: true,
          jobId: 'tryon_async',
          status: done ? 'completed' : 'processing',
          ...(done ? { resultImageUrl: 'data:image/png;base64,QVNZTkM=' } : { stage: 'making' }),
          productId: 'premium-ringer-tee',
          meta: { runtime: 'live', provider: 'test', costEstimate: 0.01 },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderStorefront();
    await selectPhoto('async.png');
    const generateButton = screen.getByRole('button', { name: 'Generate Try-On Preview' });
    await waitFor(() => expect(generateButton).toBeEnabled());
    fireEvent.click(generateButton);

    expect(await screen.findByAltText('Try-on preview of Premium tee', {}, { timeout: 3_000 })).toBeVisible();
    expect(polls).toHaveLength(2);
  });

  it('honors Retry-After and continues polling instead of failing the generation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-09-01T00:00:00.000Z'));
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', {
        status: 429,
        headers: { 'Retry-After': '2' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        jobId: 'tryon_retry_after',
        status: 'completed',
        resultImageUrl: 'data:image/png;base64,POLLED_RESULT',
        productId: 'premium-ringer-tee',
        message: 'complete',
        meta: { runtime: 'live', provider: 'test', costEstimate: 0.01 },
      }));

    const resultPromise = pollTryOnJob(
      'tryon_retry_after',
      'signed-session-token',
      'fallback',
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      status: 'completed',
      resultImageUrl: 'data:image/png;base64,POLLED_RESULT',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /* Phase zero item 1: when the store's last look goes mid-session, an
     Arabic shopper read the server's English sentence. */
  it('says try-on is unavailable in the shopper\u2019s language, not the server\u2019s English', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/try-on/session')) {
        return jsonResponse({
          ok: true,
          data: {
            sessionId: 'signed-session-token',
            productId: 'premium-ringer-tee',
            shop: 'demo.myshopify.com',
            variantId: '123',
            garmentUrl: 'https://cdn.shopify.com/s/files/garment.png',
            nonce: STOREFRONT_NONCE,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        });
      }
      if (url.endsWith('/api/try-on/attempt')) {
        return jsonResponse({
          ok: true,
          data: { attemptId: 'signed-attempt-1', expiresAt: new Date(Date.now() + 600_000).toISOString() },
        });
      }
      if (url.endsWith('/api/try-on/generate')) {
        return jsonResponse({
          ok: false,
          code: 'TRYON_UNAVAILABLE',
          message: 'Try-on is temporarily unavailable. Please check back soon.',
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    renderStorefront('ar');

    const input = document.querySelector<HTMLInputElement>('#photo-upload-input');
    fireEvent.change(input!, {
      target: { files: [new File(['photo'], 'me.png', { type: 'image/png' })] },
    });
    const generate = await screen.findByRole('button', { name: 'إنشاء معاينة التجربة' });
    await waitFor(() => expect(generate).toBeEnabled());
    fireEvent.click(generate);

    expect(await screen.findByText('التجربة غير متاحة في هذا المتجر الآن.')).toBeVisible();
    expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
    // Retrying cannot make looks appear, so none is offered.
    expect(screen.queryByRole('button', { name: 'حاول مرة أخرى' })).toBeNull();
    expect(screen.queryByText('حدث خطأ ما')).toBeNull();
  });

  it('renders localized accessible proof failure and retry guidance', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: false, error: 'invalid storefront context' }, 401),
    );
    renderStorefront('ar');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('تحتاج تجربة المنتج إلى تحديث');
    expect(alert).toHaveTextContent('تعذّر التحقق من جلسة هذا المنتج');
    expect(screen.getByRole('button', { name: 'تحديث تجربة المنتج' })).toBeVisible();
  });
});
