import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ createPreviewLink: vi.fn(), setLaunchState: vi.fn() }));
vi.mock('@/app/dashboard/try-on/launch-actions', () => actions);

import { LaunchCard } from './launch-card';

const PREVIEW = { state: 'preview' as const, holdoutDay: null, holdoutDays: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LaunchCard (N5, N6)', () => {
  it('offers Open my store and Go live while the store is in preview, in English and Arabic', () => {
    const { unmount } = render(<LaunchCard locale="en" shop="maison.myshopify.com" launch={PREVIEW} holdoutAvailable />);
    expect(screen.getByText('Try it yourself on your store')).toBeInTheDocument();
    expect(screen.getByText('Test looks are free.')).toBeInTheDocument();
    expect(screen.getByText('For everyone, or for half your visitors so you can measure the difference.')).toBeInTheDocument();
    expect(screen.getByText('Only you see GrindCTRL on your store until you go live.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go live' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '50/50 test' })).toBeInTheDocument();
    unmount();

    render(<LaunchCard locale="ar" shop="maison.myshopify.com" launch={PREVIEW} holdoutAvailable={false} />);
    expect(screen.getByText('جرّب بنفسك في متجرك')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افتح متجري' })).toBeInTheDocument();
    expect(screen.getByText('لن يرى أحد غيرك GrindCTRL في متجرك حتى تطلقه للمتسوقين.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'اختبار 50/50' })).not.toBeInTheDocument();
  });

  it('opens the signed preview link in a new tab', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    actions.createPreviewLink.mockResolvedValue({ ok: true, url: 'https://maison.myshopify.com/?gc_preview=t.s', expiresAt: '2026-10-18T00:00:00Z' });
    render(<LaunchCard locale="en" shop="maison.myshopify.com" launch={PREVIEW} holdoutAvailable />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open my store' }));
    });

    expect(actions.createPreviewLink).toHaveBeenCalledWith({ shop: 'maison.myshopify.com' });
    expect(tab.location.href).toBe('https://maison.myshopify.com/?gc_preview=t.s');
    expect(tab.opener).toBeNull();
  });

  it('goes live, then shows the step as done', async () => {
    actions.setLaunchState.mockResolvedValue({ ok: true, state: 'live' });
    render(<LaunchCard locale="en" shop="maison.myshopify.com" launch={PREVIEW} holdoutAvailable />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Go live' }));
    });

    expect(actions.setLaunchState).toHaveBeenCalledWith({ shop: 'maison.myshopify.com', state: 'live' });
    expect(screen.queryByRole('button', { name: 'Go live' })).not.toBeInTheDocument();
    expect(screen.queryByText('Only you see GrindCTRL on your store until you go live.')).not.toBeInTheDocument();
  });

  it('shows the day of a running 50/50 test, with Go live to end it for everyone', () => {
    render(
      <LaunchCard locale="en" shop="maison.myshopify.com" launch={{ state: 'holdout', holdoutDay: 9, holdoutDays: 14 }} holdoutAvailable />,
    );
    expect(screen.getByText('50/50 test, day 9 of 14')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go live' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '50/50 test' })).not.toBeInTheDocument();
  });

  it('says why an action failed', async () => {
    actions.setLaunchState.mockResolvedValue({ ok: false, code: 'not_enabled', message: 'This is not available for this store yet.' });
    render(<LaunchCard locale="en" shop="maison.myshopify.com" launch={PREVIEW} holdoutAvailable />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '50/50 test' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('This is not available for this store yet.');
  });
});
