import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';

const mocks = vi.hoisted(() => ({ getShopifySessionToken: vi.fn() }));

vi.mock('@/lib/shopify/app-bridge-client', () => ({
  getShopifySessionToken: mocks.getShopifySessionToken,
}));
vi.mock('@/components/try-on/settings-controls', () => ({
  TryOnSettingsControls: () => <div data-testid="settings-controls" />,
}));
vi.mock('@/components/shopify/merchant-plan-card', () => ({
  MerchantPlanCard: () => <div data-testid="merchant-plan" />,
}));

import { ShopifyAdminSettings } from './admin-settings';
import { getSettingsFormCopy } from '@/lib/try-on/settings-copy';

const settings = {} as TryOnWidgetSettings;
const c = getSettingsFormCopy('en');

function response(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: vi.fn(async () => body) } as unknown as Response;
}

function mockSettingsLoad(linked: boolean) {
  vi.mocked(fetch).mockResolvedValueOnce(
    response({ shop: 'real-shop.myshopify.com', settings, linked }),
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
      body: JSON.stringify({ code: 'ABCD-EFGH' }),
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
