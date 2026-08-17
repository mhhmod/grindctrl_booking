import React, { type ComponentProps } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitBanner } from './rate-limit-banner';
import { AssistantLocaleProvider } from './locale-provider';

function renderBanner(props: ComponentProps<typeof RateLimitBanner>) {
  return render(
    <AssistantLocaleProvider initialLocale="en">
      <RateLimitBanner {...props} />
    </AssistantLocaleProvider>,
  );
}

describe('RateLimitBanner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders nothing when budgets are healthy and not rate-limited', () => {
    renderBanner({
      budgets: { chat: { remaining: 8, resetSeconds: 0 }, voice: { remaining: 3, resetSeconds: 0 } },
      rateLimited: null,
      redirectPath: '/assistant',
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a calm low-budget indicator without alarming language', () => {
    renderBanner({
      budgets: { chat: { remaining: 1, resetSeconds: 0 }, voice: { remaining: 3, resetSeconds: 0 } },
      rateLimited: null,
      redirectPath: '/assistant',
    });

    expect(screen.getByText('1 message left')).toBeInTheDocument();
  });

  it('shows the limit banner with a sign-in CTA and counts the reset down every second', () => {
    renderBanner({
      budgets: { chat: { remaining: 0, resetSeconds: 5 }, voice: { remaining: 3, resetSeconds: 0 } },
      rateLimited: { resetSeconds: 5, message: '', signInCta: true },
      redirectPath: '/assistant',
    });

    expect(screen.getByText("You've reached your limit for now")).toBeInTheDocument();
    expect(screen.getByText('0:05')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in for more' })).toHaveAttribute(
      'href',
      '/sign-in?redirect_url=%2Fassistant',
    );

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('0:02')).toBeInTheDocument();
  });

  it('never shows a sign-in CTA once the authenticated tier is itself rate-limited', () => {
    renderBanner({
      budgets: { chat: { remaining: 0, resetSeconds: 5 }, voice: { remaining: 3, resetSeconds: 0 } },
      rateLimited: { resetSeconds: 5, message: '', signInCta: false },
      redirectPath: '/assistant',
    });

    expect(screen.queryByRole('link', { name: 'Sign in for more' })).not.toBeInTheDocument();
  });

  it('calls onInternalNavigate when the sign-in link is clicked, so the launcher Sheet closes', () => {
    const onInternalNavigate = vi.fn();
    renderBanner({
      budgets: { chat: { remaining: 0, resetSeconds: 5 }, voice: { remaining: 3, resetSeconds: 0 } },
      rateLimited: { resetSeconds: 5, message: '', signInCta: true },
      redirectPath: '/assistant',
      onInternalNavigate,
    });

    fireEvent.click(screen.getByRole('link', { name: 'Sign in for more' }));

    expect(onInternalNavigate).toHaveBeenCalledTimes(1);
  });
});
