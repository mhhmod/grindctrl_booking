import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { pasteInstallCopy } from '@/lib/dashboard/paste-install-copy';
import type { PasteInstallStatus } from '@/lib/paste/status';
import type { PasteDomain } from '@/lib/paste/types';
import { PasteInstall, type PasteInstallActions } from './paste-install';

const domain = (over: Partial<PasteDomain> = {}): PasteDomain => ({
  id: 'd1', domain: 'shop.example', state: 'trusted', firstSeenAt: null, lastSeenAt: null,
  proof: { txtName: '_grindctrl.shop.example', txtValue: 'gc-proof', meta: { name: 'grindctrl-verification', content: 'gc-meta' } },
  ...over,
});

function status(over: Partial<PasteInstallStatus> = {}): PasteInstallStatus {
  return {
    siteId: 's1', tenantKey: 'site:s1', platform: 'website', connected: true, domains: [], chatLive: false,
    tryOnReady: false, tryOnReason: 'no_trusted_domain', plan: {} as PasteInstallStatus['plan'], mode: 'live',
    secretVersion: 1, rotationOverlapUntil: null, turnstileConfigured: true, ...over,
  };
}

function actions(initial: PasteInstallStatus | null): PasteInstallActions & { current: { value: PasteInstallStatus | null } } {
  const current = { value: initial };
  return {
    current,
    enable: vi.fn(async () => { current.value = status({ domains: [] }); return { ok: true as const, data: { tenantKey: 'site:s1' } }; }),
    addDomain: vi.fn(async (_site: string, name: string) => {
      const added = domain({ domain: name });
      current.value = status({ domains: [added] });
      return { ok: true as const, data: added };
    }),
    removeDomain: vi.fn(async () => ({ ok: true as const, data: null })),
    proveDns: vi.fn(async () => ({ ok: true as const, data: domain() })),
    proveMeta: vi.fn(async () => ({ ok: true as const, data: domain() })),
    rotate: vi.fn(async () => ({ ok: true as const, data: { version: 2, overlapUntil: new Date().toISOString() } })),
    snippet: vi.fn(async () => ({ ok: true as const, data: { platform: 'website' as const, snippet: '<script data-key="k"></script>', steps: [{ kind: 'save' as const }], contextEndpoint: '/api/try-on/paste-context' as const } })),
    status: vi.fn(async () => current.value ? { ok: true as const, data: current.value } : { ok: false as const, code: 'not_found' as const }),
  };
}

const copy = pasteInstallCopy('en');
const ago = (m: number) => `${m} min ago`;

describe('paste install journey', () => {
  it('connects a website, adds its address, then shows the code and waits for the store', async () => {
    const a = actions(null);
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={<p>woo guide</p>} />);

    fireEvent.click(screen.getByRole('radio', { name: /Any other website/ }));
    await waitFor(() => expect(a.enable).toHaveBeenCalledWith('s1', 'website'));

    fireEvent.change(screen.getByLabelText(copy.domainLabel), { target: { value: 'shop.example' } });
    fireEvent.click(screen.getByRole('button', { name: copy.addDomain }));
    await waitFor(() => expect(a.addDomain).toHaveBeenCalledWith('s1', 'shop.example'));

    expect(await screen.findByText('<script data-key="k"></script>')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.copyCode })).toBeInTheDocument();
    expect(screen.getByText(copy.domainState.waiting)).toBeInTheDocument();
    expect(screen.getByText(copy.waiting)).toBeInTheDocument();
  });

  it('shows live chat and the Try-On reason once the store has been seen', async () => {
    const seen = new Date().toISOString();
    const a = actions(status({ domains: [domain({ lastSeenAt: seen })], chatLive: true, tryOnReady: false, tryOnReason: 'preview' }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);

    expect(await screen.findByText(copy.chatLive('shop.example'))).toBeInTheDocument();
    expect(screen.getByText(copy.tryOnReason('preview'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.goTryOnSetup })).toHaveAttribute('href', '/dashboard/try-on/setup');
  });

  it('asks a Shopify store for its myshopify address and trusts it', async () => {
    const a = actions(null);
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    fireEvent.click(screen.getByRole('radio', { name: /Shopify/ }));
    fireEvent.change(screen.getByLabelText(copy.shopifyLabel), { target: { value: 'my-store' } });
    fireEvent.click(screen.getByRole('button', { name: copy.shopifyContinue }));
    await waitFor(() => expect(a.enable).toHaveBeenCalledWith('s1', 'shopify', 'my-store.myshopify.com'));
    expect(a.addDomain).toHaveBeenCalledWith('s1', 'my-store.myshopify.com');
  });

  it('keeps WooCommerce on its plugin guide and offers proof for a claimed address', async () => {
    const a = actions(status({ domains: [domain({ state: 'claimed' })] }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={<p>woo guide</p>} />);
    fireEvent.click(await screen.findByText(copy.errors.proof_required));
    expect(screen.getByText('<meta name="grindctrl-verification" content="gc-meta">')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /WooCommerce/ }));
    expect(screen.getByText('woo guide')).toBeInTheDocument();
    expect(a.enable).not.toHaveBeenCalled();
  });

  it('explains a failed action in plain words', async () => {
    const a = actions(status());
    a.addDomain = vi.fn(async () => ({ ok: false as const, code: 'invalid_domain' as const }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    fireEvent.change(await screen.findByLabelText(copy.domainLabel), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: copy.addDomain }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.invalid_domain);
  });
});
