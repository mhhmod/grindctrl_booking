import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { getChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import type { DomainActions } from '@/lib/messenger/dashboard-actions-contract';
import type { DomainView } from '@/lib/messenger/domains';
import { StorefrontDomains } from './storefront-domains';

const pending: DomainView = {
  id: 'dom-1',
  domain: 'shop.example.com',
  status: 'pending',
  txtName: '_grindctrl-verification.shop.example.com',
  txtValue: 'grindctrl-verification=abcdefghijklmnopqrstuvwx',
  verifiedAt: null,
  lastCheckedAt: null,
};

function actions(overrides: Partial<DomainActions> = {}): DomainActions {
  return {
    listDomainsAction: vi.fn(async () => ({ ok: true as const, domains: [] })),
    addDomainAction: vi.fn(async () => ({ ok: true as const, domain: pending })),
    checkDomainAction: vi.fn(async () => ({ ok: true as const, domain: { ...pending, status: 'verified' as const } })),
    removeDomainAction: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

function renderDomains(locale: 'en' | 'ar', host: DomainActions) {
  const copy = getChatStudioCopy(locale).domains;
  renderWithMantine(<StorefrontDomains siteId="site-1" copy={copy} actions={host} />);
  return copy;
}

describe('StorefrontDomains', () => {
  it('adds a domain and shows the TXT record to publish, then verifies it', async () => {
    const host = actions();
    const copy = renderDomains('en', host);

    const input = await screen.findByLabelText(copy.label);
    fireEvent.change(input, { target: { value: 'shop.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: copy.add }));

    expect(await screen.findByText(pending.txtName)).toBeInTheDocument();
    expect(screen.getByText(pending.txtValue)).toBeInTheDocument();
    expect(screen.getByText(copy.status.pending)).toBeInTheDocument();
    expect(host.addDomainAction).toHaveBeenCalledWith('site-1', 'shop.example.com');

    fireEvent.click(screen.getByRole('button', { name: copy.check }));
    expect(await screen.findByText(copy.status.verified)).toBeInTheDocument();
    expect(screen.queryByText(pending.txtName)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.check })).not.toBeInTheDocument();
  });

  it("says why a domain was refused in the merchant's language", async () => {
    const host = actions({ addDomainAction: vi.fn(async () => ({ ok: false as const, error: 'taken' })) });
    const copy = renderDomains('ar', host);

    fireEvent.change(await screen.findByLabelText(copy.label), { target: { value: 'shop.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: copy.add }));
    expect(await screen.findByText(copy.errors.taken)).toBeInTheDocument();
  });

  it('refuses an empty domain without a round trip', async () => {
    const host = actions();
    const copy = renderDomains('en', host);
    fireEvent.click(await screen.findByRole('button', { name: copy.add }));
    expect(await screen.findByText(copy.errors.invalid_domain)).toBeInTheDocument();
    expect(host.addDomainAction).not.toHaveBeenCalled();
  });

  it('removes a domain', async () => {
    const host = actions({ listDomainsAction: vi.fn(async () => ({ ok: true as const, domains: [pending] })) });
    const copy = renderDomains('en', host);
    fireEvent.click(await screen.findByRole('button', { name: copy.remove }));
    await waitFor(() => expect(screen.queryByText(pending.domain)).not.toBeInTheDocument());
    expect(host.removeDomainAction).toHaveBeenCalledWith('site-1', 'dom-1');
  });

  it('tells the merchant when the list cannot load instead of showing an empty one', async () => {
    const copy = renderDomains('en', actions({ listDomainsAction: vi.fn(async () => ({ ok: false as const, error: 'x' })) }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.loadFailed);
    expect(screen.queryByLabelText(copy.label)).not.toBeInTheDocument();
  });
});
