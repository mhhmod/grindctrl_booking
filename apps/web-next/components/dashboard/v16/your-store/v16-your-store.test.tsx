import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { buildTodayStoreCard, buildYourStoreView, type YourStoreFacts } from '@/lib/dashboard/your-store-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

import { V16YourStore, V16YourStoreNotConnected, V16YourStoreTodayCard, type YourStoreActions } from './v16-your-store';

const NOW = Date.parse('2026-11-10T12:14:00Z');

function facts(overrides: Partial<YourStoreFacts> = {}): YourStoreFacts {
  return {
    now: NOW,
    timeZone: 'UTC',
    platform: 'paste_website',
    address: 'lulusfashion.com',
    storeUrl: 'https://lulusfashion.com',
    canChange: true,
    canBilling: true,
    code: { lastSeenAt: new Date(NOW - 3 * 60_000).toISOString(), connected: false },
    launchState: 'live',
    codeOutdated: false,
    tryOn: { tenant: 'site:1', showButton: true, looksLeft: 15, looksIncluded: 20, planActive: true, pasteReason: null },
    chat: { siteId: 'site-1', enabled: true },
    domains: [],
    ...overrides,
  };
}

function actions(overrides: Partial<YourStoreActions> = {}): YourStoreActions {
  return {
    setTryOnButton: vi.fn(async () => ({ ok: true as const })),
    setStoreChat: vi.fn(async () => ({ ok: true as const })),
    checkDomain: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}

function renderStore(f: YourStoreFacts, locale: SiteLocale = 'en', acts = actions()) {
  const view = buildYourStoreView(f, getYourStoreCopy(locale), locale);
  const utils = render(<V16YourStore view={view} canChange={f.canChange} locale={locale} actions={acts} />);
  return { ...utils, acts };
}

beforeEach(() => refresh.mockClear());

describe('V16YourStore, product cards', () => {
  it('draws one card per product with its pill, sentence, looks line and store link', () => {
    renderStore(facts());
    expect(screen.getByRole('heading', { level: 2, name: 'On your store' })).toBeInTheDocument();
    const tryOn = screen.getByRole('region', { name: 'Try-On' });
    expect(within(tryOn).getByText('Working well')).toBeInTheDocument();
    expect(within(tryOn).getByText('15 looks left this month')).toBeInTheDocument();
    const link = within(tryOn).getByRole('link', { name: /See it on your store/ });
    expect(link).toHaveAttribute('href', 'https://lulusfashion.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(tryOn).getByRole('switch', { name: 'Try-On' })).toBeChecked();
    expect(within(screen.getByRole('region', { name: 'Store Chat' })).getByRole('switch', { name: 'Store Chat' })).toBeChecked();
    expect(screen.getByText('New features appear here.')).toBeInTheDocument();
  });

  it('draws the just-connected state in Arabic with both switches off and no Store check (A5.1)', () => {
    renderStore(facts({ tryOn: { ...facts().tryOn!, showButton: false }, chat: { siteId: 'site-1', enabled: false } }), 'ar');
    expect(screen.getByRole('heading', { name: 'الكود يعمل على lulusfashion.com' })).toBeInTheDocument();
    expect(screen.getByText('لا يظهر شيء للمتسوقين بعد. شغّل ما تريده من الأسفل.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'اعرض خطوات التركيب' })).toHaveAttribute('href', '/dashboard/store#connect');
    expect(screen.getByRole('heading', { name: 'شغّل ما تريد' })).toBeInTheDocument();
    const tryOn = screen.getByRole('switch', { name: 'القياس الافتراضي' });
    expect(tryOn).not.toBeChecked();
    expect(screen.getAllByText('متوقف')).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: 'فحص المتجر' })).toBeNull();
    expect(screen.queryByText('يعمل جيدًا')).toBeNull();
  });

  it('shows the switches disabled, with no error, to a member who cannot change settings', () => {
    renderStore(facts({ canChange: false }));
    expect(screen.getByRole('switch', { name: 'Try-On' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Store Chat' })).toBeDisabled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Install steps' })).toBeNull();
  });

  it('turns a switch on at once as Waiting for data, saving through the existing action', async () => {
    let resolve: (value: { ok: true }) => void = () => {};
    const setStoreChat = vi.fn(() => new Promise<{ ok: true }>((r) => (resolve = r)));
    renderStore(facts({ tryOn: { ...facts().tryOn!, showButton: false }, chat: { siteId: 'site-1', enabled: false } }), 'en', actions({ setStoreChat }));
    const chatSwitch = screen.getByRole('switch', { name: 'Store Chat' });
    fireEvent.click(chatSwitch);
    expect(setStoreChat).toHaveBeenCalledWith('site-1', true);
    expect(chatSwitch).toBeChecked();
    expect(chatSwitch).toBeDisabled();
    expect(within(screen.getByRole('region', { name: 'Store Chat' })).getByText('Waiting for data')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'On your store' })).toBeInTheDocument();
    await act(async () => resolve({ ok: true }));
    expect(chatSwitch).not.toBeDisabled();
  });

  it('rolls a failed save back and says so', async () => {
    const setTryOnButton = vi.fn(async () => ({ ok: false as const }));
    renderStore(facts(), 'en', actions({ setTryOnButton }));
    const tryOnSwitch = screen.getByRole('switch', { name: 'Try-On' });
    fireEvent.click(tryOnSwitch);
    expect(setTryOnButton).toHaveBeenCalledWith({ shop: 'site:1', showButton: false });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That didn’t save. Try again.'));
    expect(tryOnSwitch).toBeChecked();
  });

  it('shows the updated-code note with Get my updated code', () => {
    renderStore(facts({ platform: 'paste_shopify', codeOutdated: true }));
    const tryOn = screen.getByRole('region', { name: 'Try-On' });
    expect(within(tryOn).getByText('Collection pills need your updated code. Everything else keeps working.')).toBeInTheDocument();
    expect(within(tryOn).getByRole('link', { name: 'Get my updated code' })).toHaveAttribute('href', '/dashboard/store#connect');
  });

  it('keeps the store address left to right in Arabic', () => {
    renderStore(facts(), 'ar');
    const address = screen.getByText('lulusfashion.com');
    expect(address.tagName).toBe('BDI');
    expect(address).toHaveAttribute('dir', 'ltr');
    // In the header line and at the end of the code's Working well line.
    expect(screen.getAllByRole('link', { name: 'خطوات التركيب' })).toHaveLength(2);
  });
});

