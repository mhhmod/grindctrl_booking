// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPhoneStore, memoryBackend, PHONE_KEEP_MS, type PhoneStore } from '@/lib/try-on/phone-store';
import { getDictionary } from '@/lib/try-on/i18n';
import { useTryOnFlow } from './use-try-on-flow';

const phone = vi.hoisted(() => ({ store: null as PhoneStore | null }));
vi.mock('@/lib/try-on/phone-store', async (original) => ({
  ...await original<typeof import('@/lib/try-on/phone-store')>(), phoneStore: () => phone.store,
}));
const PHOTO = 'data:image/jpeg;base64,cGhvdG8=';
const LOOK = 'data:image/png;base64,bG9vaw==';
const product = { id: 'woo-42', name: 'Dress' };
const shopProduct = { handle: product.id, name: product.name, imageUrl: '' };
const tenant = 'site:test-store';
const props = { product, shopProduct, displayShop: tenant, variantId: 'v-current', t: getDictionary('en') };
const session = { sessionId: 'signed', productId: product.id, shop: tenant, variantId: 'v-current', nonce: 'nonce' };

async function saveLook(savedAt = Date.now()) {
  await phone.store!.keepPhoto(PHOTO, savedAt);
  await phone.store!.keepLook({ tenantKey: tenant, productId: product.id, productName: product.name, jobId: 'deleted-server-job', imageDataUrl: LOOK }, savedAt);
}
beforeEach(() => {
  phone.store = createPhoneStore(memoryBackend());
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: session }) }));
});
afterEach(() => vi.unstubAllGlobals());

describe('device look restoration in the storefront flow', () => {
  it('saves finished bytes before exposing result actions and restores them on a later visit', async () => {
    const response = (data: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => data }) as Response;
    vi.mocked(fetch).mockResolvedValue(response({ ok: true }))
      .mockResolvedValueOnce(response({ ok: true, data: session }))
      .mockResolvedValueOnce(response({ ok: true, data: { attemptId: 'attempt' } }))
      .mockResolvedValueOnce(response({ ok: true, jobId: 'fresh', status: 'completed', productId: product.id, resultImageUrl: LOOK, meta: { runtime: 'live', provider: 'test', costEstimate: null } }));
    const first = renderHook(() => useTryOnFlow(props));
    await waitFor(() => expect(first.result.current.sessionState).toBe('ready'));
    act(() => first.result.current.selectPhoto(PHOTO));
    await act(() => first.result.current.generate());
    expect(first.result.current.step).toBe('result');
    expect((await phone.store!.latestLook(tenant, product.id))?.imageDataUrl).toBe(LOOK);
    first.unmount();
    vi.mocked(fetch).mockResolvedValue(response({ ok: true, data: session }));
    const nextVisit = renderHook(() => useTryOnFlow(props));
    await waitFor(() => expect(nextVisit.result.current.step).toBe('result'));
    expect(nextVisit.result.current.job?.jobId).toBe('fresh');
  });

  it('opens the saved image directly even when the server job and its session no longer exist', async () => {
    await saveLook();
    const { result } = renderHook(() => useTryOnFlow(props));
    await waitFor(() => expect(result.current.step).toBe('result'));
    expect(result.current.job?.resultImageUrl).toBe(LOOK);
    expect(result.current.job?.sessionId).toBe('');
    expect(result.current.photoDataUrl).toBeNull();
    expect(vi.mocked(fetch).mock.calls.every(([url]) => url === '/api/try-on/session')).toBe(true);
  });

  it('keeps another tenant/product private and ignores expired looks', async () => {
    await saveLook(Date.now() - PHONE_KEEP_MS);
    const expired = renderHook(() => useTryOnFlow(props));
    await waitFor(() => expect(expired.result.current.sessionState).toBe('ready'));
    expect(expired.result.current.step).toBe('upload');
    expired.unmount();
    await saveLook();
    const other = renderHook(() => useTryOnFlow({ ...props, displayShop: 'site:other' }));
    await waitFor(() => expect(other.result.current.sessionState).toBe('ready'));
    expect(other.result.current.job).toBeNull();
  });

  it('requires the signed session tenant and product before reading local history', async () => {
    await saveLook();
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { ...session, shop: 'site:attacker' } }) } as Response);
    const mismatch = renderHook(() => useTryOnFlow(props));
    await waitFor(() => expect(mismatch.result.current.sessionState).toBe('ready'));
    expect(mismatch.result.current.step).toBe('upload');
    expect(mismatch.result.current.job).toBeNull();
    mismatch.unmount();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401, json: async () => ({ ok: false }) } as Response);
    const invalid = renderHook(() => useTryOnFlow(props));
    await waitFor(() => expect(invalid.result.current.sessionState).toBe('error'));
    expect(invalid.result.current.job).toBeNull();
  });

  it('forgets the photo and every look together, keeping consent', async () => {
    await saveLook();
    await phone.store!.rememberConsent();
    const { result } = renderHook(() => useTryOnFlow(props));
    await waitFor(() => expect(result.current.step).toBe('result'));
    await act(() => result.current.forget());
    expect(result.current.step).toBe('upload');
    expect(await phone.store!.photo()).toBeNull();
    expect(await phone.store!.looks()).toEqual([]);
    expect(await phone.store!.hasConsent()).toBe(true);
  });

  it('falls back to upload when a locally stored image cannot be decoded', async () => {
    await saveLook();
    const { result } = renderHook(() => useTryOnFlow(props));
    await waitFor(() => expect(result.current.step).toBe('result'));
    await act(() => result.current.discardBrokenLook());
    expect(result.current.step).toBe('upload');
    expect(await phone.store!.latestLook(tenant, product.id)).toBeNull();
  });
});
