import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildCanonicalInstallSnippet } from '@/lib/adapters/install';
import { InstallCard } from './install-card';

const EMBED_KEY = 'gc_521d5a81_1f8e3392_b06c804d';
const SNIPPET = `<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="${EMBED_KEY}"></script>`;

function renderInstallCard(domain: string | null = 'grindctrl.myshopify.com', active = true, locale = 'en') {
  return render(
    <InstallCard
      locale={locale}
      siteId="site-1"
      embedKey={EMBED_KEY}
      domain={domain}
      active={active}
      detectedAt="2026-08-30T10:00:00.000Z"
      version={3}
      actions={{ setMessengerEnabled: vi.fn() }}
    />,
  );
}

describe('InstallCard overflow guards', () => {
  it.each([
    ['en', 'Store Chat is off. Turn it on here, even if the theme embed is already enabled.', 'Turn on Store Chat'],
    ['ar', 'دردشة المتجر متوقفة. شغّلها هنا حتى لو كانت إضافة القالب مفعّلة بالفعل.', 'تشغيل دردشة المتجر'],
  ])('explains the separate Store Chat enable step beside its control in %s', (locale, hint, button) => {
    renderInstallCard('grindctrl.myshopify.com', false, locale);

    const note = screen.getByText(hint);
    expect(note).toBeVisible();
    expect(note.parentElement).toContainElement(screen.getByRole('button', { name: button }));
  });

  it('hides the enable hint when Store Chat is already active', () => {
    renderInstallCard();

    expect(screen.queryByText(/Store Chat is off/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn on Store Chat' })).not.toBeInTheDocument();
  });

  it('renders the long install snippet inside min-width guarded cards and grid', () => {
    const { container } = renderInstallCard();

    const snippetCode = container.querySelector('pre code');
    expect(snippetCode).toBeInTheDocument();
    expect(snippetCode).toHaveTextContent(SNIPPET);
    expect(buildCanonicalInstallSnippet(EMBED_KEY)).toBe(SNIPPET);

    const shopifyCard = screen.getByRole('heading', { name: 'Shopify' }).parentElement;
    // On a Shopify store the snippet is collapsed behind a summary rather
    // than presented as a second heading of equal standing — see below.
    const otherPlatformsCard = screen.getByText('Other platforms').parentElement;
    const installMethodsGrid = shopifyCard?.parentElement;

    expect(installMethodsGrid).toHaveClass('min-w-0');
    expect(shopifyCard).toHaveClass('min-w-0');
    expect(otherPlatformsCard).toHaveClass('min-w-0');
  });

  /* Two install panels side by side made a Shopify merchant decide which of
     them applied to them before they could do anything, on the one screen
     that should have a single obvious next action. The snippet stays
     available — collapsed, and still rendered, so copy still works. */
  it('collapses the manual snippet on a Shopify store', () => {
    renderInstallCard('grindctrl.myshopify.com');

    const summary = screen.getByText('Other platforms');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.closest('details')).toBeInTheDocument();
    expect(summary.closest('details')).not.toHaveAttribute('open');
  });

  it('leaves the manual snippet expanded when there is no Shopify store to install into', () => {
    renderInstallCard(null);

    const heading = screen.getByRole('heading', { name: 'Other platforms' });
    expect(heading.closest('details')).toBeNull();
  });

  it('allows the displayed embed key and its row to shrink safely', () => {
    const { container } = renderInstallCard();

    const embedKeyCode = Array.from(container.querySelectorAll('code')).find(
      (element) => element.textContent === EMBED_KEY,
    );

    expect(embedKeyCode).toBeInTheDocument();
    expect(embedKeyCode).toHaveClass('break-all');
    expect(embedKeyCode?.parentElement).toHaveClass('min-w-0');
  });

  /* This card renders inside the embedded Shopify app, which is an iframe on
     admin.shopify.com. A Shopify admin URL opened in that iframe is refused
     ("admin.shopify.com refused to connect") because admin will not frame
     itself, so the merchant sees a broken panel at the exact moment they try
     to turn Store Chat on. Try-On's equivalent links already carry
     target="_blank" (components/shopify/admin-settings.tsx) and work; this one
     did not. Any link out to Shopify admin must leave the iframe. */
  it('opens the theme-editor deep link outside the embedded app iframe', () => {
    const { container } = renderInstallCard();

    const adminLinks = Array.from(container.querySelectorAll('a')).filter((anchor) =>
      /myshopify\.com\/admin\/|admin\.shopify\.com|\/api\/shopify\/theme-link\?/.test(anchor.getAttribute('href') ?? ''),
    );

    expect(adminLinks.length).toBeGreaterThan(0);
    for (const link of adminLinks) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel') ?? '').toContain('noopener');
    }
  });

  it('links out to the live storefront to test the widget when a domain is connected', () => {
    renderInstallCard('grindctrl.myshopify.com');

    const testLink = screen.getByRole('link', { name: 'Test it now' });
    expect(testLink).toHaveAttribute('href', 'https://grindctrl.myshopify.com');
    expect(testLink).toHaveAttribute('target', '_blank');
    expect(testLink.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('hides the storefront test link when no domain is connected', () => {
    renderInstallCard(null);

    expect(screen.queryByRole('link', { name: 'Test it now' })).toBeNull();
  });
});
