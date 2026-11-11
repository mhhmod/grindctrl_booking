import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateShopLinkCode: vi.fn(), status: vi.fn(), refresh: vi.fn() }));
vi.mock('@/app/dashboard/connect-shop/actions', () => ({
  generateShopLinkCode: mocks.generateShopLinkCode,
  shopLinkCodeStatus: mocks.status,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { ConnectShopPanel, LINK_POLL_MS } from './connect-shop-panel';
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
    mocks.status.mockReset().mockResolvedValue({ linkedShop: null });
    mocks.refresh.mockReset();
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

  it('stays available once a store is connected, to add or re-link one', async () => {
    render(<ConnectShopPanel locale="en" hasShops />);
    expect(screen.queryByRole('button', { name: c.connectStore })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: c.connectAnotherStore }));
    });

    expect(screen.getByText('ABCD-EFGH')).toBeInTheDocument();
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

  it('watches the open code every 5 seconds and shows the connected store without a reload (M4)', async () => {
    mocks.generateShopLinkCode.mockResolvedValueOnce({ code: 'ABCDEFGH', expiresAt: new Date(NOW + 600_000).toISOString() });
    render(<ConnectShopPanel locale="en" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: c.connectStore }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LINK_POLL_MS);
    });
    expect(mocks.status).toHaveBeenCalledExactlyOnceWith('ABCDEFGH');
    expect(mocks.refresh).not.toHaveBeenCalled();

    mocks.status.mockResolvedValue({ linkedShop: 'maison.myshopify.com' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LINK_POLL_MS);
    });
    expect(screen.getByRole('status')).toHaveTextContent(c.shopLinked('maison.myshopify.com'));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    // Stops once linked.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LINK_POLL_MS * 3);
    });
    expect(mocks.status).toHaveBeenCalledTimes(2);
  });

  it('stops watching once the code expired', async () => {
    render(<ConnectShopPanel locale="en" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: c.connectStore }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LINK_POLL_MS * 4);
    });
    expect(mocks.status).not.toHaveBeenCalled();
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
