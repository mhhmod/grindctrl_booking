import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TryOnLocaleProvider } from './locale-provider';
import { TryOnResult, variantLabel } from './try-on-result';
import { EmbedFrameBridge } from './embed-frame-bridge';
import type { TryOnJob } from '@/lib/try-on/types';

/* The v16 sheet keeps the shopper on the look after an add (02-try-on.md):
   the block acks with the variant it added, and the look says so with a
   way to check out. */
const JOB = {
  jobId: 'job-1',
  sessionId: 'session-1',
  productId: 'layla-abaya',
  shop: 'demo.myshopify.com',
  status: 'completed',
  resultImageUrl: 'https://grindctrl.cloud/look.png',
  createdAt: '2026-10-20T10:00:00Z',
  meta: { runtime: 'live', provider: 'test', costEstimate: null },
} as unknown as TryOnJob;

function renderResult(locale: 'en' | 'ar' = 'en') {
  return render(
    <TryOnLocaleProvider initialLocale={locale}>
      <TryOnResult job={JOB} productName="Layla Embroidered Abaya" onReset={() => {}} shopMode />
    </TryOnLocaleProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('the look after an add in the sheet', () => {
  it.each([
    ['en', 'Added Black, M', 'Checkout'],
    ['ar', 'تمت الإضافة: Black, M', 'إتمام الشراء'],
  ] as const)('names the variant it added in %s, with a way to check out', (locale, added, checkout) => {
    const posted = vi.spyOn(window.parent, 'postMessage');
    renderResult(locale);
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: 'Black / M' } }));
    });

    expect(screen.getByRole('status')).toHaveTextContent(added);
    fireEvent.click(screen.getByRole('button', { name: checkout }));
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-tryon:checkout' }, '*');
  });

  it('says it added to the cart for a product with no variants', () => {
    renderResult();
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: 'Default Title' } }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Added to cart');
  });

  it('writes Shopify variant titles the way the boards do', () => {
    expect(variantLabel('Black / M')).toBe('Black, M');
    expect(variantLabel('Sand')).toBe('Sand');
    expect(variantLabel('Default Title')).toBe('');
  });
});

describe('Escape inside the sheet', () => {
  it('asks the store page to close the sheet, and only in the sheet', () => {
    const parent = { postMessage: vi.fn() };
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as unknown as Window);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });

    window.history.replaceState(null, '', '/embed/try-on?product=layla&sheet=1');
    const { unmount } = render(<EmbedFrameBridge />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(parent.postMessage).toHaveBeenCalledWith({ type: 'grindctrl-tryon:close' }, '*');
    unmount();

    parent.postMessage.mockClear();
    window.history.replaceState(null, '', '/embed/try-on?product=layla');
    render(<EmbedFrameBridge />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(parent.postMessage).not.toHaveBeenCalledWith({ type: 'grindctrl-tryon:close' }, '*');
    vi.unstubAllGlobals();
  });
});
