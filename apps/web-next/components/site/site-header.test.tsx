import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteViewerProvider } from '@/components/auth/site-viewer';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import type { SiteViewer } from '@/lib/auth/site-viewer';
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
function renderChrome(locale: SiteLocale = 'en', viewer?: SiteViewer) {
  const t = getLandingDictionary(locale);
  const page = (
    <LandingLocaleProvider initialLocale={locale}>
      <MarketingChrome>
        <p>Page</p>
      </MarketingChrome>
    </LandingLocaleProvider>
  );
  render(viewer ? <SiteViewerProvider viewer={viewer} clerk={false}>{page}</SiteViewerProvider> : page);
  return t;
}

const SIGNED_IN: SiteViewer = { signedIn: true, initials: 'MS', imageUrl: null };

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
    expect(header.getByRole('link', { name: t.navTryOn })).toHaveAttribute('href', '/try-on');
  });

  it.each<SiteLocale>(['en', 'ar'])('opens a %s menu with Sign in first, then the scenes, Ask the store and Pricing', async (locale) => {
    const t = renderChrome(locale);
    fireEvent.click(screen.getByRole('button', { name: t.siteOpenMenu }));
    const dialog = await screen.findByRole('dialog', { name: t.menu });
    const links = within(dialog).getAllByRole('link').filter((link) => link.getAttribute('href') !== BOOKING_URL);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/sign-in',
      '/try-on',
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

/* Item 1 (owner decision 2026-11-12): a signed-in visitor still gets the
   page, with their account where Sign in was. The server decides it, so
   these render the first paint as the server sends it. */
describe('SiteHeader for a signed-in visitor', () => {
  it.each<SiteLocale>(['en', 'ar'])('shows Open dashboard with the avatar instead of Sign in in %s', (locale) => {
    const t = renderChrome(locale, SIGNED_IN);
    const header = within(screen.getByRole('banner'));
    expect(header.queryByRole('link', { name: t.signIn })).not.toBeInTheDocument();
    const dashboardLinks = header.getAllByRole('link', { name: t.openDashboard });
    // Desktop: labelled; phones: the avatar alone, named by aria-label.
    expect(dashboardLinks).toHaveLength(2);
    for (const link of dashboardLinks) {
      expect(link).toHaveAttribute('href', '/dashboard');
      expect(link.querySelector('[data-viewer-avatar]')).toHaveTextContent('MS');
    }
    expect(dashboardLinks[0]).toHaveTextContent(t.openDashboard);
    expect(dashboardLinks[1]).toHaveClass('size-11');
    // Book a call and the menu button keep their own 44px targets.
    expect(header.getAllByRole('link', { name: t.bookCall })[1]).toHaveClass('h-11');
    expect(header.getByRole('button', { name: t.siteOpenMenu })).toHaveClass('size-11');
    expect(screen.getByRole('banner')).toHaveAttribute('data-signed-in');
  });

  it.each<SiteLocale>(['en', 'ar'])('opens a %s menu with Open dashboard as the first, focused row', async (locale) => {
    const t = renderChrome(locale, SIGNED_IN);
    fireEvent.click(screen.getByRole('button', { name: t.siteOpenMenu }));
    const dialog = await screen.findByRole('dialog', { name: t.menu });
    const links = within(dialog).getAllByRole('link').filter((link) => link.getAttribute('href') !== BOOKING_URL);
    expect(links[0]).toHaveAttribute('href', '/dashboard');
    expect(links[0]).toHaveTextContent(t.openDashboard);
    expect(links.some((link) => link.getAttribute('href') === '/sign-in')).toBe(false);
    await waitFor(() => expect(links[0]).toHaveFocus());
  });

  it('draws the photo over the initials, and falls back to the initials if it fails', () => {
    const t = renderChrome('en', { signedIn: true, initials: 'MS', imageUrl: 'https://img.clerk.com/abc' });
    const desktop = within(screen.getByRole('banner')).getAllByRole('link', { name: t.openDashboard })[0];
    const photo = desktop.querySelector('img')!;
    expect(photo).toHaveAttribute('src', 'https://img.clerk.com/abc');
    expect(photo).toHaveAttribute('alt', '');
    fireEvent.error(photo);
    expect(desktop.querySelector('img')).toBeNull();
    expect(desktop).toHaveTextContent('MS');
  });

  it('shows a person mark when the account could not be read', () => {
    const t = renderChrome('en', { signedIn: true, initials: null, imageUrl: null });
    const desktop = within(screen.getByRole('banner')).getAllByRole('link', { name: t.openDashboard })[0];
    expect(desktop.querySelector('[data-viewer-avatar] svg')).not.toBeNull();
  });

  it('hides the phone wordmark below 420px only when the avatar needs its room', () => {
    renderChrome('en', SIGNED_IN);
    const wordmarks = within(screen.getByRole('banner')).getAllByText('GRINDCTRL');
    expect(wordmarks[1]).toHaveClass('max-[419px]:hidden');
    expect(wordmarks[0]).not.toHaveClass('max-[419px]:hidden');
  });

  it('keeps the signed-out header unchanged without a viewer', () => {
    const t = renderChrome('en', { signedIn: false });
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('link', { name: t.signIn })).toHaveAttribute('href', '/sign-in');
    expect(header.queryByRole('link', { name: t.openDashboard })).not.toBeInTheDocument();
    expect(header.getAllByText('GRINDCTRL')[1]).not.toHaveClass('max-[419px]:hidden');
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
