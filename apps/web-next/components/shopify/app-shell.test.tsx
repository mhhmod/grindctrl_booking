// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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
vi.mock('@/components/shopify/admin-settings', () => ({ ShopifyAdminSettings: () => <div data-testid="try-on-page" /> }));
vi.mock('@/components/shopify/store-chat-embedded', () => ({ StoreChatEmbedded: () => <div data-testid="store-chat-page" /> }));
vi.mock('@/components/shopify/plans', () => ({
  ShopifyPlans: ({ locale, appPricing }: { locale: string; appPricing: { distribution: string } | null }) => (
    <div data-testid="plans-page">{locale}:{appPricing?.distribution ?? 'unavailable'}</div>
  ),
}));

import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { ShopifyAppShell } from './app-shell';

const claimExplanation = 'Opens grindctrl.cloud to sign in and manage full settings in your dashboard; Store Chat keeps working in Shopify admin either way.';

describe('ShopifyAppShell claim button', () => {
  beforeEach(() => {
    ensureShopTokenMock.mockResolvedValue(undefined);
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
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

  it.each(['en', 'ar'] as const)('names the configured public host in %s', async (locale) => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://staging.grindctrl.cloud:8443/app');
    render(<ShopifyAppShell locale={locale} />);

    expect(screen.getByText(/staging\.grindctrl\.cloud:8443/)).toBeVisible();
    expect(screen.queryByText(/https:\/\/staging|\/app/)).not.toBeInTheDocument();
    await screen.findByTestId('auto-claim-mounted');
  });

  it('falls back to the production host if the configured URL is invalid', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'invalid-url');
    render(<ShopifyAppShell locale="en" />);

    expect(screen.getByText(claimExplanation)).toBeVisible();
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

  it.each([['en', 'Plans'], ['ar', 'الباقات']] as const)('exposes Plans after authoritative bootstrap settles in %s', async (locale, label) => {
    let resolveBootstrap: (value: unknown) => void = () => {};
    ensureShopTokenMock.mockReturnValue(new Promise((resolve) => { resolveBootstrap = resolve; }));
    render(<ShopifyAppShell locale={locale} />);
    fireEvent.click(screen.getByRole('tab', { name: label }));
    expect(screen.queryByTestId('plans-page')).not.toBeInTheDocument();
    await act(async () => {
      resolveBootstrap({ ok: true, appClientId: 'public-app', appPricing: { distribution: 'public', pricingPlansUrl: null, plans: [] } });
    });
    expect(await screen.findByTestId('plans-page')).toHaveTextContent(`${locale}:public`);
  });
});

/* Every tab sits inside the one Mantine tree the page mounts, so each is a
   Mantine tab with its own panel, not only Plans. */
describe('ShopifyAppShell tabs', () => {
  beforeEach(() => {
    ensureShopTokenMock.mockResolvedValue({ ok: true, appClientId: 'public-app', appPricing: { distribution: 'public', pricingPlansUrl: null, plans: [] } });
  });
  afterEach(() => vi.clearAllMocks());

  it.each([
    ['en', ['Try-On', 'Store Chat', 'Plans']],
    ['ar', ['التجربة الافتراضية', 'دردشة المتجر', 'الباقات']],
  ] as const)('opens each section in its own panel in %s, starting on Try-On', async (locale, names) => {
    render(<ShopifyAppShell locale={locale} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(names);
    expect(await screen.findByTestId('try-on-page')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: names[0] })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: names[1] }));
    expect(await screen.findByTestId('store-chat-page')).toBeInTheDocument();
    expect(screen.queryByTestId('try-on-page')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: names[2] }));
    expect(await screen.findByTestId('plans-page')).toHaveTextContent(`${locale}:public`);
    expect(screen.getByRole('tabpanel')).toContainElement(screen.getByTestId('plans-page'));
  });

  it('keeps the theme switch a labelled 44px control', () => {
    render(<ShopifyAppShell locale="en" />);
    expect(screen.getByRole('button', { name: 'Switch between light and dark' })).toBeInTheDocument();
  });
});
