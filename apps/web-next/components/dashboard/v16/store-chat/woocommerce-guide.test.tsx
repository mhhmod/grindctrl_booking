import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { getChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import type { WooSiteConnectionSummary } from '@/lib/woo/connection';
import {
  WOO_PLUGIN_ZIP,
  WoocommerceGuide,
  type CreateWooPairingCode,
} from './woocommerce-guide';

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const CODE = 'K7QM4TXP';
const EXPIRES_AT = new Date(Date.now() + 15 * 60_000).toISOString();

function successfulAction(): CreateWooPairingCode {
  return vi.fn(async () => ({ ok: true as const, code: CODE, expiresAt: EXPIRES_AT }));
}

function draw(
  locale: 'en' | 'ar',
  createPairingCode = successfulAction(),
  connection: WooSiteConnectionSummary | null = null,
) {
  const copy = getChatStudioCopy(locale);
  renderWithMantine(
    <WoocommerceGuide
      locale={locale}
      siteId={SITE_ID}
      connection={connection}
      createPairingCode={createPairingCode}
      copy={copy.woocommerce}
      copyLabels={copy.domains}
    />,
  );
  return { copy, createPairingCode };
}

describe('WoocommerceGuide', () => {
  it.each(['en', 'ar'] as const)('walks the merchant through pairing in %s', (locale) => {
    const { copy } = draw(locale);
    const { steps } = copy.woocommerce;

    expect(screen.getByRole('heading', { level: 3, name: copy.woocommerce.title })).toBeInTheDocument();
    expect(screen.getByText(copy.woocommerce.body)).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    [steps.download, steps.upload, steps.code, steps.connect, steps.domain].forEach((text, index) =>
      expect(items[index]).toHaveTextContent(text),
    );

    const link = screen.getByRole('link', { name: copy.woocommerce.download });
    expect(link).toHaveAttribute('href', '/downloads/grindctrl-store-chat.zip');
    expect(link).toHaveAttribute('download', 'grindctrl-store-chat.zip');
    expect(items[0]).toContainElement(link);
    expect(screen.getByRole('button', { name: copy.woocommerce.getCode })).toBeInTheDocument();
    expect(screen.queryByText(CODE)).not.toBeInTheDocument();
  });

  it('links to a file that ships with the app', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../../../public', `.${WOO_PLUGIN_ZIP}`))).toBe(true);
  });

  it('creates, shows, expires and copies a one-time connection code', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { copy, createPairingCode } = draw('en');

    fireEvent.click(screen.getByRole('button', { name: copy.woocommerce.getCode }));
    expect(await screen.findByText(CODE)).toHaveAttribute('dir', 'ltr');
    expect(createPairingCode).toHaveBeenCalledWith(SITE_ID);
    expect(screen.getByText(/Expires at/).closest('time')).toHaveAttribute('datetime', EXPIRES_AT);

    const copyButton = screen.getByRole('button', {
      name: `${copy.domains.copy}: ${copy.woocommerce.codeLabel}`,
    });
    fireEvent.click(copyButton);
    await waitFor(() => expect(copyButton).toHaveTextContent(copy.domains.copied));
    expect(writeText).toHaveBeenCalledWith(CODE);
  });

  it('shows a safe localized failure without exposing the action error', async () => {
    const failed: CreateWooPairingCode = vi.fn(async () => ({
      ok: false as const,
      code: 'unavailable',
      message: 'internal database detail',
    }));
    const { copy } = draw('en', failed);
    fireEvent.click(screen.getByRole('button', { name: copy.woocommerce.getCode }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.woocommerce.codeError);
    expect(screen.queryByText(/database detail/)).not.toBeInTheDocument();
  });

  it.each(['active', 'disconnected'] as const)('shows the %s plugin connection state', (status) => {
    const connection: WooSiteConnectionSummary = {
      platform: 'woocommerce',
      status,
      pluginVersion: '0.2.0',
      lastSeenAt: '2026-11-04T10:30:00.000Z',
      pairedAt: '2026-11-04T10:00:00.000Z',
      homeUrl: 'https://shop.example.com',
      cloneSuspected: false,
      pluginOutdated: false,
    };
    const { copy } = draw('en', successfulAction(), connection);
    expect(screen.getByText(status === 'active' ? copy.woocommerce.connected : copy.woocommerce.disconnected)).toBeInTheDocument();
    expect(screen.getByText(copy.woocommerce.pluginVersion('0.2.0'))).toBeInTheDocument();
    expect(screen.getByText(/Last heartbeat/).closest('time')).toHaveAttribute(
      'datetime',
      connection.lastSeenAt,
    );
    cleanup();
  });

  it('warns about a cloned site and an outdated plugin only while the connection is active', () => {
    const base: WooSiteConnectionSummary = {
      platform: 'woocommerce',
      status: 'active',
      pluginVersion: '0.1.0',
      lastSeenAt: '2026-11-04T10:30:00.000Z',
      pairedAt: '2026-11-04T10:00:00.000Z',
      homeUrl: 'https://shop.example.com',
      cloneSuspected: true,
      pluginOutdated: true,
    };
    const { copy } = draw('en', successfulAction(), base);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.woocommerce.cloneWarning);
    expect(screen.getByText(copy.woocommerce.updatePlugin)).toBeInTheDocument();
    cleanup();

    draw('en', successfulAction(), { ...base, cloneSuspected: false, pluginOutdated: false });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(copy.woocommerce.updatePlugin)).not.toBeInTheDocument();
    cleanup();

    draw('en', successfulAction(), { ...base, status: 'disconnected' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('presents a setup path, not a broader support claim, and keeps domain verification', () => {
    const { woocommerce } = getChatStudioCopy('en');
    const text = [woocommerce.title, woocommerce.body, ...Object.values(woocommerce.steps)].join(' ');
    expect(text).not.toMatch(/\b(supported|live)\b/i);
    expect(woocommerce.steps.domain).toMatch(/only after the domain is verified/);
  });
});

afterEach(() => vi.useRealTimers());
it.each(['en','ar'] as const)('M8: replaces expired code with a renewal action (%s)', async (locale) => {
  vi.useFakeTimers();
  const copy = getChatStudioCopy(locale);
  const create = vi.fn<CreateWooPairingCode>().mockResolvedValue({ ok: true, code: CODE, expiresAt: new Date(Date.now() + 1000).toISOString() });
  draw(locale, create);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.woocommerce.getCode })); });
  expect(screen.getByText(CODE)).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
  expect(screen.queryByText(CODE)).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.woocommerce.codeExpired })); });
  expect(create).toHaveBeenCalledTimes(2);
});
it('M8: passes retryAfterSeconds into a visible, enforced countdown', async () => {
  vi.useFakeTimers();
  const create = vi.fn<CreateWooPairingCode>().mockResolvedValue({ ok: false, code: 'rate_limited', message: 'private detail', retryAfterSeconds: 2 });
  const { copy } = draw('en', create);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.woocommerce.getCode })); });
  expect(screen.getByRole('alert')).toHaveTextContent('Try again in 2 seconds.');
  expect(screen.getByRole('button', { name: copy.woocommerce.getCode })).toBeDisabled();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('button', { name: copy.woocommerce.getCode })).toBeEnabled();
});
