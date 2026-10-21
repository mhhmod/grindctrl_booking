// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDictionary } from '@/lib/try-on/i18n';
import { getSheetCopy, type ArabicAddressForm } from '@/lib/try-on/sheet-copy';
import { parseStoreProduct } from '@/lib/try-on/store-product';
import type { TryOnJob } from '@/lib/try-on/types';
import type { ResultControls } from '../try-on-result';
import { SheetResultStep } from './sheet-result-step';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

/* TryOn-Result in the sheet, on a fake product with two colours and four
   sizes (phase zero item 19). */
const JOB = {
  jobId: 'job-1',
  sessionId: 'session-1',
  productId: 'layla-abaya',
  shop: 'demo.myshopify.com',
  status: 'completed',
  resultImageUrl: 'data:image/png;base64,bG9vaw==',
  createdAt: '2026-10-20T10:00:00Z',
  meta: { runtime: 'live', provider: 'test', costEstimate: null },
} as unknown as TryOnJob;
const PHOTO = 'data:image/png;base64,cGhvdG8=';
const PRODUCT = parseStoreProduct({
  options: ['Colour', 'Size'],
  currency: 'EGP',
  variants: [
    ...['S', 'M', 'L', 'XL'].map((size, i) => ({ id: 100 + i, title: `Black / ${size}`, options: ['Black', size], available: size !== 'L', price: 325000 })),
    ...['S', 'M', 'L', 'XL'].map((size, i) => ({ id: 200 + i, title: `Sand / ${size}`, options: ['Sand', size], available: true, price: 325000 })),
  ],
})!;
const ARABIC = parseStoreProduct({
  options: ['اللون', 'المقاس'],
  currency: 'EGP',
  variants: ['S', 'M'].map((size, i) => ({ id: 100 + i, title: `أسود / ${size}`, options: ['أسود', size], available: true, price: 325000 })),
})!;

function renderResult({
  locale = 'en',
  form = 'everyone',
  product = PRODUCT,
  controls,
}: { locale?: 'en' | 'ar'; form?: ArabicAddressForm; product?: typeof PRODUCT | null; controls?: ResultControls } = {}) {
  const onChangePhoto = vi.fn();
  render(
    <SheetResultStep
      copy={getSheetCopy(locale, form)}
      t={getDictionary(locale)}
      locale={locale}
      job={JOB}
      photoDataUrl={PHOTO}
      productName="Layla Embroidered Abaya"
      storeProduct={product}
      triedVariantId="101"
      fallbackVariantTitle="Black / M"
      controls={controls}
      onChangePhoto={onChangePhoto}
    />,
  );
  return { onChangePhoto };
}

function ack(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-tryon:cart-result', ...data }, source: window }));
  });
}

const nbsp = (text: string | null) => (text ?? '').replace(/ /g, ' ');

afterEach(() => vi.restoreAllMocks());

