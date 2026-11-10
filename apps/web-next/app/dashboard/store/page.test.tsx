import React from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { getRequestLocale } from '@/lib/auth/locale';
import { getActiveStoreRole } from '@/lib/dashboard/active-store-server';
import { getYourStoreFacts } from '@/lib/dashboard/your-store-data';
import type { YourStoreFacts } from '@/lib/dashboard/your-store-model';

vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn() }));
vi.mock('@/lib/dashboard/active-store-server', () => ({
  getActiveStore: vi.fn(async () => ({ shopDomain: null, siteId: 'site-1', tenantKey: 'site:1', platform: 'paste' })),
  getActiveStoreTimeZone: vi.fn(async () => 'UTC'),
  getActiveStoreRole: vi.fn(async () => 'owner'),
}));
vi.mock('@/lib/dashboard/your-store-data', () => ({ getYourStoreFacts: vi.fn() }));
vi.mock('@/app/dashboard/try-on/actions', () => ({ setTryOnButtonAction: vi.fn() }));
vi.mock('@/app/dashboard/store-chat/actions', () => ({ setMessengerEnabled: vi.fn() }));
vi.mock('@/app/dashboard/store-chat/paste-actions', () => ({ checkPasteDomainAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import YourStorePage from './page';

const FACTS: YourStoreFacts = {
  now: Date.parse('2026-11-10T12:14:00Z'),
  timeZone: 'UTC',
  platform: 'paste_website',
  address: 'lulusfashion.com',
  storeUrl: 'https://lulusfashion.com',
  canChange: true,
  canBilling: true,
  code: { lastSeenAt: '2026-11-10T12:11:00Z', connected: false },
  launchState: 'live',
  codeOutdated: false,
  tryOn: { tenant: 'site:1', showButton: true, looksLeft: 15, looksIncluded: 20, planActive: true, pasteReason: null },
  chat: { siteId: 'site-1', enabled: true },
  domains: [],
};

beforeEach(() => {
  vi.mocked(getRequestLocale).mockResolvedValue('en');
  vi.mocked(getYourStoreFacts).mockReset();
});

describe('YourStorePage', () => {
  it('draws the products and the Store check for a connected store', async () => {
    vi.mocked(getYourStoreFacts).mockResolvedValue(FACTS);
    renderWithMantine(await YourStorePage());
    expect(getYourStoreFacts).toHaveBeenCalledWith(expect.objectContaining({ role: 'owner', timeZone: 'UTC' }));
    expect(screen.getByRole('switch', { name: 'Try-On' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Store check' })).toBeInTheDocument();
  });

  it('disables the switches for a member, from the role on the server', async () => {
    vi.mocked(getActiveStoreRole).mockResolvedValueOnce('member');
    vi.mocked(getYourStoreFacts).mockResolvedValue({ ...FACTS, canChange: false, canBilling: false });
    renderWithMantine(await YourStorePage());
    expect(screen.getByRole('switch', { name: 'Try-On' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Store Chat' })).toBeDisabled();
  });

  it('says the store is not connected yet, in Arabic', async () => {
    vi.mocked(getRequestLocale).mockResolvedValue('ar');
    vi.mocked(getYourStoreFacts).mockResolvedValue(null);
    renderWithMantine(await YourStorePage());
    expect(screen.getByRole('heading', { name: 'لم يُربط بعد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'اربط متجرك' })).toHaveAttribute('href', '/dashboard/store-chat/setup#install');
  });

  it('lets a failed read reach the dashboard error state instead of drawing a blank page', async () => {
    vi.mocked(getYourStoreFacts).mockRejectedValue(new Error('down'));
    await expect(YourStorePage()).rejects.toThrow('down');
  });
});
