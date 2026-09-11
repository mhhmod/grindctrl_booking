// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* The "Claim this store" button used to swallow every outcome silently
   (already-linked, error, and even success all looked identical: nothing
   visibly happened). This covers the feedback states it now shows. */

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

const startShopifyClaimMock = vi.fn();
vi.mock('@/components/shopify/auto-claim', () => ({
  AutoClaim: () => null,
  startShopifyClaim: (...args: unknown[]) => startShopifyClaimMock(...args),
}));

vi.mock('@/components/shopify/ensure-shop-token', () => ({ EnsureShopToken: () => null }));
vi.mock('@/components/shopify/admin-settings', () => ({ ShopifyAdminSettings: () => null }));
vi.mock('@/components/shopify/store-chat-embedded', () => ({ StoreChatEmbedded: () => null }));

import { ShopifyAppShell } from './app-shell';

describe('ShopifyAppShell claim button', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Already connected" when the store was already linked', async () => {
    startShopifyClaimMock.mockResolvedValue('already-linked');
    render(<ShopifyAppShell locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Claim this store' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Already connected');
  });

  it('shows an error message when the claim attempt fails', async () => {
    startShopifyClaimMock.mockRejectedValue(new Error('network down'));
    render(<ShopifyAppShell locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Claim this store' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not connect');
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

    await act(async () => {
      resolveClaim('navigated');
    });
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
