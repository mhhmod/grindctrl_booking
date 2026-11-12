import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { pasteInstallCopy } from '@/lib/dashboard/paste-install-copy';
import { pasteRetentionDate } from '@/lib/dashboard/paste-retention-date';
import type { PasteInstallStatus } from '@/lib/paste/status';
import type { PasteDomain } from '@/lib/paste/types';
import { PasteInstall, type PasteInstallActions } from './paste-install';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

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

  describe('a pending Shopify store, after "Check my store"', () => {
    const shopify = (over: Partial<PasteInstallStatus> = {}) => status({ platform: 'shopify', shopDomain: 'my-store.myshopify.com', shopProof: 'pending',
      trusted: false, connectionReason: 'shop_proof_pending', tryOnReason: 'shop_proof_pending', ...over });
    const found = { shopProof: 'pending' as const, shopProvenAt: null, outcome: 'awaiting_visit' as const, checkedAt: new Date().toISOString(),
      retryAfterSeconds: null, storefront: { productUrl: 'https://my-store.myshopify.com/products/linen-dress', passwordPage: false } };

    it('names the next action, a product page, and links straight to one', async () => {
      const a = actions(shopify());
      a.proveShop = vi.fn(async () => ({ ok: true as const, data: found }));
      renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
      fireEvent.click(await screen.findByRole('button', { name: copy.checkStore }));
      expect(await screen.findByText(copy.shopCheck('awaiting_visit', null))).toBeInTheDocument();
      expect(copy.shopCheck('awaiting_visit', null)).toMatch(/product page.*Store Chat and the Try-On button/);
      const links = screen.getAllByRole('link', { name: copy.openProductPage });
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute('href', 'https://my-store.myshopify.com/products/linen-dress');
      expect(links[0]).toHaveAttribute('target', '_blank');
      expect(screen.getByText(copy.waitingHintShopify)).toBeInTheDocument();
      expect(screen.queryByText(copy.passwordPageNote)).not.toBeInTheDocument();
    });

    it('falls back to the store\'s products, not its home or password page, when no product page is known (M2)', async () => {
      const a = actions(shopify({ shopCheck: { outcome: 'awaiting_visit', checkedAt: new Date().toISOString(), retryAfterSeconds: null } }));
      renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
      expect(await screen.findByText(copy.shopCheck('awaiting_visit', null))).toBeInTheDocument();
      expect(screen.getByRole('link', { name: copy.openProducts })).toHaveAttribute('href', 'https://my-store.myshopify.com/collections/all');
      expect(copy.pasteSteps({ kind: 'visit', target: 'product_page' })).toBe('Open a product page on your store.');
      expect(pasteInstallCopy('ar').pasteSteps({ kind: 'visit', target: 'product_page' })).not.toMatch(/أي/);
    });

    it('says the check reads the live theme and links to it when the code is not found (B1)', async () => {
      const a = actions(shopify());
      a.proveShop = vi.fn(async () => ({ ok: true as const, data: { ...found, outcome: 'not_found' as const, storefront: undefined } }));
      renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
      fireEvent.click(await screen.findByRole('button', { name: copy.checkStore }));
      expect(await screen.findByText(copy.shopCheck('not_found', null))).toHaveTextContent(/live theme.*isn’t published/);
      const link = screen.getByRole('link', { name: copy.openLiveTheme });
      expect(link).toHaveAttribute('href', 'https://my-store.myshopify.com/admin/themes/current/editor');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('says when the check added the store\'s own domain (B2)', async () => {
      const a = actions(shopify());
      a.proveShop = vi.fn(async () => ({ ok: true as const, data: { ...found,
        storefront: { productUrl: 'https://www.brand.com/products/dress', passwordPage: false, primaryHost: 'www.brand.com', addedDomain: 'brand.com' } } }));
      renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
      fireEvent.click(await screen.findByRole('button', { name: copy.checkStore }));
      expect(await screen.findByText(copy.primaryDomainAdded('brand.com'))).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: copy.openProductPage })[0]).toHaveAttribute('href', 'https://www.brand.com/products/dress');
    });

    it('says a password-protected store needs its password once and is hidden from shoppers until the page is removed', async () => {
      const a = actions(shopify({ shopCheck: { outcome: 'password_required', checkedAt: new Date().toISOString(), retryAfterSeconds: null } }));
      renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
      expect(await screen.findByText(copy.shopCheck('password_required', null))).toHaveTextContent(/password once/);
      expect(screen.getByText(copy.passwordPageNote)).toHaveTextContent('Online Store, then Preferences');
      expect(screen.getByLabelText(copy.passwordLabel)).toBeInTheDocument();
      // Found behind the password: the note stays with the next step.
      a.proveShop = vi.fn(async () => ({ ok: true as const, data: { ...found, storefront: { productUrl: null, passwordPage: true } } }));
      fireEvent.change(screen.getByLabelText(copy.passwordLabel), { target: { value: 'opensesame' } });
      fireEvent.click(screen.getByRole('button', { name: copy.checkStore }));
      expect(await screen.findByText(copy.shopCheck('awaiting_visit', null))).toBeInTheDocument();
      expect(screen.getByText(copy.passwordPageNote)).toBeInTheDocument();
      expect(screen.queryByLabelText(copy.passwordLabel)).not.toBeInTheDocument();
    });

    it('turns into the success state by itself when the visit proves the store, then stops polling', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      router.refresh.mockClear();
      try {
        const a = actions(shopify({ shopCheck: { outcome: 'awaiting_visit', checkedAt: new Date().toISOString(), retryAfterSeconds: null } }));
        renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
        expect(await screen.findByText(copy.shopCheck('awaiting_visit', null))).toBeInTheDocument();
        // The product page visit proved the shop (no Store Chat signal needed yet).
        a.current.value = shopify({ shopProof: 'proven', shopProvenAt: new Date().toISOString(), trusted: true, connectionReason: null,
          tryOnReady: true, tryOnReason: null, shopCheck: { outcome: 'proven', checkedAt: new Date().toISOString(), retryAfterSeconds: null } });
        await vi.advanceTimersByTimeAsync(5000);
        expect(await screen.findByText(copy.installedTitle('my-store.myshopify.com'))).toBeInTheDocument();
        expect(screen.getByRole('link', { name: copy.seeOnStore })).toHaveAttribute('href', 'https://my-store.myshopify.com/collections/all');
        expect(screen.queryByText(copy.shopCheckTitle)).not.toBeInTheDocument();
        // M4: the server-drawn rest of the page (header, switches, Store check) reads again once.
        await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
        const reads = vi.mocked(a.status).mock.calls.length;
        await vi.advanceTimersByTimeAsync(15_000);
        expect(vi.mocked(a.status).mock.calls.length).toBe(reads);
        expect(router.refresh).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('using a different store (B5)', () => {
    const pendingShop = () => status({ platform: 'shopify', shopDomain: 'typo-store.myshopify.com', shopProof: 'pending', trusted: false,
      connectionReason: 'shop_proof_pending', tryOnReason: 'shop_proof_pending' });

    it('undoes a wrong Shopify address after a confirmation, then asks for the right one', async () => {
      router.refresh.mockClear();
      const a = actions(pendingShop());
      a.disconnect = vi.fn(async () => { a.current.value = status({ connected: false, trusted: false, platform: null, connectionReason: 'paste_not_connected' }); return { ok: true as const, data: null }; });
      renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
      expect(await screen.findByText('typo-store.myshopify.com')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: copy.leaveAction }));
      expect(screen.getByText(copy.leaveBody('typo-store.myshopify.com'))).toBeInTheDocument();
      expect(a.disconnect).not.toHaveBeenCalled();
      // Cancel keeps everything.
      fireEvent.click(screen.getByRole('button', { name: copy.cancel }));
      expect(screen.queryByText(copy.leaveBody('typo-store.myshopify.com'))).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: copy.leaveAction }));
      fireEvent.click(screen.getByRole('button', { name: copy.leaveConfirm }));
      await waitFor(() => expect(a.disconnect).toHaveBeenCalledExactlyOnceWith('s1'));
      expect(await screen.findByText(copy.leaveDone)).toBeInTheDocument();
      expect(screen.getByLabelText(copy.shopifyLabel)).toBeInTheDocument();
      expect(screen.queryByText('<script data-key="k"></script>')).not.toBeInTheDocument();
      expect(router.refresh).toHaveBeenCalled();
    });

    it.each(['en', 'ar'] as const)('disconnects, shows the removal date and enables another shop in %s', async locale => {
      const copy = pasteInstallCopy(locale), deadline = '2026-12-12T12:00:00Z';
      const a = actions(pendingShop());
      a.disconnect = vi.fn(async () => {
        a.current.value = status({ connected: false, trusted: false, platform: 'shopify', shopDomain: 'typo-store.myshopify.com',
          connectionReason: 'paste_not_connected', tryOnReason: 'paste_not_connected', redactAfter: deadline });
        return { ok: true as const, data: null };
      });
      a.enable = vi.fn(async (_id, platform, shop) => {
        a.current.value = status({ platform, shopDomain: shop ?? null, connected: true, trusted: false,
          shopProof: 'pending', connectionReason: 'shop_proof_pending', tryOnReason: 'shop_proof_pending', redactAfter: null });
        return { ok: true as const, data: { tenantKey: 'site:s1' } };
      });
      renderWithMantine(<PasteInstall siteId="s1" locale={locale} copy={copy} ago={ago} actions={a} woocommerce={null} />);
      fireEvent.click(await screen.findByRole('button', { name: copy.leaveAction }));
      expect(screen.getByText(copy.disconnectRetention)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: copy.leaveConfirm }));
      const notice = copy.deletionDate(pasteRetentionDate(deadline, locale)!);
      expect(await screen.findByText(notice)).toBeInTheDocument();
      expect(screen.getByLabelText(copy.shopifyLabel)).toBeEnabled();
      expect(screen.getByRole('button', { name: copy.shopifyContinue })).toBeDisabled();
      fireEvent.change(screen.getByLabelText(copy.shopifyLabel), { target: { value: 'another-store' } });
      expect(screen.getByRole('button', { name: copy.shopifyContinue })).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: copy.shopifyContinue }));
      await waitFor(() => expect(a.enable).toHaveBeenCalledWith('s1', 'shopify', 'another-store.myshopify.com'));
      await waitFor(() => expect(screen.queryByText(notice)).not.toBeInTheDocument());
      expect(await screen.findByText('another-store.myshopify.com')).toBeInTheDocument();
    });

    it('names the connection that holds the store and offers the way out from the refusal (m4)', async () => {
      const a = actions(status({ domains: [domain()] }));
      a.enable = vi.fn(async () => ({ ok: false as const, code: 'connection_conflict' as const,
        heldBy: { kind: 'paste' as const, platform: 'website' as const, store: null } }));
      a.disconnect = vi.fn(async () => ({ ok: true as const, data: null }));
      renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
      fireEvent.click(await screen.findByRole('radio', { name: /Shopify/ }));
      fireEvent.change(screen.getByLabelText(copy.shopifyLabel), { target: { value: 'my-store' } });
      fireEvent.click(screen.getByRole('button', { name: copy.shopifyContinue }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(copy.conflict({ kind: 'paste', platform: 'website', store: null }));
      expect(alert).not.toHaveTextContent(copy.errors.connection_conflict);
      fireEvent.click(screen.getByRole('button', { name: copy.leaveAction }));
      fireEvent.click(screen.getByRole('button', { name: copy.leaveConfirm }));
      await waitFor(() => expect(a.disconnect).toHaveBeenCalledWith('s1'));
    });

    it('never offers to undo what the merchant cannot (no action, or another kind of connection)', async () => {
      const a = actions(pendingShop());
      renderWithMantine(<PasteInstall siteId="s1" locale="en" copy={copy} ago={ago} actions={a} woocommerce={null} />);
      expect(await screen.findByText('typo-store.myshopify.com')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: copy.leaveAction })).not.toBeInTheDocument();
      expect(copy.conflict({ kind: 'woocommerce' })).toMatch(/plugin/);
      expect(copy.conflict({ kind: 'shopify_app', store: 'x.myshopify.com' })).toMatch(/^x\.myshopify\.com uses the GRINDCTRL Shopify app/);
      expect(pasteInstallCopy('ar').conflict({ kind: 'paste', platform: 'shopify', store: 'x.myshopify.com' })).toContain('⁨x.myshopify.com⁩');
    });
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
