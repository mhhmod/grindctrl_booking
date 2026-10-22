import React from 'react';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { renderWithMantine } from '@/components/mantine/test-utils';
import { BOOKING_URL } from '@/lib/booking';
import { getTodaySetupCopy } from '@/lib/dashboard/today-setup-copy';
import { buildTodaySetupView, type TodaySetupFacts } from '@/lib/dashboard/today-setup-model';
import { V16TodaySetup, type TodaySetupActions } from './v16-today-setup';

const en = getTodaySetupCopy('en');
const FACTS: TodaySetupFacts = {
  store: 'Maison Noor',
  shop: 'maison-noor.myshopify.com',
  chatSeenAt: '2026-10-02T10:58:00Z',
  storeLook: false,
  testLook: false,
  holdoutAvailable: false,
};

function actions(): TodaySetupActions {
  return {
    setLaunchState: vi.fn(async ({ state }) => ({ ok: true as const, state })),
    createPreviewLink: vi.fn(async () => ({ ok: true as const, url: 'https://maison-noor.myshopify.com/?gc_preview=t', expiresAt: '2026-10-03T11:00:00Z' })),
  };
}

function draw(facts: Partial<TodaySetupFacts> = {}, a = actions(), locale: 'en' | 'ar' = 'en') {
  const view = buildTodaySetupView({ ...FACTS, ...facts }, getTodaySetupCopy(locale));
  renderWithMantine(<V16TodaySetup view={view} locale={locale} shop={FACTS.shop} actions={a} />);
  return a;
}

function step(name: string) {
  return screen.getByRole('heading', { level: 3, name }).closest('li') as HTMLElement;
}

afterEach(() => {
  vi.restoreAllMocks();
  router.refresh.mockClear();
});

describe('V16TodaySetup', () => {
  it('lists the steps with what is ready, and the theme editor links', () => {
    draw();
    expect(screen.getByRole('heading', { level: 2, name: 'Get Maison Noor live' })).toBeInTheDocument();
    expect(screen.getByText('3 steps left, about 6 minutes')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Get Maison Noor live: 3 steps left, about 6 minutes' })).toHaveAttribute('aria-valuenow', '25');

    const connected = step(en.connected);
    expect(within(connected).getByText(en.done)).toBeInTheDocument();
    expect(within(connected).getByText('maison-noor.myshopify.com')).toBeInTheDocument();

    const theme = step(en.theme);
    const [chat, tryOn] = within(theme).getAllByRole('listitem');
    expect(chat).toHaveTextContent(`${en.ready}${en.chatEmbed}`);
    // Not seen is not called missing: the theme itself is read with N24.
    expect(tryOn).toHaveTextContent(en.tryOnBlock);
    expect(tryOn).not.toHaveTextContent(en.ready);
    expect(within(theme).getByRole('link', { name: en.addButton })).toHaveAttribute(
      'href',
      'https://maison-noor.myshopify.com/admin/themes/current/editor?template=product&addAppBlockId=fc095fe656d9029fdc249a4af2315f19/tryon&target=mainSection',
    );
    expect(within(theme).queryByRole('link', { name: en.openThemeEditor })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.book })).toHaveAttribute('href', BOOKING_URL);
  });

  it('links the Store Chat embed until it has been seen on the store', () => {
    draw({ chatSeenAt: null });
    const theme = step(en.theme);
    expect(within(theme).getByRole('link', { name: en.openThemeEditor })).toHaveAttribute(
      'href',
      'https://maison-noor.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=fc095fe656d9029fdc249a4af2315f19/messenger',
    );
    expect(within(theme).queryByText(en.ready)).not.toBeInTheDocument();
  });

  it('folds finished steps to their title, and opens them again', () => {
    draw({ storeLook: true, testLook: true });
    expect(screen.getByText('1 step left, about 2 minutes')).toBeInTheDocument();
    const fold = within(step(en.theme)).getByRole('button', { name: en.theme });
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: en.addButton })).not.toBeInTheDocument();
    fireEvent.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: en.addButton })).toBeInTheDocument();
    // Store connected has nothing to fold.
    expect(within(step(en.connected)).queryByRole('button')).not.toBeInTheDocument();
  });

  it('checks again on the button and when the page regains focus', async () => {
    draw();
    fireEvent.click(screen.getByRole('button', { name: en.checkAgain }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(router.refresh).toHaveBeenCalledTimes(2);
    // Not again within the next few seconds.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });

  it('opens the store on a preview link in a new tab', async () => {
    const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const a = draw();
    await act(async () => {
      fireEvent.click(within(step(en.tryIt)).getByRole('button', { name: en.openStore }));
    });
    expect(a.createPreviewLink).toHaveBeenCalledWith({ shop: FACTS.shop });
    expect(tab.location.href).toBe('https://maison-noor.myshopify.com/?gc_preview=t');
    expect(tab.opener).toBeNull();
    expect(within(step(en.tryIt)).getByText(en.testFree)).toBeInTheDocument();
  });

  it('closes the tab and says so when the preview link fails', async () => {
    const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const a = actions();
    vi.mocked(a.createPreviewLink).mockResolvedValueOnce({ ok: false, code: 'not_enabled', message: 'nope' });
    draw({}, a);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.openStore }));
    });
    expect(tab.close).toHaveBeenCalled();
    expect(within(step(en.tryIt)).getByRole('alert')).toHaveTextContent(en.failed);
  });

  it('goes live for everyone, and offers the 50/50 test only with n6_holdout', async () => {
    const a = draw();
    const goLive = step(en.goLive);
    expect(goLive).toHaveTextContent(en.onlyYou);
    expect(within(goLive).queryByRole('button', { name: en.halfTest })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(goLive).getByRole('button', { name: en.goLive }));
    });
    expect(a.setLaunchState).toHaveBeenCalledWith({ shop: FACTS.shop, state: 'live' });
    expect(router.refresh).toHaveBeenCalled();
  });

  it('starts the 50/50 test, and says so when going live fails', async () => {
    const a = actions();
    vi.mocked(a.setLaunchState).mockResolvedValueOnce({ ok: false, code: 'rate_limited', message: 'slow down' } as never);
    draw({ holdoutAvailable: true }, a);
    const goLive = step(en.goLive);
    expect(goLive).toHaveTextContent(en.goLiveBody);
    await act(async () => {
      fireEvent.click(within(goLive).getByRole('button', { name: en.halfTest }));
    });
    expect(a.setLaunchState).toHaveBeenCalledWith({ shop: FACTS.shop, state: 'holdout' });
    expect(within(goLive).getByRole('alert')).toHaveTextContent(en.failed);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('speaks Arabic in Arabic', () => {
    draw({}, actions(), 'ar');
    const ar = getTodaySetupCopy('ar');
    expect(screen.getByRole('heading', { level: 2, name: 'جهّز Maison Noor للإطلاق' })).toBeInTheDocument();
    expect(screen.getByText('تبقّت 3 خطوات، نحو 6 دقائق')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: ar.theme })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ar.book })).toBeInTheDocument();
  });
});
