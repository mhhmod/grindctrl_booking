import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { getPlacementCopy } from '@/lib/dashboard/tryon-studio-copy';
import type { ButtonPlacement as Placement } from '@/lib/try-on/placement';
import { ButtonPlacement, PICK_POLL_MS, type PlacementActions } from './button-placement';

/* The saved line wraps the store's label in <bdi>, so match the line by its whole text. */
const savedSpot = (text: string) => (_: string, node: Element | null) =>
  node?.tagName === 'P' && node.textContent === text;

const SHOP = 'site:11111111-1111-4111-8111-111111111111';
const SPOT = { selector: 'form[action*="cart"]', position: 'after' as const, label: 'أضف للسلة', pathHint: '/products/dress' };
const en = getPlacementCopy('en');
const ar = getPlacementCopy('ar');

function actions(initial: Placement = { placement: 'auto' }) {
  let current = initial;
  const a = {
    read: vi.fn(async () => ({ ok: true as const, placement: current })),
    set: vi.fn(async ({ placement }: { placement: Placement['placement'] }) => {
      current = { placement, ...(current.spot ? { spot: current.spot } : {}) };
      return { ok: true as const, placement: current };
    }),
    open: vi.fn(async () => ({ ok: true as const, url: 'https://shop.example/?gc_pick=tok', expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() })),
    store: (next: Placement) => { current = next; },
  };
  return a;
}
function draw(a: ReturnType<typeof actions>, locale: 'en' | 'ar' = 'en') {
  return renderWithMantine(<ButtonPlacement shop={SHOP} locale={locale} actions={a as unknown as PlacementActions} loadFailed="Could not load" />);
}
const radio = (name: string) => screen.getByRole('radio', { name: new RegExp(name) });

let popup: { closed: boolean; opener: unknown; location: { href: string }; close: () => void };
beforeEach(() => {
  popup = { closed: false, opener: {}, location: { href: '' }, close: vi.fn(() => { popup.closed = true; }) };
  vi.spyOn(window, 'open').mockImplementation(() => popup as unknown as Window);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Button placement (B1)', () => {
  it('offers the three placements, automatic recommended and chosen by default', async () => {
    draw(actions());
    await waitFor(() => expect(radio(en.auto)).toBeChecked());
    expect(screen.getByRole('heading', { name: en.section })).toBeInTheDocument();
    expect(screen.getByText(en.recommended)).toBeInTheDocument();
    for (const text of [en.autoSub, en.spot, en.spotSub, en.floating, en.floatingSub, en.advanced]) expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('saves floating at once', async () => {
    const a = actions();
    draw(a);
    await waitFor(() => expect(radio(en.auto)).not.toBeDisabled());
    fireEvent.click(radio(en.floating));
    await waitFor(() => expect(a.set).toHaveBeenCalledWith({ shop: SHOP, placement: 'floating' }));
    await waitFor(() => expect(radio(en.floating)).toBeChecked());
  });

  it('puts the choice back when saving fails', async () => {
    const a = actions();
    a.set.mockResolvedValueOnce({ ok: false, code: 'unavailable', message: 'x' } as never);
    draw(a);
    await waitFor(() => expect(radio(en.auto)).not.toBeDisabled());
    fireEvent.click(radio(en.floating));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.failed);
    expect(radio(en.auto)).toBeChecked();
  });

  it('a spot not yet picked offers Pick a spot and saves nothing', async () => {
    const a = actions();
    draw(a);
    await waitFor(() => expect(radio(en.auto)).not.toBeDisabled());
    fireEvent.click(radio(en.spot));
    expect(await screen.findByRole('button', { name: en.pick })).toBeInTheDocument();
    expect(a.set).not.toHaveBeenCalled();
  });

  it('shows the saved spot with Change and Reset to automatic', async () => {
    const a = actions({ placement: 'spot', spot: SPOT });
    draw(a);
    expect(await screen.findByText(savedSpot('Below "أضف للسلة"'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.change })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.reset }));
    await waitFor(() => expect(a.set).toHaveBeenCalledWith({ shop: SHOP, placement: 'auto' }));
    await waitFor(() => expect(radio(en.auto)).toBeChecked());
  });

  it('opens the store in a new tab, then shows the spot saved there by itself', async () => {
    const a = actions();
    draw(a);
    await waitFor(() => expect(radio(en.auto)).not.toBeDisabled());
    fireEvent.click(radio(en.spot));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(await screen.findByRole('button', { name: en.pick }));
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(popup.location.href).toBe('https://shop.example/?gc_pick=tok'));
    expect(popup.opener).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(en.finish);
    a.store({ placement: 'spot', spot: { ...SPOT, position: 'before', label: 'Add to cart' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(PICK_POLL_MS); });
    expect(await screen.findByText(savedSpot('Above "Add to cart"'))).toBeInTheDocument();
    expect(radio(en.spot)).toBeChecked();
    expect(screen.queryByText(en.finish)).toBeNull();
    // Stops reading once the spot arrived.
    const reads = a.read.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(PICK_POLL_MS * 3); });
    expect(a.read.mock.calls.length).toBe(reads);
  });

  it('stops watching when the store tab closes', async () => {
    const a = actions();
    draw(a);
    await waitFor(() => expect(radio(en.auto)).not.toBeDisabled());
    fireEvent.click(radio(en.spot));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(await screen.findByRole('button', { name: en.pick }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(en.finish));
    popup.closed = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(PICK_POLL_MS); });
    expect(screen.queryByText(en.finish)).toBeNull();
  });

  it('offers the link itself when the browser blocked the new tab', async () => {
    vi.mocked(window.open).mockReturnValueOnce(null);
    const a = actions();
    draw(a);
    await waitFor(() => expect(radio(en.auto)).not.toBeDisabled());
    fireEvent.click(radio(en.spot));
    fireEvent.click(await screen.findByRole('button', { name: en.pick }));
    const link = await screen.findByRole('link', { name: en.pick });
    expect(link).toHaveAttribute('href', 'https://shop.example/?gc_pick=tok');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('closes the blank tab and says so when no link could be made', async () => {
    const a = actions();
    a.open.mockResolvedValueOnce({ ok: false, code: 'unavailable', message: 'x' } as never);
    draw(a);
    await waitFor(() => expect(radio(en.auto)).not.toBeDisabled());
    fireEvent.click(radio(en.spot));
    fireEvent.click(await screen.findByRole('button', { name: en.pick }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.failed);
    expect(popup.close).toHaveBeenCalled();
  });

  it('advanced: tests a valid selector on the store, above or below', async () => {
    const a = actions();
    draw(a);
    await waitFor(() => expect(radio(en.auto)).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: en.advanced }));
    const field = await screen.findByLabelText(en.selector);
    const test = screen.getByRole('button', { name: en.test });
    fireEvent.change(field, { target: { value: 'a:hover' } });
    expect(test).toBeDisabled();
    fireEvent.change(field, { target: { value: '#ProductInfo button.add' } });
    fireEvent.click(screen.getByRole('radio', { name: en.above }));
    fireEvent.click(test);
    await waitFor(() => expect(a.open).toHaveBeenCalledWith({ shop: SHOP, advanced: { selector: '#ProductInfo button.add', position: 'before' } }));
  });

  it('says so when the setting cannot be read', async () => {
    const a = actions();
    a.read.mockResolvedValueOnce({ ok: false, code: 'unavailable', message: 'x' } as never);
    draw(a);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
  });

  it('reads in Arabic, right to left in the page', async () => {
    draw(actions({ placement: 'spot', spot: { ...SPOT, position: 'before' } }), 'ar');
    expect(await screen.findByText(savedSpot('فوق «أضف للسلة»'))).toBeInTheDocument();
    for (const text of [ar.section, ar.auto, ar.recommended, ar.autoSub, ar.spot, ar.spotSub, ar.floating, ar.floatingSub, ar.change, ar.reset, ar.advanced]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });
});

