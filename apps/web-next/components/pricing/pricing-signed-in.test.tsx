import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteViewerProvider } from '@/components/auth/site-viewer';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import type { SiteViewer } from '@/lib/auth/site-viewer';
import { getLandingDictionary, type SiteLocale } from '@/lib/landing/landing-i18n';
import { PricingPageContent } from './pricing-page-content';

vi.mock('@/components/dashboard/theme-toggle', () => ({ ThemeToggle: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/pricing' }));

const catalog = {
  plans: [{ planKey: 'free', name: 'Free', description: null, priceMinor: 0, currency: 'USD', rendersIncluded: 10, modelKey: 'm', isFree: true, sortOrder: 0 }],
  packs: [],
};

function renderPricing(locale: SiteLocale, viewer: SiteViewer) {
  render(
    <SiteViewerProvider viewer={viewer} clerk={false}>
      <LandingLocaleProvider initialLocale={locale}>
        <PricingPageContent catalog={catalog} currency="USD" />
      </LandingLocaleProvider>
    </SiteViewerProvider>,
  );
  return within(screen.getByRole('main'));
}

/* Item 1: the free plan's sign-up CTA takes someone with an account to it. */
describe.each(['en', 'ar'] as const)('pricing free plan CTA in %s', (locale) => {
  const t = getLandingDictionary(locale);

  it('asks a visitor to sign up', () => {
    const main = renderPricing(locale, { signedIn: false });
    expect(main.getAllByRole('link').some((link) => link.getAttribute('href') === '/sign-up')).toBe(true);
    expect(main.queryByRole('link', { name: t.openDashboard })).toBeNull();
  });

  it('sends a signed-in person to the dashboard instead', () => {
    const main = renderPricing(locale, { signedIn: true, initials: 'A', imageUrl: null });
    expect(main.getAllByRole('link').some((link) => link.getAttribute('href') === '/sign-up')).toBe(false);
    expect(main.getByRole('link', { name: t.openDashboard })).toHaveAttribute('href', '/dashboard');
  });
});
