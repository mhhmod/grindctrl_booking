import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstallCard } from './install-card';

const EMBED_KEY = 'gc_521d5a81_1f8e3392_b06c804d';
const SNIPPET = `<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="${EMBED_KEY}"></script>`;

function renderInstallCard() {
  return render(
    <InstallCard
      locale="en"
      siteId="site-1"
      embedKey={EMBED_KEY}
      domain="grindctrl.myshopify.com"
      active
      detectedAt="2026-08-30T10:00:00.000Z"
      version={3}
      actions={{ setMessengerEnabled: vi.fn() }}
    />,
  );
}

describe('InstallCard overflow guards', () => {
  it('renders the long install snippet inside min-width guarded cards and grid', () => {
    const { container } = renderInstallCard();

    const snippetCode = container.querySelector('pre code');
    expect(snippetCode).toBeInTheDocument();
    expect(snippetCode).toHaveTextContent(SNIPPET);

    const shopifyCard = screen.getByRole('heading', { name: 'Shopify' }).parentElement;
    const otherPlatformsCard = screen.getByRole('heading', { name: 'Other platforms' }).parentElement;
    const installMethodsGrid = shopifyCard?.parentElement;

    expect(installMethodsGrid).toHaveClass('min-w-0');
    expect(shopifyCard).toHaveClass('min-w-0');
    expect(otherPlatformsCard).toHaveClass('min-w-0');
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
});