describe('placement strings', () => {
  it('are the handoff strings, word for word', () => {
    expect(en).toMatchObject({ section: 'Button placement', auto: 'Next to your Buy button', recommended: 'Recommended',
      autoSub: 'We find your Add to cart or Buy now button.', spot: 'Pick a spot on my store', spotSub: 'Tap the exact place on your product page.',
      pick: 'Pick a spot', change: 'Change', reset: 'Reset to automatic', floating: 'Floating button',
      floatingSub: 'A small button at the bottom corner of product pages.', advanced: 'Advanced (for developers)', selector: 'CSS selector',
      above: 'Above', below: 'Below', test: 'Test on my store', opening: 'Opening your store…', finish: 'Finish in the new tab' });
    expect(ar).toMatchObject({ section: 'مكان الزر', auto: 'بجوار زر الشراء', recommended: 'مستحسن',
      autoSub: 'نجد زر «أضف للسلة» أو «اشترِ الآن» تلقائيًا.', spot: 'اختر مكانًا في متجري', spotSub: 'اضغط على المكان الذي تريده في صفحة المنتج.',
      pick: 'اختر المكان', change: 'تغيير', reset: 'العودة للتلقائي', floating: 'زر عائم', floatingSub: 'زر صغير في زاوية صفحة المنتج السفلية.',
      advanced: 'متقدم (للمطورين)', selector: 'محدد CSS', above: 'فوق', below: 'تحت', test: 'جرّبه على متجري',
      opening: 'جارٍ فتح متجرك…', finish: 'أكمل في الصفحة الجديدة' });
    expect(en.saved('after', 'Add to cart')).toBe('Below "Add to cart"');
    expect(ar.saved('before', 'أضف للسلة')).toBe('فوق «أضف للسلة»');
  });
});

it.each(['closed', 'expired'])('m6: reports an unsaved spot when the watcher is %s', async (reason) => {
  const a = actions(); draw(a);
  await waitFor(() => expect(radio(en.auto)).not.toBeDisabled());
  fireEvent.click(radio(en.spot));
  vi.useFakeTimers();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.pick })); });
  if (reason === 'closed') popup.closed = true;
  await act(async () => { await vi.advanceTimersByTimeAsync(reason === 'closed' ? PICK_POLL_MS : 30 * 60_000); });
  expect(screen.getByText(en.notSaved)).toBeInTheDocument();
  expect(a.set).not.toHaveBeenCalled();
});
