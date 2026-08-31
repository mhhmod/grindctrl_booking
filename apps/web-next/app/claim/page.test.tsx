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

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
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

vi.mock('@/lib/shopify/shop-owner', () => ({
  getShopOwnerEmail: vi.fn(),
}));

vi.mock('@/lib/messenger/provisioning', () => ({
  ensureMessengerSite: vi.fn(),
}));

import ClaimPage from '@/app/claim/page';
import { currentUser } from '@clerk/nextjs/server';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { verifyClaimToken } from '@/lib/shopify/claim-token';
import { getShopOwnerEmail } from '@/lib/shopify/shop-owner';
import { ensureMessengerSite } from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';

describe('ClaimPage', () => {
  beforeEach(() => {
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    vi.mocked(currentUser).mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'owner@example.com' },
      emailAddresses: [],
    } as never);
    vi.mocked(getShopOwnerEmail).mockResolvedValue('OWNER@example.com');
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
    expect(getShopOwnerEmail).not.toHaveBeenCalled();
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

  it('adopts the store when owner emails match case-insensitively and redirects', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(ensureMessengerSite).mockResolvedValue({ id: 'site-1' } as never);
    redirectMock.mockImplementation(() => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT' });
    });

    // The happy path end to end: adopts with the claimed shop, then hands
    // off to /dashboard/messenger. This does NOT pin redirect() being
    // outside the try — the catch below rethrows any non-ownership error
    // regardless of where redirect() sits, so that placement can't be
    // told apart by a black-box test; "does not swallow an unrelated
    // error" below already covers the rethrow behaviour this exercises.
    await expect(
      ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(ensureMessengerSite).toHaveBeenCalledWith('user_1', 'demo.myshopify.com', 'demo.myshopify.com');
    expect(getShopOwnerEmail).toHaveBeenCalledWith('demo.myshopify.com');
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

  it('blocks the claim before adoption when the owner emails do not match', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(getShopOwnerEmail).mockResolvedValue('different@example.com');

    const result = await ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) });
    render(result);

    expect(screen.getByRole('heading', { name: /couldn't verify/i })).toBeInTheDocument();
    expect(screen.getByText(/contact support/i)).toBeInTheDocument();
    expect(ensureMessengerSite).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('fails closed before adoption when Shopify cannot verify the owner email', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(getShopOwnerEmail).mockResolvedValue(null);

    const result = await ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) });
    render(result);

    expect(screen.getByRole('heading', { name: /couldn't verify/i })).toBeInTheDocument();
    expect(ensureMessengerSite).not.toHaveBeenCalled();
  });

  it('fails closed before adoption when the Clerk account has no email', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(currentUser).mockResolvedValue({
      primaryEmailAddress: null,
      emailAddresses: [],
    } as never);

    const result = await ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) });
    render(result);

    expect(screen.getByRole('heading', { name: /couldn't verify/i })).toBeInTheDocument();
    expect(ensureMessengerSite).not.toHaveBeenCalled();
  });

  it('adopts the TOKEN\'s shop, ignoring a shop in the query string', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(ensureMessengerSite).mockResolvedValue({ id: 'site-1' } as never);
    redirectMock.mockImplementation(() => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT' });
    });

    // Mirrors the mint-side test in route.test.ts: the shop that gets
    // adopted must be the one proven by the claim token, never one an
    // attacker can put in the URL — even though today's page doesn't read
    // searchParams.shop at all, this guards against that regressing.
    await expect(
      ClaimPage({
        searchParams: Promise.resolve({ token: 'good', shop: 'evil.myshopify.com' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(ensureMessengerSite).toHaveBeenCalledWith('user_1', 'demo.myshopify.com', 'demo.myshopify.com');
    expect(ensureMessengerSite).not.toHaveBeenCalledWith('user_1', 'evil.myshopify.com', expect.anything());
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
