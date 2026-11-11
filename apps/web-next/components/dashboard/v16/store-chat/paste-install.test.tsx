import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { pasteInstallCopy } from '@/lib/dashboard/paste-install-copy';
import { pasteRetentionDate } from '@/lib/dashboard/paste-retention-date';
import type { PasteInstallStatus } from '@/lib/paste/status';
import type { PasteDomain } from '@/lib/paste/types';
import { PasteInstall, type PasteInstallActions } from './paste-install';

/** A trusted address our server has not confirmed the code on yet. */
const domain = (over: Partial<PasteDomain> = {}): PasteDomain => ({
  id: 'd1', domain: 'shop.example', state: 'trusted', domainVerified: false, verifiedAt: null,
  verificationReason: 'awaiting_code', check: null, firstSeenAt: null, lastSeenAt: null,
  proof: { txtName: '_grindctrl.shop.example', txtValue: 'gc-proof', meta: { name: 'grindctrl-verification', content: 'gc-meta' } },
  ...over,
});

function status(over: Partial<PasteInstallStatus> = {}): PasteInstallStatus {
  return {
    siteId: 's1', tenantKey: 'site:s1', platform: 'website', shopDomain: null, shopProof: null, shopProvenAt: null,
    shopCheck: null, shopFirstSeenAt: null, shopLastSeenAt: null, connected: true, trusted: true, connectionReason: null, domains: [], seen: false, seenHost: null, chatLive: false,
    tryOnReady: false, tryOnReason: 'no_trusted_domain', showButton: true,
    codeVersion: null, codeVersionSeenAt: null, codeOutdated: false, plan: {} as PasteInstallStatus['plan'], mode: 'live',
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
    snippet: vi.fn(async () => ({ ok: true as const, data: { platform: 'website' as const, codeVersion: null, snippet: '<script data-key="k"></script>', steps: [{ kind: 'save' as const }], contextEndpoint: '/api/try-on/paste-context' as const } })),
    status: vi.fn(async () => current.value ? { ok: true as const, data: current.value } : { ok: false as const, code: 'not_found' as const }),
    proveShop: vi.fn(async () => ({ ok: true as const, data: { shopProof: 'pending' as const, shopProvenAt: null, outcome: 'password_required' as const, checkedAt: null, retryAfterSeconds: null } })),
    checkDomain: vi.fn(async () => ({ ok: true as const, data: { domain: domain(), outcome: 'rate_limited' as const, retryAfterSeconds: 42 } })),
  };
}

const verified = (over: Partial<PasteDomain> = {}) => domain({
  domainVerified: true, verifiedAt: new Date().toISOString(), verificationReason: null, ...over,
});

const copy = pasteInstallCopy('en');
const ago = (m: number) => `${m} min ago`;

