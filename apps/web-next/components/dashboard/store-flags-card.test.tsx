import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ setStoreFlag: vi.fn() }));
vi.mock('@/app/dashboard/flags/actions', () => ({ setStoreFlag: mocks.setStoreFlag }));

import { StoreFlagsCard } from './store-flags-card';

const ROWS = [
  { flag: 'n23_after_hours', code: 'N23', title: 'The assistant answers after hours', enabled: false },
  { flag: 'n24_assistant_down', code: 'N24', title: 'The assistant-down fallback', enabled: true },
];

describe('StoreFlagsCard', () => {
  beforeEach(() => mocks.setStoreFlag.mockReset());

  it('shows each flag with its state', () => {
    render(<StoreFlagsCard kind="shop" storeKey="maison.myshopify.com" storeLabel="maison.myshopify.com" rows={ROWS} />);
    expect(screen.getByText('N23, The assistant answers after hours')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('flips a flag through the operator action and shows what the server answered', async () => {
    mocks.setStoreFlag.mockResolvedValue({ ok: true, flags: ['n23_after_hours', 'n24_assistant_down'] });
    render(<StoreFlagsCard kind="shop" storeKey="maison.myshopify.com" storeLabel="maison.myshopify.com" rows={ROWS} />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => expect(screen.getAllByRole('button')[0].getAttribute('aria-pressed')).toBe('true'));
    expect(mocks.setStoreFlag).toHaveBeenCalledWith({
      kind: 'shop',
      key: 'maison.myshopify.com',
      flag: 'n23_after_hours',
      enabled: true,
    });
  });

  it('keeps the state and says why when the action refuses', async () => {
    mocks.setStoreFlag.mockResolvedValue({ ok: false, code: 'forbidden', message: 'You do not have permission to perform this action.' });
    render(<StoreFlagsCard kind="site" storeKey="11111111-1111-4111-8111-111111111111" storeLabel="Maison" rows={ROWS} />);

    fireEvent.click(screen.getAllByRole('button')[1]);

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission');
    expect(screen.getAllByRole('button')[1].getAttribute('aria-pressed')).toBe('true');
  });
});
