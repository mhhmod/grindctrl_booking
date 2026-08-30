// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getShopifySessionTokenMock } = vi.hoisted(() => ({ getShopifySessionTokenMock: vi.fn() }));
vi.mock('@/lib/shopify/app-bridge-client', () => ({ getShopifySessionToken: getShopifySessionTokenMock }));

import { useStoreChatActions } from './store-chat-actions';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  getShopifySessionTokenMock.mockResolvedValue('tok-abc');
  fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useStoreChatActions', () => {
  it('saveDraftSection posts to the draft route with a Bearer token, ignoring the siteId argument', async () => {
    const { result } = renderHook(() => useStoreChatActions());
    await result.current.saveDraftSection('client-side-site-id', 'appearance', { accentColor: '#fff' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shopify/store-chat/draft',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
        body: JSON.stringify({ section: 'appearance', payload: { accentColor: '#fff' } }),
      }),
    );
  });

  it('setMessengerEnabled posts to the enable route', async () => {
    const { result } = renderHook(() => useStoreChatActions());
    await result.current.setMessengerEnabled('site-id', true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shopify/store-chat/enable',
      expect.objectContaining({ body: JSON.stringify({ enabled: true }) }),
    );
  });

  it('addKnowledge sends op=addUrl when the form carries a url, op=add otherwise', async () => {
    const { result } = renderHook(() => useStoreChatActions());

    const withUrl = new FormData();
    withUrl.set('url', 'https://example.com');
    await result.current.addKnowledge(withUrl);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/shopify/store-chat/knowledge',
      expect.objectContaining({ body: JSON.stringify({ op: 'addUrl', url: 'https://example.com' }) }),
    );

    const manual = new FormData();
    manual.set('title', 'Shipping');
    manual.set('content', 'Ships fast');
    await result.current.addKnowledge(manual);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/shopify/store-chat/knowledge',
      expect.objectContaining({ body: JSON.stringify({ op: 'add', title: 'Shipping', content: 'Ships fast' }) }),
    );
  });

  it('returns a friendly failure instead of throwing when fetch itself rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useStoreChatActions());
    await expect(result.current.setMessengerEnabled('site-id', true)).resolves.toEqual({
      ok: false,
      error: 'Action failed. Please try again.',
    });
  });
});
