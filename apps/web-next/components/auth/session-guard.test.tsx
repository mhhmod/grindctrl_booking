import React from 'react';
import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { announceSessionEnded, beginSignOut, cancelSignOut } from '@/lib/auth/session-ended';

type Listener = (resources: { session: object | null }) => void;
const clerk = vi.hoisted(() => ({
  listeners: [] as Listener[],
  addListener(listener: Listener) {
    clerk.listeners.push(listener);
    return () => {
      clerk.listeners = clerk.listeners.filter((item) => item !== listener);
    };
  },
}));
const refresh = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs', () => ({ useClerk: () => clerk }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { SessionGuard, useSessionEnded } from './session-guard';

function emit(session: object | null) {
  act(() => clerk.listeners.forEach((listener) => listener({ session })));
}

function Probe() {
  return <p>{useSessionEnded() ? 'ended' : 'live'}</p>;
}

function renderGuard(locale: 'en' | 'ar' = 'en') {
  return render(
    <SessionGuard locale={locale}>
      <Probe />
    </SessionGuard>,
  );
}

beforeEach(() => {
  clerk.listeners = [];
  refresh.mockClear();
  window.history.replaceState(null, '', '/dashboard/inbox?shop=a.myshopify.com');
});
afterEach(() => cancelSignOut());

describe('SessionGuard', () => {
  it('says the session ended when it ends in another tab, with a sign-in back to this page', () => {
    renderGuard();
    emit({ id: 'sess_1' });
    expect(screen.getByText('live')).toBeInTheDocument();
    emit(null);
    expect(screen.getByText('ended')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'You were signed out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute(
      'href',
      '/sign-in?redirect_url=%2Fdashboard%2Finbox%3Fshop%3Da.myshopify.com',
    );
  });

  it('does not report a session that never existed in this tab', () => {
    renderGuard();
    emit(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the prompt when a server action answers signed out, in Arabic too', () => {
    renderGuard('ar');
    act(() => announceSessionEnded());
    expect(screen.getByRole('dialog', { name: 'تم تسجيل خروجك' })).toBeInTheDocument();
  });

  it('stays quiet while this tab signs out on purpose', () => {
    renderGuard();
    emit({ id: 'sess_1' });
    beginSignOut();
    emit(null);
    act(() => announceSessionEnded());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clears itself and refreshes the page when the person signs in again elsewhere', () => {
    renderGuard();
    emit({ id: 'sess_1' });
    emit(null);
    emit({ id: 'sess_2' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('live')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
