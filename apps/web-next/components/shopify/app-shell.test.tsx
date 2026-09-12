// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The "Claim this store" button used to swallow every outcome silently
   (already-linked, error, and even success all looked identical: nothing
   visibly happened). This covers the feedback states it now shows. */

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

const startShopifyClaimMock = vi.fn();
vi.mock('@/components/shopify/auto-claim', () => ({
  // A visible marker, not null: the ordering test below needs to observe
  // whether AutoClaim has actually mounted yet.
  AutoClaim: () => <div data-testid="auto-claim-mounted" />,
  startShopifyClaim: (...args: unknown[]) => startShopifyClaimMock(...args),
}));

const ensureShopTokenMock = vi.fn();
vi.mock('@/components/shopify/ensure-shop-token', () => ({
  ensureShopToken: (...args: unknown[]) => ensureShopTokenMock(...args),
}));
vi.mock('@/components/shopify/admin-settings', () => ({ ShopifyAdminSettings: () => null }));
vi.mock('@/components/shopify/store-chat-embedded', () => ({ StoreChatEmbedded: () => null }));

import { ShopifyAppShell } from './app-shell';

const claimExplanation = 'Opens grindctrl.cloud to sign in and manage full settings in your dashboard; Store Chat keeps working in Shopify admin either way.';

describe('ShopifyAppShell claim button', () => {
  beforeEach(() => {
    ensureShopTokenMock.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['en', claimExplanation],
    ['ar', 'يفتح grindctrl.cloud لتسجيل الدخول وإدارة الإعدادات الكاملة من لوحة تحكمك؛ وتستمر دردشة المتجر بالعمل داخل Shopify في كل الأحوال.'],
  ] as const)('explains the claim while idle in %s', async (locale, explanation) => {
    render(<ShopifyAppShell locale={locale} />);
    expect(screen.getByText(explanation)).toBeVisible();
    await screen.findByTestId('auto-claim-mounted');
  });

  it('shows "Already connected" when the store was already linked', async () => {
    startShopifyClaimMock.mockResolvedValue('already-linked');
    render(<ShopifyAppShell locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Claim this store' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Already connected');
    expect(screen.queryByText(claimExplanation)).not.toBeInTheDocument();
  });

  it('shows an error message when the claim attempt fails', async () => {
    startShopifyClaimMock.mockRejectedValue(new Error('network down'));
    render(<ShopifyAppShell locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Claim this store' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not connect');
    expect(screen.queryByText(claimExplanation)).not.toBeInTheDocument();
  });

  it('shows neither message after a successful navigation-bound claim', async () => {
    startShopifyClaimMock.mockResolvedValue('navigated');
    render(<ShopifyAppShell locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Claim this store' }));

    await waitFor(() => expect(startShopifyClaimMock).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables the button while the claim request is in flight', async () => {
    let resolveClaim: (outcome: string) => void = () => {};
    startShopifyClaimMock.mockReturnValue(
      new Promise((resolve) => {
        resolveClaim = resolve;
      }),
    );
    render(<ShopifyAppShell locale="en" />);

    const button = screen.getByRole('button', { name: 'Claim this store' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.queryByText(claimExplanation)).not.toBeInTheDocument();

    await act(async () => {
      resolveClaim('navigated');
    });
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.getByText(claimExplanation)).toBeVisible();
  });
});

/* Regression: AutoClaim's automatic top-level redirect used to be able to
   fire before EnsureShopToken's Admin-token write had finished, which could
   turn a merchant's first, legitimate claim attempt into a false "not you"
   error (app/claim/page.tsx needs that token to verify ownership). AutoClaim
   must not mount until the token bootstrap has settled -- success or
   failure, either way it's had its chance. */
describe('ShopifyAppShell claim/token bootstrap ordering', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not mount AutoClaim until ensureShopToken settles', async () => {
    let resolveToken: () => void = () => {};
    ensureShopTokenMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveToken = resolve;
      }),
    );

    render(<ShopifyAppShell locale="en" />);

    expect(screen.queryByTestId('auto-claim-mounted')).not.toBeInTheDocument();

    await act(async () => {
      resolveToken();
    });

    expect(await screen.findByTestId('auto-claim-mounted')).toBeInTheDocument();
  });

  it('still mounts AutoClaim after a token-bootstrap failure, not just success', async () => {
    ensureShopTokenMock.mockRejectedValue(new Error('token exchange failed'));

    render(<ShopifyAppShell locale="en" />);

    expect(await screen.findByTestId('auto-claim-mounted')).toBeInTheDocument();
  });
});
