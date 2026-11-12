import React from 'react';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Dead tokens must be rejected before sign-in; successful claims give
   merchants next steps before they choose to open the dashboard. */

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}));

const signOut = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@clerk/nextjs', () => ({ useClerk: () => ({ signOut }) }));

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

import { renderWithMantine as render } from '@/components/mantine/test-utils';
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
    expect(screen.queryByRole('link', { name: 'Go to dashboard' })).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /expired/i })).toBeInTheDocument();
    expect(requireDashboardUser).not.toHaveBeenCalled();
    expect(getShopOwnerEmail).not.toHaveBeenCalled();
    expect(ensureMessengerSite).not.toHaveBeenCalled();
  });

  it('treats a missing token the same as an invalid one', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue(null);

    const result = await ClaimPage({ searchParams: Promise.resolve({}) });
    render(result);
    expect(screen.queryByRole('link', { name: 'Go to dashboard' })).not.toBeInTheDocument();

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
    await ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) });

    expect(requireDashboardUser).toHaveBeenCalledWith('/claim?token=good-token');
  });

  it.each([
    ['en', "You're connected", 'Open Store setup to turn on Store Chat and Try-On and check what shoppers will see. Then open a product page on your store to check the chat and Try-On button.', 'Go to dashboard'],
    ['ar', 'متجرك متصل الآن', 'افتح إعداد المتجر لتشغيل محادثة المتجر والقياس الافتراضي ومعرفة ما سيظهر للمتسوقين. ثم افتح صفحة منتج في متجرك للتحقق من المحادثة وزر القياس.', 'الانتقال إلى لوحة التحكم'],
  ] as const)('adopts the store and renders next steps without redirecting in %s', async (locale, title, body, action) => {
    vi.mocked(getRequestLocale).mockResolvedValue(locale);
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(ensureMessengerSite).mockResolvedValue({ id: 'site-1' } as never);
    redirectMock.mockImplementation(() => { throw new Error('Unexpected redirect'); });

    const { container } = render(await ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) }));

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(body)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', '/dashboard/store');
    expect(container.querySelector('section')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(ensureMessengerSite).toHaveBeenCalledWith('user_1', 'demo.myshopify.com', 'demo.myshopify.com');
    expect(getShopOwnerEmail).toHaveBeenCalledWith('demo.myshopify.com');
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('renders "already connected" and does NOT redirect when the store belongs to another account', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(ensureMessengerSite).mockRejectedValue(new StoreOwnedByAnotherAccountError('demo.myshopify.com'));

    const result = await ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) });
    render(result);
    expect(screen.queryByRole('link', { name: 'Go to dashboard' })).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /already connected/i })).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('blocks the claim before adoption when the owner emails do not match', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(getShopOwnerEmail).mockResolvedValue('different@example.com');

    const result = await ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) });
    render(result);
    expect(screen.queryByRole('link', { name: 'Go to dashboard' })).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /couldn't verify/i })).toBeInTheDocument();
    expect(screen.getByText(/contact support/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /connect with a code/i })).toHaveAttribute(
      'href',
      '/dashboard/try-on',
    );
    expect(ensureMessengerSite).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('names the signed-in account on a mismatch and switches accounts back to the same claim link', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(getShopOwnerEmail).mockResolvedValue('different@example.com');
    signOut.mockResolvedValue(undefined);

    render(await ClaimPage({ searchParams: Promise.resolve({ token: 'good token' }) }));

    expect(screen.getByText(/signed in as owner@example\.com/)).toBeInTheDocument();
    // The store owner's address is the store's, never shown to this account.
    expect(screen.queryByText(/different@example\.com/)).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Use a different account' }).click();
    expect(signOut).toHaveBeenCalledWith({
      redirectUrl: '/sign-in?redirect_url=%2Fclaim%3Ftoken%3Dgood%2520token',
    });
  });

  it('fails closed with a retry-first message (not a hard mismatch) when the owner email cannot be checked yet', async () => {
    /* getShopOwnerEmail returning null means the Admin token isn't stored
       yet (plausible seconds after a fresh install, see
       components/shopify/ensure-shop-token.tsx), not necessarily a real
       email mismatch -- this must not be folded into the "not you" copy. */
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(getShopOwnerEmail).mockResolvedValue(null);

    const result = await ClaimPage({ searchParams: Promise.resolve({ token: 'good-token' }) });
    render(result);
    expect(screen.queryByRole('link', { name: 'Go to dashboard' })).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /still connecting/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute(
      'href',
      '/claim?token=good-token',
    );
    expect(screen.getByRole('link', { name: /connect with a code/i })).toHaveAttribute(
      'href',
      '/dashboard/try-on',
    );
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
    expect(screen.queryByRole('link', { name: 'Go to dashboard' })).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /couldn't verify/i })).toBeInTheDocument();
    expect(ensureMessengerSite).not.toHaveBeenCalled();
  });

  it('adopts the TOKEN\'s shop, ignoring a shop in the query string', async () => {
    vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' });
    vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
    vi.mocked(ensureMessengerSite).mockResolvedValue({ id: 'site-1' } as never);
    // Mirrors the mint-side test in route.test.ts: the shop that gets
    // adopted must be the one proven by the claim token, never one an
    // attacker can put in the URL — even though today's page doesn't read
    // searchParams.shop at all, this guards against that regressing.
    await ClaimPage({
      searchParams: Promise.resolve({ token: 'good', shop: 'evil.myshopify.com' }),
    });

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

it('m1: a taken store offers contact support', async () => {
  vi.mocked(getRequestLocale).mockResolvedValue('en');
  vi.mocked(verifyClaimToken).mockReturnValue({ shop: 'demo.myshopify.com' } as never);
  vi.mocked(requireDashboardUser).mockResolvedValue('user_1');
  vi.mocked(currentUser).mockResolvedValue({ primaryEmailAddress: { emailAddress: 'owner@example.com' }, emailAddresses: [] } as never);
  vi.mocked(getShopOwnerEmail).mockResolvedValue('owner@example.com');
  vi.mocked(ensureMessengerSite).mockRejectedValue(new StoreOwnedByAnotherAccountError('demo.myshopify.com'));
  render(await ClaimPage({ searchParams: Promise.resolve({ token: 'valid' }) }));
  expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'mailto:grindctrlnow@gmail.com');
});