describe('V16YourStore, Store check', () => {
  it('groups What to fix before Working well, the first Not working fix filled', () => {
    const stale = new Date(NOW - 3 * 86_400_000).toISOString();
    const domains = [
      { id: 'd0', domain: 'lulusfashion.com', verified: true, state: 'trusted' as const, reason: null },
      { id: 'd1', domain: 'www.lulusfashion.com', verified: false, state: 'claimed' as const, reason: 'held_elsewhere' },
    ];
    renderStore(facts({ code: { lastSeenAt: stale, connected: false }, tryOn: { ...facts().tryOn!, looksLeft: 0 }, domains }));
    expect(screen.getByText('Checked today at 12:14 PM')).toBeInTheDocument();
    const fix = screen.getByRole('region', { name: 'What to fix' });
    const rows = within(fix).getAllByRole('listitem').filter((item) => item.parentElement?.parentElement === fix);
    expect(rows.map((row) => within(row).getByText(/Code on your store|Try-On availability|Addresses/).textContent)).toEqual([
      'Code on your store',
      'Try-On availability',
      'Addresses',
    ]);
    expect(within(rows[0]).getByText('Not working')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Needs attention')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: 'Reinstall in 1 minute' })).toHaveAttribute('data-variant', 'filled');
    expect(within(rows[1]).getByRole('link', { name: 'Top up' })).toHaveAttribute('href', '/dashboard/plan');
    expect(within(rows[1]).getByRole('link', { name: 'Top up' })).toHaveAttribute('data-variant', 'default');
    expect(within(rows[2]).getByText('Needs proof')).toBeInTheDocument();
    expect(within(rows[2]).getByRole('link', { name: "Prove it's yours" })).toBeInTheDocument();
  });

  it('collapses healthy rows into Working well lines, the code line ending with Install steps', () => {
    renderStore(facts(), 'ar');
    const well = screen.getByRole('region', { name: 'يعمل جيدًا' });
    expect(within(well).getByText('الكود على متجرك')).toBeInTheDocument();
    expect(within(well).getByText('شوهد منذ 3 دقائق')).toBeInTheDocument();
    expect(within(well).getByText('متبقي 15 إطلالة هذا الشهر')).toBeInTheDocument();
    expect(within(well).getByRole('link', { name: 'خطوات التركيب' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'ما يحتاج إصلاحًا' })).toBeNull();
  });

  it('waits for data before the code is first seen (A6.3), without a check time', () => {
    renderStore(facts({ code: { lastSeenAt: null, connected: false } }));
    expect(screen.getByText("We'll check your store as soon as your code is live.")).toBeInTheDocument();
    expect(screen.queryByText(/Checked today/)).toBeNull();
    expect(screen.getAllByText('Waiting for data')).toHaveLength(3);
  });

  it('runs the check again: button disabled as Checking, skeleton rows, waiting addresses checked, then a refresh', async () => {
    let finish: () => void = () => {};
    const checkDomain = vi.fn(() => new Promise<unknown>((r) => (finish = () => r({ ok: true }))));
    const domains = [{ id: 'd2', domain: 'www.lulusfashion.com', verified: false, state: 'trusted' as const, reason: 'awaiting_code' }];
    renderStore(facts({ domains }), 'en', actions({ checkDomain }));
    fireEvent.click(screen.getByRole('button', { name: 'Run check now' }));
    const button = await screen.findByRole('button', { name: 'Checking…' });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Checking your store' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What to fix' })).toBeNull();
    expect(checkDomain).toHaveBeenCalledWith('site-1', 'd2');
    await act(async () => finish());
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('only refreshes when there is no address to look at again', async () => {
    const { acts } = renderStore(facts());
    fireEvent.click(screen.getByRole('button', { name: 'Run check now' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(acts.checkDomain).not.toHaveBeenCalled();
  });
});

describe('V16YourStoreNotConnected', () => {
  it('says the store is not connected and opens set up', () => {
    render(<V16YourStoreNotConnected locale="en" canChange />);
    expect(screen.getByRole('heading', { name: 'Not connected yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect your store' })).toHaveAttribute('href', '/dashboard/store#connect');
  });

  it('in Arabic, with no set-up link for a member', () => {
    render(<V16YourStoreNotConnected locale="ar" canChange={false} />);
    expect(screen.getByRole('heading', { name: 'لم يُربط بعد' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('V16YourStoreTodayCard', () => {
  it('shows one status per product, the check time and View store check', () => {
    const card = buildTodayStoreCard(facts({ tryOn: { ...facts().tryOn!, looksLeft: 0 } }), getYourStoreCopy('en'), 'en');
    render(<V16YourStoreTodayCard card={card} locale="en" />);
    const section = screen.getByRole('region', { name: 'Your store' });
    expect(within(section).getByText('Checked today at 12:14 PM')).toBeInTheDocument();
    const items = within(section).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Try-OnNot working', 'Store ChatWorking well']);
    expect(within(section).getByRole('link', { name: 'View store check' })).toHaveAttribute('href', '/dashboard/store');
  });

  it('in Arabic, with Off for a product that is off', () => {
    const card = buildTodayStoreCard(facts({ chat: { siteId: 'site-1', enabled: false } }), getYourStoreCopy('ar'), 'ar');
    render(<V16YourStoreTodayCard card={card} locale="ar" />);
    const section = screen.getByRole('region', { name: 'متجرك' });
    expect(within(section).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['القياس الافتراضييعمل جيدًا', 'محادثة المتجرمتوقف']);
    expect(within(section).getByRole('link', { name: 'اعرض فحص المتجر' })).toBeInTheDocument();
  });
});

it('isolates the recorded photo hostname in Arabic and keeps the handoff sentence intact', () => {
  const copy = getYourStoreCopy('ar');
  renderStore(facts({ health: { inline: 0, floating: 0, detected: 0, missing: 0, listings: 0, pills: 0, photos: 0, photoHost: 'cdn.example.com' } }), 'ar');
  const host = screen.getByText('cdn.example.com', { selector: 'bdi' });
  expect(host).toHaveAttribute('dir', 'ltr');
  expect(host.parentElement?.textContent).toBe(copy.rows.photoFailure('cdn.example.com'));
});
