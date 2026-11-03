import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';

const mocks = vi.hoisted(() => ({ getShopifySessionToken: vi.fn() }));

vi.mock('@/lib/shopify/app-bridge-client', () => ({
  getShopifySessionToken: mocks.getShopifySessionToken,
}));
/* The editor has its own tests (v16-tryon-studio.test.tsx); here only what the
   Shopify tab hands it and how it saves. */
const studio = vi.hoisted(() => ({ props: null as null | { shop: string; saveSettings: (form: FormData) => Promise<unknown> } }));
vi.mock('@/components/dashboard/v16/try-on/v16-tryon-studio', () => ({
  V16TryOnStudio: (props: { shop: string; saveSettings: (form: FormData) => Promise<unknown> }) => {
    studio.props = props;
    return <div data-testid="tryon-studio">{props.shop}</div>;
  },
}));

import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { ShopifyAdminSettings } from './admin-settings';
import { getSettingsFormCopy } from '@/lib/try-on/settings-copy';

const settings = { buttonLabel: 'Try it on' } as TryOnWidgetSettings;
const c = getSettingsFormCopy('en');

function response(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: vi.fn(async () => body) } as unknown as Response;
}

function mockSettingsLoad(linked: boolean, linkedAccount: string | null = null) {
  vi.mocked(fetch).mockResolvedValueOnce(
    response({ shop: 'real-shop.myshopify.com', settings, linked, linkedAccount }),
  );
}

describe('ShopifyAdminSettings shop linking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getShopifySessionToken.mockResolvedValue('verified-session-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows confirmation and no form when the shop is linked', async () => {
    mockSettingsLoad(true);
    render(<ShopifyAdminSettings locale="en" />);

    expect(await screen.findByText(c.shopLinked)).toBeInTheDocument();
    expect(screen.queryByLabelText(c.shopLinkCodeLabel)).not.toBeInTheDocument();
  });

  it('names the linked account and lets the store admin link a different one', async () => {
    mockSettingsLoad(true, 'm•••@gmail.com');
    vi.mocked(fetch).mockResolvedValueOnce(response({ outcome: 'linked' }));
    render(<ShopifyAdminSettings locale="en" />);

    expect(await screen.findByText(c.shopLinkedTo('m•••@gmail.com'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: c.relinkShop }));

    expect(screen.getByText(c.relinkHint)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(c.shopLinkCodeLabel), { target: { value: 'WXYZ-2345' } });
    fireEvent.click(screen.getByRole('button', { name: c.linkShop }));

    expect(await screen.findByText(c.shopLinkSuccess)).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.lastCall?.[1]?.body).toBe(
      JSON.stringify({ code: 'WXYZ-2345', replace: true }),
    );
  });

  it('shows the code form when the shop is not linked', async () => {
    mockSettingsLoad(false);
    render(<ShopifyAdminSettings locale="en" />);

    expect(await screen.findByLabelText(c.shopLinkCodeLabel)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.linkShop })).toBeInTheDocument();
  });

  it('submits only the code and replaces the form with success after linking', async () => {
    mockSettingsLoad(false);
    vi.mocked(fetch).mockResolvedValueOnce(response({ outcome: 'linked' }));
    render(<ShopifyAdminSettings locale="en" />);

    fireEvent.change(await screen.findByLabelText(c.shopLinkCodeLabel), {
      target: { value: 'ABCD-EFGH' },
    });
    fireEvent.click(screen.getByRole('button', { name: c.linkShop }));

    expect(await screen.findByText(c.shopLinkSuccess)).toBeInTheDocument();
    expect(screen.queryByLabelText(c.shopLinkCodeLabel)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith('/api/shopify/admin/link', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer verified-session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: 'ABCD-EFGH', replace: false }),
    });
  });

  it.each([
    ['invalid', c.shopLinkInvalid],
    ['expired', c.shopLinkExpired],
    ['already_owned', c.shopLinkAlreadyOwned],
  ] as const)('shows the %s outcome below the field', async (outcome, message) => {
    mockSettingsLoad(false);
    vi.mocked(fetch).mockResolvedValueOnce(response({ outcome }));
    render(<ShopifyAdminSettings locale="en" />);

    fireEvent.change(await screen.findByLabelText(c.shopLinkCodeLabel), {
      target: { value: 'ABCDEFGH' },
    });
    fireEvent.click(screen.getByRole('button', { name: c.linkShop }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText(c.shopLinkCodeLabel)).toBeInTheDocument();
  });

  it('uses the generic retry copy for a network failure', async () => {
    mockSettingsLoad(false);
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    render(<ShopifyAdminSettings locale="en" />);

    fireEvent.change(await screen.findByLabelText(c.shopLinkCodeLabel), {
      target: { value: 'ABCDEFGH' },
    });
    fireEvent.click(screen.getByRole('button', { name: c.linkShop }));

    await waitFor(() => expect(screen.getByText(c.shopLinkFailed)).toBeInTheDocument());
  });

  it('renders the new linking copy in Arabic', async () => {
    mockSettingsLoad(false);
    render(<ShopifyAdminSettings locale="ar" />);

    const ar = getSettingsFormCopy('ar');
    expect(await screen.findByText(ar.shopLinkTitle)).toBeInTheDocument();
    expect(screen.getByLabelText(ar.shopLinkCodeLabel)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ar.linkShop })).toBeInTheDocument();
  });
});