describe('paste install journey', () => {
  it.each(['en', 'ar'] as const)('shows the disconnected deadline in %s until reconnect', async locale => {
    const copy = pasteInstallCopy(locale), deadline = '2026-12-12T12:00:00Z';
    const a = actions(status({ connected: false, trusted: false, redactAfter: deadline }));
    renderWithMantine(<PasteInstall siteId="s1" locale={locale} copy={copy} ago={ago} actions={a} woocommerce={null} />);
    const notice = copy.deletionDate(pasteRetentionDate(deadline, locale)!);
    expect(await screen.findByText(notice)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(copy.platforms.website.name) }));
    await waitFor(() => expect(screen.queryByText(notice)).not.toBeInTheDocument());
  });
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

  it('says plainly when it is installed, folds the steps, and points at the store', async () => {
    const seen = new Date().toISOString();
    const a = actions(status({ domains: [verified({ lastSeenAt: seen })], seen: true, seenHost: 'shop.example', chatLive: true,
      tryOnReady: true, tryOnReason: null, plan: { totalCreditsRemaining: 15 } as PasteInstallStatus['plan'] }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);

    expect(await screen.findByText(copy.installedTitle('shop.example'))).toBeInTheDocument();
    expect(screen.getByText(copy.chatShown)).toBeInTheDocument();
    expect(screen.getByText(copy.tryOnOn(15))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.seeOnStore })).toHaveAttribute('href', 'https://shop.example');
    expect(screen.getByRole('link', { name: copy.goTryOnSetup })).toHaveAttribute('href', '/dashboard/try-on');
    expect(screen.queryByText(copy.steps.code)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: copy.showSteps }));
    expect(screen.getByText(copy.steps.code)).toBeInTheDocument();
  });

  it('keeps step four installed after a quiet two hours', async () => {
    const lastSeenAt = new Date(Date.now() - 120 * 60_000).toISOString();
    const a = actions(status({ domains: [verified({ lastSeenAt })], seen: false, tryOnReady: true, tryOnReason: null }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    expect(await screen.findByText(copy.installedTitle('shop.example'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.showSteps }));
    expect(screen.getByText(copy.domainState.live('120 min ago'))).toBeInTheDocument();
    expect(screen.queryByText(copy.waiting)).not.toBeInTheDocument();
  });

  it('shows step four waiting when the code has never been seen', async () => {
    const a = actions(status({ domains: [verified()], seen: false }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    expect(await screen.findByText(copy.waiting)).toBeInTheDocument();
    expect(screen.queryByText(copy.installedTitle('shop.example'))).not.toBeInTheDocument();
  });

  it('names the moment the free looks are being turned on instead of a vague wait', async () => {
    const a = actions(status({ domains: [verified({ lastSeenAt: new Date().toISOString() })], seen: true, seenHost: 'shop.example',
      chatLive: false, tryOnReady: false, tryOnReason: 'not_installed' }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    expect(await screen.findByText(copy.tryOnReason('not_installed'))).toBeInTheDocument();
    expect(screen.getByText(copy.chatPreview)).toBeInTheDocument();
  });

  it('asks a Shopify store for its myshopify address and trusts it', async () => {
    const a = actions(null);
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    fireEvent.click(screen.getByRole('radio', { name: /Shopify/ }));
    fireEvent.change(screen.getByLabelText(copy.shopifyLabel), { target: { value: 'my-store' } });
    fireEvent.click(screen.getByRole('button', { name: copy.shopifyContinue }));
    await waitFor(() => expect(a.enable).toHaveBeenCalledWith('s1', 'shopify', 'my-store.myshopify.com'));
    /* The signed shop is trusted through its connection, never as an address. */
    expect(a.addDomain).not.toHaveBeenCalled();
  });

  it('keeps WooCommerce on its plugin guide and offers proof for a claimed address', async () => {
    const a = actions(status({ domains: [domain({ state: 'claimed', verificationReason: 'held_elsewhere' })] }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={<p>woo guide</p>} />);
    /* Pasting the code is the first way to move it here; DNS is the fallback. */
    expect(await screen.findByText(copy.domainReason('held_elsewhere'))).toBeInTheDocument();
    expect(await screen.findByText('<script data-key="k"></script>')).toBeInTheDocument();
    fireEvent.click(screen.getByText(copy.otherProof));
    expect(screen.getByText('<meta name="grindctrl-verification" content="gc-meta">')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /WooCommerce/ }));
    expect(screen.getByText('woo guide')).toBeInTheDocument();
    expect(a.enable).not.toHaveBeenCalled();
  });

  it('says an address is confirmed by itself, lets the owner check now, and names a wait', async () => {
    const a = actions(status({ domains: [domain()], tryOnReason: 'domain_unverified' }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    expect(await screen.findByText(copy.domainReason('awaiting_code'))).toBeInTheDocument();
    expect(screen.getByText(copy.domainState.waiting)).toBeInTheDocument();
    /* No DNS step in the normal path. */
    expect(screen.queryByText(copy.otherProof)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.checkStore }));
    await waitFor(() => expect(a.checkDomain).toHaveBeenCalledWith('s1', 'd1'));
    expect(await screen.findByText(copy.shopCheck('rate_limited', 42))).toBeInTheDocument();
  });

  it('shows a confirmed address as found, and offers another way only when our check cannot open the site', async () => {
    const a = actions(status({ domains: [verified(), domain({ id: 'd2', domain: 'blocked.example', verificationReason: 'unreachable',
      check: { outcome: 'unreachable', checkedAt: new Date().toISOString() } })] }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    expect(await screen.findByText(copy.domainState.verified)).toBeInTheDocument();
    expect(screen.getByText(copy.domainReason('unreachable'))).toBeInTheDocument();
    expect(screen.getAllByText(copy.otherProof)).toHaveLength(1);
  });

  it('explains a failed action in plain words', async () => {
    const a = actions(status());
    a.addDomain = vi.fn(async () => ({ ok: false as const, code: 'invalid_domain' as const }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    fireEvent.change(await screen.findByLabelText(copy.domainLabel), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: copy.addDomain }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.invalid_domain);
  });
  it('asks a pending Shopify store to check its storefront, with the password only when needed', async () => {
    const a = actions(status({ platform: 'shopify', shopDomain: 'my-store.myshopify.com', shopProof: 'pending', trusted: false, connectionReason: 'shop_proof_pending' }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    expect(await screen.findByText(copy.shopCheckTitle)).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.passwordLabel)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: copy.checkStore }));
    await waitFor(() => expect(a.proveShop).toHaveBeenCalledWith('s1', undefined));
    expect(await screen.findByText(copy.shopCheck('password_required', null))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(copy.passwordLabel), { target: { value: 'opensesame' } });
    fireEvent.click(screen.getByRole('button', { name: copy.checkStore }));
    await waitFor(() => expect(a.proveShop).toHaveBeenLastCalledWith('s1', 'opensesame'));
    /* The password is cleared after use, never kept in the field. */
    await waitFor(() => expect(screen.getByLabelText(copy.passwordLabel)).toHaveValue(''));
  });

  it('tells a store run by the Shopify app to use the app', async () => {
    const a = actions(status({ platform: 'shopify', shopDomain: 'my-store.myshopify.com', trusted: false, connectionReason: 'shopify_app_installed' }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    expect(await screen.findByText(copy.appHeld)).toBeInTheDocument();
    expect(screen.queryByText(copy.steps.code)).not.toBeInTheDocument();
  });
  it('asks a store on the old code to copy the updated one', async () => {
    const a = actions(status({ domains: [verified({ lastSeenAt: new Date().toISOString() })], seen: true, seenHost: 'shop.example',
      chatLive: true, tryOnReady: true, tryOnReason: null, codeOutdated: true, plan: { totalCreditsRemaining: 15 } as PasteInstallStatus['plan'] }));
    renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
    expect(await screen.findByText(copy.codeOutdated)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.codeOutdatedAction }));
    expect(screen.getByText(copy.steps.code)).toBeInTheDocument();
  });
});
