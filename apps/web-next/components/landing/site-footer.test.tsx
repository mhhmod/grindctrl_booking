import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SiteFooter } from '@/components/landing/site-footer';
import { getLandingDictionary, type SiteLocale } from '@/lib/landing/landing-i18n';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));
vi.mock('@/components/landing/analytics-consent-control', () => ({
  AnalyticsConsentControl: () => <div data-testid="consent-control" />,
}));

function renderFooter(
  locale: SiteLocale = 'en',
  props: { withConsentControl?: boolean; withLauncherSpacing?: boolean } = {},
) {
  const t = getLandingDictionary(locale);
  render(
    <LandingLocaleProvider initialLocale={locale}>
      <SiteFooter {...props} />
    </LandingLocaleProvider>,
  );
  return t;
}

describe('SiteFooter', () => {
  it.each<SiteLocale>(['en', 'ar'])('lists the brand, tagline and site links in %s', (locale) => {
    const t = renderFooter(locale);
    const footer = within(screen.getByRole('contentinfo'));

    expect(footer.getByText(t.footerTagline)).toBeInTheDocument();
    expect(footer.getByRole('link', { name: t.footerHome })).toHaveAttribute('href', '/');
    expect(footer.getByRole('link', { name: t.footerDemo })).toHaveAttribute('href', '/try-on');
    expect(footer.getByRole('link', { name: t.footerPricing })).toHaveAttribute('href', '/pricing');
    expect(footer.getByRole('link', { name: t.footerRoi })).toHaveAttribute('href', '/roi');
    expect(footer.getByRole('button', { name: t.langToggleLabel })).toBeInTheDocument();
    expect(footer.getByRole('button', { name: 'Theme' })).toBeInTheDocument();
  });

  it('omits the consent control and launcher spacing by default (pricing/roi/marketing pages)', () => {
    renderFooter('en');
    const footer = screen.getByRole('contentinfo');
    expect(screen.queryByTestId('consent-control')).not.toBeInTheDocument();
    expect(footer).toHaveClass('py-10');
    expect(footer).not.toHaveClass('pb-24');
  });

  it('renders the consent control and launcher spacing when opted in (homepage)', () => {
    renderFooter('en', { withConsentControl: true, withLauncherSpacing: true });
    const footer = screen.getByRole('contentinfo');
    expect(screen.getByTestId('consent-control')).toBeInTheDocument();
    expect(footer).toHaveClass('pb-24', 'pt-10');
  });
});
