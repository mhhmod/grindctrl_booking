import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SiteHeader } from '@/components/landing/site-header';
import { getLandingDictionary, type SiteLocale } from '@/lib/landing/landing-i18n';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function renderHeader(locale: SiteLocale = 'en') {
  const t = getLandingDictionary(locale);
  render(
    <LandingLocaleProvider initialLocale={locale}>
      <SiteHeader locale={locale} t={t} />
    </LandingLocaleProvider>,
  );
  return t;
}

describe('SiteHeader', () => {
  it('offers a menu button', () => {
    const t = renderHeader();
    expect(screen.getByRole('button', { name: t.menu })).toBeInTheDocument();
  });

  it('keeps the booking CTA reachable without opening the menu', () => {
    const t = renderHeader();
    const cta = screen.getByRole('link', { name: t.bookCall });
    expect(cta.className).not.toContain('hidden');
  });

  /* Regression guard: the menu button is `lg:hidden`, so when sign-in lived
     only inside the sheet there was no route to it at all above `lg`. This
     link is the desktop route, and it must survive future header edits. */
  it('keeps a sign-in route outside the menu, for widths where the menu is hidden', () => {
    const t = renderHeader();

    const signIn = screen.getByRole('link', { name: t.signIn });
    expect(signIn.className).toContain('lg:inline-flex');
  });

  it('exposes nav, sign in, language and theme once the menu is open', async () => {
    const t = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: t.menu }));

    const sheet = within(await screen.findByRole('dialog'));

    for (const label of [t.navHow, t.navDemo, t.navBenefits, t.navPricing, t.signIn]) {
      expect(sheet.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(sheet.getByRole('button', { name: t.langToggleLabel })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Theme' })).toBeInTheDocument();
  });
});
