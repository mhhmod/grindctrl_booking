import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* /claim redeems a claim token minted by GET /api/shopify/claim/start (see
   its route.test.ts for the mint side). The order of operations matters:
   a dead/forged token must be rejected BEFORE sending anyone through sign-in
   — see the "expired" tests below — and a successful redemption must
   redirect with nothing left to swallow the redirect's control-flow throw
   (see the "does not swallow" test). */

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock('@/lib/auth/dashboard', () => ({
  requireDashboardUser: vi.fn(),
}));

vi.mock('@/lib/auth/locale', () => ({
  getRequestLocale: vi.fn(),
}));

vi.mock('@/lib/shopify/claim-token', () => ({
  verifyClaimToken: vi.fn(),
}));

vi.mock('@/lib/messenger/provisioning', () => ({
  ensureMessengerSite: vi.fn(),
}));

import ClaimPage from '@/app/claim/page';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { verifyClaimToken } from '@/lib/shopify/claim-token';
import { ensureMessengerSite } from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';

describe('ClaimPage', () => {
  beforeEach(() => {
    vi.mocked(getRequestLocale).mockResolvedValue('en');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('rejects an invalid/expired token WITHOUT requiring sign-in first', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue(null);

    const result = await ClaimPage({ searchParams: Promise.resolve({ token: 'dead' }) });
    render(result);

    expect(screen.getByRole('heading', { name: /expired/i })).toBeInTheDocument();
    expect(requireDashboardUser).not.toHaveBeenCalled();
    expect(ensureMessengerSite).not.toHaveBeenCalled();
  });

  it('treats a missing token the same as an invalid one', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue(null);

    const result = await ClaimPage({ searchParams: Promise.resolve({}) });
    render(result);

    expect(screen.getByRole('heading', { name: /expired/i })).toBeInTheDocument();
    expect(requireDashboardUser).not.toHaveBeenCalled();
  });

  it('renders the expired page in Arabic with rtl dir when that is the request locale', async () => {
    vi.mocked(getRequestLocale).mockResolvedValue('ar');
    vi.mocked(verifyClaimToken).mockReturnValue(null);

    const result = await ClaimPage({ searchParams: Promise.resolve({ token: 'dead' }) });
    const { container } = render(result);

    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
    expect(container.querySelector('[lang="ar"]')).toBeTruthy();
  });

  it('sends the token through sign-in so it survives the redirect', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(ensureMessengerSite).mockResolvedValue({ id: 'site-1' } as never);
    redirectMock.mockImplementation(() => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT' });
    });

    await expect(
      ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(requireDashboardUser).toHaveBeenCalledWith('/claim?token=good-token');
  });

  it('adopts the store and redirects to the dashboard on success — the redirect is not swallowed', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(ensureMessengerSite).mockResolvedValue({ id: 'site-1' } as never);
    redirectMock.mockImplementation(() => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT' });
    });

    // If redirect() were wrapped in the same try as ensureMessengerSite and
    // the catch didn't rethrow, this control-flow throw would be swallowed
    // and the promise below would resolve instead of reject.
    await expect(
      ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(ensureMessengerSite).toHaveBeenCalledWith('user_1', 'demo.myshopify.com', 'demo.myshopify.com');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/messenger');
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it('renders "already connected" and does NOT redirect when the store belongs to another account', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(ensureMessengerSite).mockRejectedValue(new StoreOwnedByAnotherAccountError('demo.myshopify.com'));

    const result = await ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) });
    render(result);

    expect(screen.getByRole('heading', { name: /already connected/i })).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('does not swallow an unrelated error as "already connected"', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(ensureMessengerSite).mockRejectedValue(new Error('db down'));

    await expect(
      ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) }),
    ).rejects.toThrow('db down');

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
