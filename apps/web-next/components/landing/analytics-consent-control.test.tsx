import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { getLandingDictionary } from '@/lib/landing/landing-i18n';

const posthog = vi.hoisted(() => {
  let explicit: 'granted' | 'denied' | 'pending' = 'pending';
  return {
    reset: () => { explicit = 'pending'; },
    get_explicit_consent_status: vi.fn(() => explicit),
    has_opted_in_capturing: vi.fn(() => explicit === 'granted'),
    has_opted_out_capturing: vi.fn(() => explicit === 'denied'),
    opt_in_capturing: vi.fn(() => { explicit = 'granted'; }),
    opt_out_capturing: vi.fn(() => { explicit = 'denied'; }),
  };
});

vi.mock('posthog-js', () => ({ default: posthog }));

import { AnalyticsConsentControl } from '@/components/landing/analytics-consent-control';

function renderControl(locale: 'en' | 'ar' = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={locale}>
      <AnalyticsConsentControl />
    </LandingLocaleProvider>,
  );
}

describe('AnalyticsConsentControl', () => {
  beforeEach(() => {
    posthog.reset();
    vi.clearAllMocks();
  });

  it('exposes an explicit unknown state and keyboard-focusable allow and deny buttons', () => {
    const copy = getLandingDictionary('en');
    renderControl();

    const region = screen.getByRole('region', { name: copy.analyticsTitle });
    const choice = within(region).getByRole('group', { name: copy.analyticsChoiceLabel });
    const deny = within(choice).getByRole('button', { name: copy.analyticsDeny });
    const allow = within(choice).getByRole('button', { name: copy.analyticsAllow });

    expect(within(region).getByRole('status')).toHaveTextContent(`${copy.analyticsStatusLabel}: ${copy.analyticsStatusUnknown}`);
    expect(deny).toHaveAttribute('aria-pressed', 'false');
    expect(allow).toHaveAttribute('aria-pressed', 'false');
    deny.focus();
    expect(deny).toHaveFocus();
    expect(deny.tagName).toBe('BUTTON');
  });

  it('persists explicit PostHog denial and restores that state on remount', () => {
    const copy = getLandingDictionary('en');
    const first = renderControl();
    fireEvent.click(screen.getByRole('button', { name: copy.analyticsDeny }));

    expect(posthog.opt_out_capturing).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: copy.analyticsDeny })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(copy.analyticsStatusDenied);

    first.unmount();
    renderControl();
    expect(screen.getByRole('button', { name: copy.analyticsDeny })).toHaveAttribute('aria-pressed', 'true');
  });

  it('persists explicit PostHog opt-in and announces the granted state', () => {
    const copy = getLandingDictionary('en');
    renderControl();
    const allow = screen.getByRole('button', { name: copy.analyticsAllow });

    allow.focus();
    fireEvent.click(allow);

    expect(posthog.opt_in_capturing).toHaveBeenCalledOnce();
    expect(allow).toHaveFocus();
    expect(allow).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(copy.analyticsStatusGranted);
  });

  it('renders fully localized controls inside the Arabic RTL boundary', () => {
    const copy = getLandingDictionary('ar');
    const { container } = renderControl('ar');

    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl');
    expect(container.firstElementChild).toHaveAttribute('lang', 'ar');
    expect(screen.getByRole('region', { name: copy.analyticsTitle })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: copy.analyticsChoiceLabel })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.analyticsAllow })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.analyticsDeny })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(copy.analyticsStatusUnknown);
  });
});