describe('the look in the sheet', () => {
  it('says the look is ready, with the piece and its price', () => {
    renderResult();
    expect(screen.getByRole('heading', { name: 'Your look is ready' })).toBeInTheDocument();
    expect(nbsp(screen.getByText(/Layla Embroidered Abaya ·/).textContent)).toBe('Layla Embroidered Abaya · EGP 3,250');
    expect(screen.getByRole('img', { name: 'You wearing the Layla Embroidered Abaya' })).toHaveAttribute('src', JOB.resultImageUrl);
    expect(screen.getByText('AI preview')).toBeInTheDocument();
  });

  it('compares the look with the photo, and changes the photo from there', () => {
    const { onChangePhoto } = renderResult();
    const compare = screen.getByRole('group', { name: 'Compare' });
    expect(screen.getByRole('button', { name: 'Look' })).toHaveAttribute('aria-pressed', 'true');
    expect(compare).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change photo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Your photo' }));
    expect(screen.getByRole('img', { name: 'Your original photo' })).toHaveAttribute('src', PHOTO);
    expect(screen.queryByText('AI preview')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    expect(onChangePhoto).toHaveBeenCalledTimes(1);
  });

  it('switches size without a new look, and the button always names what it adds', () => {
    const posted = vi.spyOn(window, 'postMessage');
    renderResult();
    expect(screen.getByText('Colour').nextSibling).toHaveTextContent('Black');
    const sizes = screen.getByRole('radiogroup', { name: 'Size' });
    expect(Array.from(sizes.querySelectorAll('[role=radio]')).map((node) => node.textContent)).toEqual(['S', 'M', 'L', 'XL']);
    expect(screen.getByRole('radio', { name: 'M' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Add to cart · Black, M' })).toBeEnabled();

    fireEvent.click(screen.getByRole('radio', { name: 'S' }));
    expect(screen.getByRole('radio', { name: 'S' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart · Black, S' }));
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-tryon:add-to-cart', variantId: '100' }, '*');
  });

  it('says a sold out size is sold out, on the size and on the button', () => {
    renderResult();
    fireEvent.click(screen.getByRole('radio', { name: 'L, sold out' }));
    expect(screen.getByRole('button', { name: 'Sold out' })).toBeDisabled();
  });

  it('says what it added, with a way to check out, and why an add failed', () => {
    const posted = vi.spyOn(window, 'postMessage');
    renderResult();
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart · Black, M' }));
    expect(screen.getByRole('button', { name: 'Adding to cart' })).toBeDisabled();
    ack({ ok: true, variantTitle: 'Black / M' });
    expect(screen.getByRole('status')).toHaveTextContent('Added Black, M');
    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-tryon:checkout' }, '*');

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart · Black, M' }));
    ack({ ok: false, message: 'Only 1 left' });
    expect(screen.getByText('Only 1 left')).toBeInTheDocument();
  });

  it('ignores acks from anywhere but the store page', () => {
    renderResult();
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart · Black, M' }));
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: 'x' }, source: null }));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('still adds the tried variant before the product arrives, named from the tap', () => {
    const posted = vi.spyOn(window, 'postMessage');
    renderResult({ product: null });
    expect(screen.getByText('Layla Embroidered Abaya')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart · Black, M' }));
    expect(posted).toHaveBeenCalledWith({ type: 'grindctrl-tryon:add-to-cart', variantId: '101' }, '*');
  });

  it("follows the merchant's choices for the result", () => {
    renderResult({ controls: { showAddToCart: false, showTryAgain: false, showDownload: false, showWhatsapp: false, disclaimerText: 'Fits true to size.' } });
    expect(screen.queryByRole('button', { name: /Add to cart/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save photo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Your photo' }));
    expect(screen.queryByRole('button', { name: 'Change photo' })).toBeNull();
    expect(screen.getByText('Fits true to size.')).toBeInTheDocument();
  });

  it.each([
    ['women', 'أضيفي إلى السلة · أسود، M', 'غيّري الصورة'],
    ['men', 'أضف إلى السلة · أسود، M', 'غيّر الصورة'],
    ['everyone', 'إضافة إلى السلة · أسود، M', 'تغيير الصورة'],
  ] as const)('speaks the Arabic %s form, with the store\'s own names and Western digits', (form, add, change) => {
    renderResult({ locale: 'ar', form, product: ARABIC });
    expect(screen.getByRole('heading', { name: form === 'women' ? 'إطلالتكِ جاهزة' : form === 'men' ? 'إطلالتك جاهزة' : 'الإطلالة جاهزة' })).toBeInTheDocument();
    expect(nbsp(screen.getByText(/Layla Embroidered Abaya ·/).textContent)).toBe('Layla Embroidered Abaya · 3,250 ج.م');
    expect(screen.getByRole('radiogroup', { name: 'المقاس' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: add })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: form === 'women' ? 'صورتكِ' : 'صورتك' }));
    expect(screen.getByRole('button', { name: change })).toBeInTheDocument();
  });
});
