import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The embedded admin page mounts one Mantine tree around the whole app shell,
   so the brand variables, font and direction are on every tab. */
const mocks = vi.hoisted(() => ({ clientId: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/shopify/embedded-entry', () => ({ resolveEmbeddedClientId: mocks.clientId }));
vi.mock('@/components/mantine/provider', () => ({
  MantineUiProvider: ({ dir, children }: { dir: string; children: React.ReactNode }) => (
    <div data-testid="mantine-provider" data-dir={dir}>
      {children}
    </div>
  ),
}));
vi.mock('@/components/shopify/app-shell', () => ({
  ShopifyAppShell: ({ locale }: { locale: string }) => <div data-testid="app-shell">{locale}</div>,
}));

import ShopifyAdminPage from './page';

function open(query: { locale?: string; id_token?: string } = {}, rest?: string[]) {
  return ShopifyAdminPage({ searchParams: Promise.resolve(query), params: Promise.resolve({ rest }) });
}

beforeEach(() => mocks.clientId.mockReset().mockReturnValue('client-id'));

describe('the embedded Shopify admin page', () => {
  it.each([
    ['en', 'ltr'],
    ['ar-EG', 'rtl'],
  ] as const)('puts the app shell inside the Mantine provider, in the merchant’s direction (%s)', async (locale, dir) => {
    render(await open({ locale }));
    const provider = screen.getByTestId('mantine-provider');
    expect(provider).toHaveAttribute('data-dir', dir);
    expect(provider).toContainElement(screen.getByTestId('app-shell'));
    expect(screen.getByRole('main')).toHaveAttribute('dir', dir);
    expect(provider).toContainElement(screen.getByRole('main'));
  });

  it('falls back to English for a language it does not have', async () => {
    render(await open({ locale: 'fr' }));
    expect(screen.getByTestId('app-shell')).toHaveTextContent('en');
  });

  it('hands App Bridge the client id and loads it as a plain script, before the app', async () => {
    const { container } = render(await open());
    // React hoists the <meta> into the document head; a sync <script> stays where it is.
    expect(document.querySelector('meta[name="shopify-api-key"]')).toHaveAttribute('content', 'client-id');
    const script = container.querySelector('script[src="https://cdn.shopify.com/shopifycloud/app-bridge.js"]');
    expect(script).not.toBeNull();
    expect(script).not.toHaveAttribute('async');
    expect(script).not.toHaveAttribute('defer');
  });

  it('asks to be opened from Shopify when no app matches, without mounting the app', async () => {
    mocks.clientId.mockReturnValue(null);
    render(await open());
    expect(screen.getByRole('alert')).toHaveTextContent('Open GRINDCTRL from the configured Shopify app.');
    expect(screen.queryByTestId('mantine-provider')).not.toBeInTheDocument();
  });
});
