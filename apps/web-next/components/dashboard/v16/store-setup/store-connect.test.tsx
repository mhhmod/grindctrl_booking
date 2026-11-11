import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { getChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import { StoreConnect, type StoreConnectActions, type StoreConnectMeta } from './store-connect';

vi.mock('../store-chat/paste-install', () => ({ PasteInstall: () => <div data-testid="paste-install">Paste install flow</div> }));

const meta: StoreConnectMeta = { domain: 'shop.example.com', embedKey: 'test', lastSeenMinutes: null, wooConnection: null, platformDetected: null };
const actions: StoreConnectActions = { createWooPairingCodeAction: vi.fn(async () => ({ ok: true as const, code: 'CODE', expiresAt: '2026-11-04T10:15:00Z' })) };
const en = getYourStoreCopy('en');
const chat = getChatStudioCopy('en');

it('M9: Verify your domain opens folded install steps when its link reaches #connect', async () => {
  renderWithMantine(<StoreConnect locale="en" siteId="s1" meta={{ ...meta, lastSeenMinutes: 1 }} actions={actions} />);
  expect(screen.queryByRole('heading', { name: chat.woocommerce.title })).not.toBeInTheDocument();
  try {
    await act(async () => {
      window.history.replaceState({}, '', '#connect');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('heading', { name: chat.woocommerce.title })).toBeInTheDocument();
  } finally { window.history.replaceState({}, '', window.location.pathname); }
});

describe('StoreConnect', () => {
  it('opens the install flow when the code has never been seen', () => {
    renderWithMantine(<StoreConnect locale="en" siteId="s1" meta={meta} actions={actions} />);
    expect(screen.getByRole('heading', { name: en.connect.title })).toBeInTheDocument();
    expect(screen.getByText(en.connect.waiting)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: chat.woocommerce.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: chat.woocommerce.getCode })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: chat.woocommerce.download })).toHaveAttribute('href', '/downloads/grindctrl-store-chat.zip');
    expect(screen.getByRole('button', { name: chat.copyScript })).toBeInTheDocument();
  });

  it('folds after being seen and expands and collapses accessibly', () => {
    renderWithMantine(<StoreConnect locale="en" siteId="s1" meta={{ ...meta, lastSeenMinutes: 120 }} actions={actions} />);
    expect(screen.getByRole('heading', { name: en.connect.connectedTitle })).toBeInTheDocument();
    expect(screen.getByText(en.connect.installed(chat.ago(120)))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.connect.openStore })).toHaveAttribute('href', 'https://shop.example.com');
    const toggle = screen.getByRole('button', { name: en.installSteps });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: chat.woocommerce.title })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: chat.woocommerce.title })).not.toBeInTheDocument();
  });

  it('shows status only to a member without actions', () => {
    renderWithMantine(<StoreConnect locale="en" siteId="s1" meta={{ ...meta, lastSeenMinutes: 120 }} />);
    expect(screen.getByText(en.connect.installed(chat.ago(120)))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.installSteps })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: chat.woocommerce.title })).not.toBeInTheDocument();
  });

  it('shows both WordPress and WooCommerce marks for a detected Woo store', () => {
    renderWithMantine(<StoreConnect locale="en" siteId="s1" meta={{ ...meta, platformDetected: 'woocommerce' }} />);
    const label = screen.getByText(/WordPress/);
    expect(label).toHaveTextContent('WordPress');
    expect(label.querySelectorAll('svg')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'WooCommerce' })).toBeInTheDocument();
  });

  it('shows the Shopify mark and theme editor for a myshopify domain', () => {
    renderWithMantine(<StoreConnect locale="en" siteId="s1" meta={{ ...meta, domain: 'shop.myshopify.com' }} actions={actions} />);
    expect(screen.getByText('Shopify').querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: chat.openThemeEditor })).toHaveAttribute('href', expect.stringContaining('shop.myshopify.com'));
    expect(screen.getByRole('button', { name: chat.copyScript })).toBeInTheDocument();
  });

  it('uses Arabic strings and keeps the address left-to-right', () => {
    const ar = getYourStoreCopy('ar');
    renderWithMantine(<StoreConnect locale="ar" siteId="s1" meta={meta} actions={actions} />);
    expect(screen.getByRole('heading', { name: ar.connect.title })).toBeInTheDocument();
    expect(screen.getByText(ar.connect.waiting)).toBeInTheDocument();
    expect(screen.getByText(meta.domain!)).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText(meta.domain!).tagName).toBe('BDI');
  });
});
