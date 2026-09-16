import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SecurityPageContent } from '@/components/security/security-page-content';
import { getSecurityCopy, SECURITY_CONTACT_EMAIL } from '@/components/security/security-copy';
import { BOOKING_URL } from '@/lib/booking';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function renderPage(locale: SiteLocale) {
  render(
    <LandingLocaleProvider initialLocale={locale}>
      <SecurityPageContent />
    </LandingLocaleProvider>,
  );
  return getSecurityCopy(locale);
}

describe('SecurityPageContent', () => {
  it.each<SiteLocale>(['en', 'ar'])('renders exactly one h1 with the hero title in %s', (locale) => {
    const t = renderPage(locale);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(t.heroTitle);
  });

  it.each<SiteLocale>(['en', 'ar'])('states retention numbers and the privacy-request note in %s', (locale) => {
    const t = renderPage(locale);
    for (const item of t.photosItems) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
    expect(screen.getByText(t.privacyNote)).toBeInTheDocument();
  });

  it.each<SiteLocale>(['en', 'ar'])('lists every processor with what it receives in %s', (locale) => {
    const t = renderPage(locale);
    for (const row of t.processorsItems) {
      expect(screen.getByText(row.label)).toBeInTheDocument();
      expect(screen.getByText(row.note)).toBeInTheDocument();
    }
  });

  it.each<SiteLocale>(['en', 'ar'])('states what is not in place yet in %s', (locale) => {
    const t = renderPage(locale);
    for (const row of t.notLiveItems) {
      expect(screen.getByText(row.label)).toBeInTheDocument();
    }
  });

  it('never claims a security certification, audit, or uptime guarantee', () => {
    renderPage('en');
    expect(screen.queryByText(/certified|SOC ?2|ISO ?27001|99\.9%|bank-grade|fully secure/i)).not.toBeInTheDocument();
  });

  it.each<SiteLocale>(['en', 'ar'])('points every CTA at booking a call and never at /sign-up in %s', (locale) => {
    renderPage(locale);
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).not.toContain('/sign-up');
    expect(hrefs).toContain(BOOKING_URL);
  });

  it.each<SiteLocale>(['en', 'ar'])('offers the security contact email in %s', (locale) => {
    renderPage(locale);
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toContain(`mailto:${SECURITY_CONTACT_EMAIL}`);
  });

  it('does not present gated privacy automation as live', () => {
    const t = renderPage('en');
    expect(t.privacyNote).toMatch(/switched off/);
    expect(screen.getByText(t.privacyNote)).toBeInTheDocument();
  });

  it('flips to RTL in Arabic', () => {
    const { container } = render(
      <LandingLocaleProvider initialLocale="ar">
        <SecurityPageContent />
      </LandingLocaleProvider>,
    );
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });
});
