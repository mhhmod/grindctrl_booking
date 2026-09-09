import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SiteHeader } from '@/components/landing/site-header';
import { BOOKING_URL } from '@/lib/booking';
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

  it.each<SiteLocale>(['en', 'ar'])(
    'keeps labeled sign-in and booking links outside the closed menu in %s',
    (locale) => {
      const t = renderHeader(locale);
      const header = within(screen.getByRole('banner'));
      const signIn = header.getByRole('link', { name: t.signIn });
      const booking = header.getByRole('link', { name: t.bookCall });

      // An accessible name alone let the old icon-only mobile link pass. The
      // actual localized text must be present and visible in the closed header.
      expect(signIn).toHaveTextContent(t.signIn);
      expect(signIn).toBeVisible();
      expect(signIn).toHaveAttribute('href', '/sign-in');
      expect(booking).toHaveTextContent(t.bookCall);
      expect(booking).toBeVisible();
      expect(booking).toHaveAttribute('href', BOOKING_URL);
      expect(booking).toHaveAttribute('rel', 'noopener noreferrer');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

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

  it.each<SiteLocale>(['en', 'ar'])(
    'keeps the %s menu side, localized close control and focus return',
    async (locale) => {
      const t = renderHeader(locale);
      const trigger = screen.getByRole('button', { name: t.menu });
      trigger.focus();
      fireEvent.click(trigger);

      const dialog = await screen.findByRole('dialog', { name: t.menu });
      expect(dialog).toHaveAttribute('data-side', locale === 'ar' ? 'left' : 'right');
      fireEvent.click(within(dialog).getByRole('button', { name: t.closeMenu }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(trigger).toHaveFocus());
    },
  );

  it('closes the menu when its sign-in link is selected', async () => {
    const t = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: t.menu }));
    const dialog = await screen.findByRole('dialog');
    const signIn = within(dialog).getByRole('link', { name: t.signIn });
    expect(signIn).toHaveAttribute('href', '/sign-in');
    // jsdom cannot navigate; the browser check covers the destination page.
    signIn.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(signIn);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
