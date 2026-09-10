import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateShopLinkCode: vi.fn() }));
vi.mock('@/app/dashboard/connect-shop/actions', () => ({
  generateShopLinkCode: mocks.generateShopLinkCode,
}));

import { ConnectShopPanel } from './connect-shop-panel';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';

const NOW = Date.parse('2026-09-10T10:00:00.000Z');
const c = getTryOnDashboardCopy('en');

describe('ConnectShopPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.generateShopLinkCode.mockReset().mockResolvedValue({
      code: 'ABCDEFGH',
      expiresAt: new Date(NOW + 5_000).toISOString(),
    });
  });

  afterEach(() => vi.useRealTimers());

  it('generates and displays a readable code with the linking instructions', async () => {
    render(<ConnectShopPanel locale="en" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: c.connectStore }));
    });

    expect(screen.getByText('ABCD-EFGH')).toBeInTheDocument();
    expect(screen.getByText(c.connectStoreInstructions)).toBeInTheDocument();
    expect(screen.getByText(c.shopLinkExpiresIn('0:05'))).toBeInTheDocument();
  });

  it('counts down to expiry', async () => {
    render(<ConnectShopPanel locale="en" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: c.connectStore }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(screen.getByText(c.shopLinkExpiresIn('0:02'))).toBeInTheDocument();
  });

  it('offers and generates a fresh code after expiry', async () => {
    mocks.generateShopLinkCode
      .mockResolvedValueOnce({ code: 'ABCDEFGH', expiresAt: new Date(NOW + 1_000).toISOString() })
      .mockResolvedValueOnce({ code: '23456789', expiresAt: new Date(NOW + 601_000).toISOString() });
    render(<ConnectShopPanel locale="en" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: c.connectStore }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    const regenerate = screen.getByRole('button', { name: c.generateNewShopLinkCode });
    await act(async () => {
      fireEvent.click(regenerate);
    });

    expect(screen.getByText('2345-6789')).toBeInTheDocument();
    expect(mocks.generateShopLinkCode).toHaveBeenCalledTimes(2);
  });
});
