import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);
const session = vi.hoisted(() => ({ ended: false }));
vi.mock('@/components/auth/session-guard', () => ({ useSessionEnded: () => session.ended }));

import DashboardError from './error';

beforeEach(() => {
  sentry.captureException.mockClear();
  session.ended = false;
  document.cookie = 'gc-locale=; max-age=0';
});

describe('the dashboard error boundary after the session ended', () => {
  it('offers a sign-in back to this page instead of a generic error, and reports nothing', () => {
    session.ended = true;
    window.history.replaceState(null, '', '/dashboard/settings?tab=team');
    render(<DashboardError error={new Error('unexpected response')} reset={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'You were signed out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute(
      'href',
      '/sign-in?redirect_url=%2Fdashboard%2Fsettings%3Ftab%3Dteam',
    );
    expect(screen.queryByRole('heading', { name: 'This page did not load' })).not.toBeInTheDocument();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('the dashboard error boundary', () => {
  it('reports the error, says what happened and retries on request', () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });
    render(<DashboardError error={error} reset={reset} />);
    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(screen.getByRole('heading', { name: 'This page did not load' })).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('speaks Arabic when the language cookie says so, and omits a reference it does not have', async () => {
    document.cookie = 'gc-locale=ar';
    render(<DashboardError error={new Error('boom')} reset={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'تعذّر تحميل هذه الصفحة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument();
    expect(screen.queryByText(/الرقم المرجعي/)).not.toBeInTheDocument();
  });
});
