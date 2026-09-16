import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { OperationsPageContent } from '@/components/operations/operations-page-content';
import { getOperationsCopy } from '@/components/operations/operations-copy';
import { BOOKING_URL } from '@/lib/booking';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function renderPage(locale: SiteLocale) {
  render(
    <LandingLocaleProvider initialLocale={locale}>
      <OperationsPageContent />
    </LandingLocaleProvider>,
  );
  return getOperationsCopy(locale);
}

describe('OperationsPageContent', () => {
  it.each<SiteLocale>(['en', 'ar'])('renders exactly one h1 with the hero title in %s', (locale) => {
    const t = renderPage(locale);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(t.heroTitle);
  });

  it.each<SiteLocale>(['en', 'ar'])('states the honest scope of order lookup, audit trail, and visibility in %s', (locale) => {
    const t = renderPage(locale);
    expect(screen.getByText(t.orderPoints[0])).toBeInTheDocument();
    expect(screen.getByText(t.visibilityConversationBody)).toBeInTheDocument();
    expect(screen.getByText(t.visibilityTryOnBody)).toBeInTheDocument();
    expect(screen.getByText(t.notLiveCrm.label)).toBeInTheDocument();
    expect(screen.getByText(t.notLiveWorkflow.label)).toBeInTheDocument();
    expect(screen.getByText(t.notLiveAttribution.label)).toBeInTheDocument();
    expect(screen.getByText(t.notLiveChannels.label)).toBeInTheDocument();
    expect(screen.getByText(t.intakeNote)).toBeInTheDocument();
  });

  it('never claims intent-based routing, and disclaims the "Analytics" tab rather than presenting itself as one', () => {
    const t = renderPage('en');
    expect(screen.queryByText(/intent-based routing/i)).not.toBeInTheDocument();
    expect(screen.getByText(t.visibilityBody)).toBeInTheDocument();
  });

  it.each<SiteLocale>(['en', 'ar'])('points every CTA at a real destination and never at /sign-up in %s', (locale) => {
    renderPage(locale);
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).not.toContain('/sign-up');
    expect(hrefs).toContain(BOOKING_URL);
    expect(hrefs).toContain('/conversations');
    expect(hrefs).toContain('/integrations');
    expect(hrefs).toContain('/pricing');
  });
});
