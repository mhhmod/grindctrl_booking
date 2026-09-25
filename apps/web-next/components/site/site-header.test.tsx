import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { BOOKING_URL } from '@/lib/booking';
import { getLandingDictionary, type SiteLocale } from '@/lib/landing/landing-i18n';
import { MarketingChrome } from './marketing-chrome';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

/* Replaces components/landing/site-header.test.tsx, which covered the
   header the v15 design retired. The sign-in guard in AGENTS.md now reads:
   Sign in stays visible and translated in the desktop header beside the
   language switch, and on phones it is the first row of the menu while the
   header keeps a single row (Book a call and the menu button). The menu
   rows are the story scenes (/#try ... /#results), Ask the store and
   Pricing, replacing the old #how, #demo and #benefits anchors. */
function renderChrome(locale: SiteLocale = 'en') {
  const t = getLandingDictionary(locale);
  render(
    <LandingLocaleProvider initialLocale={locale}>
      <MarketingChrome>
        <p>Page</p>
      </MarketingChrome>
    </LandingLocaleProvider>,
  );
  return t;
}

describe('SiteHeader (v15)', () => {
  it.each<SiteLocale>(['en', 'ar'])('keeps a labelled Sign in and Book a call outside the closed menu in %s', (locale) => {
    const t = renderChrome(locale);
    const header = within(screen.getByRole('banner'));
    const signIn = header.getByRole('link', { name: t.signIn });
    expect(signIn).toHaveTextContent(t.signIn);
    expect(signIn).toHaveAttribute('href', '/sign-in');
    const booking = header.getAllByRole('link', { name: t.bookCall })[0];
    expect(booking).toHaveTextContent(t.bookCall);
    expect(booking).toHaveAttribute('href', BOOKING_URL);
    expect(booking).toHaveAttribute('target', '_blank');
    expect(booking).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each<SiteLocale>(['en', 'ar'])('opens a %s menu with Sign in first, then the scenes, Ask the store and Pricing', async (locale) => {
    const t = renderChrome(locale);
    fireEvent.click(screen.getByRole('button', { name: t.siteOpenMenu }));
    const dialog = await screen.findByRole('dialog', { name: t.menu });
    const links = within(dialog).getAllByRole('link').filter((link) => link.getAttribute('href') !== BOOKING_URL);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/sign-in',
      '/#try',
      '/#store',
      '/#ops',
      '/#product',
      '/#results',
      '/#chat',
      '/pricing',
    ]);
    expect(links[0]).toHaveTextContent(t.signIn);
    await waitFor(() => expect(links[0]).toHaveFocus());
    expect(within(dialog).getByRole('link', { name: t.menuTheProduct })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: t.menuAskStore })).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    const t = renderChrome('en');
    const trigger = screen.getByRole('button', { name: t.siteOpenMenu });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes the menu when a row is chosen', async () => {
    const t = renderChrome('en');
    fireEvent.click(screen.getByRole('button', { name: t.siteOpenMenu }));
    const dialog = await screen.findByRole('dialog');
    const signIn = within(dialog).getByRole('link', { name: t.signIn });
    // jsdom cannot navigate; the browser checks cover the destination.
    signIn.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(signIn);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('SiteFooter (v15)', () => {
  it.each<SiteLocale>(['en', 'ar'])('lists the site links, the language pair and the theme toggle in %s', (locale) => {
    const t = renderChrome(locale);
    const footer = within(screen.getByRole('contentinfo'));
    expect(footer.getByRole('link', { name: t.footerHome })).toHaveAttribute('href', '/');
    expect(footer.getByRole('link', { name: t.footerDemo })).toHaveAttribute('href', '/try-on');
    expect(footer.getByRole('link', { name: t.footerPricing })).toHaveAttribute('href', '/pricing');
    expect(footer.getByRole('link', { name: t.footerRoi })).toHaveAttribute('href', '/roi');
    expect(footer.getByRole('link', { name: t.footerSecurity })).toHaveAttribute('href', '/security');
    expect(footer.getByRole('button', { name: 'Theme' })).toBeInTheDocument();
  });
});
