import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { ShoppingPageContent } from '@/components/shopping/shopping-page-content';
import { getShoppingCopy } from '@/components/shopping/shopping-copy';
import { BOOKING_URL } from '@/lib/booking';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function renderShopping(locale: SiteLocale = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={locale}>
      <ShoppingPageContent />
    </LandingLocaleProvider>,
  );
}

describe('ShoppingPageContent', () => {
  it.each<SiteLocale>(['en', 'ar'])('renders exactly one h1 and the key honest statements in %s', (locale) => {
    renderShopping(locale);
    const t = getShoppingCopy(locale);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();

    // Privacy: third-party provider, no permanent storage, time-based auto-delete.
    for (const fact of t.privacyFacts) {
      expect(screen.getByText(fact.title)).toBeInTheDocument();
      expect(screen.getByText(fact.body)).toBeInTheDocument();
    }
    // Must not claim on-demand deletion.
    expect(screen.queryByText(/delete.*(any ?time|on demand)/i)).not.toBeInTheDocument();

    // Reliability: qualified failed-generation credit wording, no unqualified guarantee.
    expect(screen.getByText(t.reliabilityBody)).toBeInTheDocument();
    expect(screen.getByText(/designed not to charge|مصممة بحيث لا تخصم/)).toBeInTheDocument();

    // Catalog claim stays "any product page", never a curated/quality-gated list.
    expect(screen.getByText(t.catalogBody)).toBeInTheDocument();
  });

  it.each<SiteLocale>(['en', 'ar'])('every CTA links to book-call, /try-on, or /pricing — never /sign-up in %s', (locale) => {
    renderShopping(locale);

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).not.toBe('/sign-up');
    }

    expect(
      screen.getAllByRole('link', { name: getShoppingCopy(locale).ctaBookCall })[0],
    ).toHaveAttribute('href', BOOKING_URL);
    expect(
      screen.getAllByRole('link', { name: getShoppingCopy(locale).ctaTryDemo })[0],
    ).toHaveAttribute('href', '/try-on');
    expect(
      screen.getAllByRole('link', { name: getShoppingCopy(locale).ctaViewPricing })[0],
    ).toHaveAttribute('href', '/pricing');
  });

  it('flips to RTL in Arabic', () => {
    const { container } = renderShopping('ar');
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });

  it('scopes the live-demo CTA inside <main>, not just the header nav', () => {
    renderShopping('en');
    const t = getShoppingCopy('en');
    expect(
      within(screen.getByRole('main')).getAllByRole('link', { name: t.ctaTryDemo }).length,
    ).toBeGreaterThan(0);
  });
});