describe('ShopifyAdminSettings editor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getShopifySessionToken.mockResolvedValue('verified-session-token');
    vi.stubGlobal('fetch', vi.fn());
    studio.props = null;
  });

  it('hands the shop and its settings to the Set up editor, under the two theme links', async () => {
    mockSettingsLoad(true);
    render(<ShopifyAdminSettings locale="en" />);

    expect(await screen.findByTestId('tryon-studio')).toHaveTextContent('real-shop.myshopify.com');
    expect(screen.getByRole('link', { name: 'Add to product page' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Enable catalog try-on' })).toHaveAttribute('target', '_blank');
  });

  it('saves through the session-token API, in the API’s own shape', async () => {
    mockSettingsLoad(true);
    vi.mocked(fetch).mockResolvedValueOnce(response({ ok: true }));
    render(<ShopifyAdminSettings locale="en" />);
    await screen.findByTestId('tryon-studio');

    const form = new FormData();
    form.set('button_label', 'Try it');
    form.set('show_download', 'on');
    form.set('loading_steps', 'One\nTwo');
    await expect(studio.props!.saveSettings(form)).resolves.toEqual({ ok: true });

    const [url, init] = vi.mocked(fetch).mock.lastCall!;
    expect(url).toBe('/api/shopify/admin/settings');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ Authorization: 'Bearer verified-session-token', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toMatchObject({ buttonLabel: 'Try it', showDownload: true, showTryAgain: false, loadingSteps: ['One', 'Two'] });
  });

  it('reports a refused or rate-limited save to the editor instead of saying it saved', async () => {
    mockSettingsLoad(true);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers({ 'Retry-After': '9' }) } as unknown as Response)
      .mockRejectedValueOnce(new Error('offline'));
    render(<ShopifyAdminSettings locale="en" />);
    await screen.findByTestId('tryon-studio');

    await expect(studio.props!.saveSettings(new FormData())).resolves.toMatchObject({ ok: false, code: 'rate_limited', retryAfterSeconds: 9 });
    await expect(studio.props!.saveSettings(new FormData())).resolves.toMatchObject({ ok: false, code: 'unavailable' });
  });

  it.each([
    ['en', 'Could not load settings. Open this page from your Shopify admin.'],
    ['ar', 'تعذّر تحميل الإعدادات. افتح هذه الصفحة من لوحة تحكم Shopify.'],
  ] as const)('says so, in %s, when the settings cannot be read', async (locale, message) => {
    vi.mocked(fetch).mockResolvedValueOnce(response({}, false));
    render(<ShopifyAdminSettings locale={locale} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
