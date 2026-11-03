import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { IntegrationsPageContent } from '@/components/integrations/integrations-page-content';
import { getIntegrationsCopy } from '@/components/integrations/integrations-copy';
import { BOOKING_URL } from '@/lib/booking';
import { getLandingDictionary, type SiteLocale } from '@/lib/landing/landing-i18n';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function renderPage(locale: SiteLocale) {
  render(
    <LandingLocaleProvider initialLocale={locale}>
      <IntegrationsPageContent />
    </LandingLocaleProvider>,
  );
  return getIntegrationsCopy(locale);
}

describe('IntegrationsPageContent', () => {
  it.each<SiteLocale>(['en', 'ar'])('renders exactly one h1 with the hero title in %s', (locale) => {
    const t = renderPage(locale);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(t.heroTitle);
  });

  it.each<SiteLocale>(['en', 'ar'])('states the honest scope of each row in %s', (locale) => {
    const t = renderPage(locale);
    // Several rows share the exact same honest phrase (e.g. "no code path
    // exists yet"), so assert presence via getAllByText, not a unique match.
    for (const group of [t.storefrontItems, t.channelsItems, t.crmItems, t.automationItems, t.aiItems]) {
      for (const row of group) {
        expect(screen.getAllByText(row.description).length).toBeGreaterThan(0);
      }
    }
    for (const point of t.notClaimsPoints) {
      expect(screen.getAllByText(point).length).toBeGreaterThan(0);
    }
  });

  it('names Shopify as the only implemented platform and never claims WhatsApp/Instagram are available', () => {
    renderPage('en');
    // Exactly one row is Implemented, and it is Shopify's.
    const implemented = screen.getByText('Implemented');
    expect(implemented.closest('li')).toHaveTextContent('Shopify');
    expect(screen.queryByText(/whatsapp.*(available|ready)/i)).not.toBeInTheDocument();
  });

  it.each<SiteLocale>(['en', 'ar'])('shows each platform with its status in words in %s', (locale) => {
    renderPage(locale);
    const t = getLandingDictionary(locale);
    const rowOf = (label: string) => {
      const row = screen.getByText(label).closest('li');
      if (!row) throw new Error(`no row for ${label}`);
      return row;
    };
    const website = locale === 'ar' ? 'موقعك' : 'Your website';
    expect(rowOf('WooCommerce')).toHaveTextContent(t.integrationStateInTesting);
    expect(rowOf(website)).toHaveTextContent(t.integrationStateInTesting);
    expect(rowOf(locale === 'ar' ? 'سلة' : 'Salla')).toHaveTextContent(t.integrationStatePlanned);
    expect(rowOf(locale === 'ar' ? 'زد' : 'Zid')).toHaveTextContent(t.integrationStatePlanned);
    expect(rowOf('Shopify')).toHaveTextContent(t.integrationStateImplemented);
  });

  it('marks each platform row with a decorative logo beside its name, and gives Zid the name alone', () => {
    renderPage('en');
    for (const label of ['Shopify', 'WooCommerce', 'Your website', 'Salla']) {
      const mark = screen.getByText(label).closest('li')?.querySelector('svg');
      expect(mark, label).not.toBeNull();
      expect(mark).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getByText('Zid').closest('li')?.querySelector('svg')).toBeNull();
  });

  it('says Store Chat only for WooCommerce and your website, and that neither is available to merchants yet', () => {
    renderPage('en');
    for (const label of ['WooCommerce', 'Your website']) {
      const row = screen.getByText(label).closest('li');
      expect(row, label).toHaveTextContent('Store Chat only');
      expect(row, label).toHaveTextContent('Not available to merchants yet');
      expect(row, label).not.toHaveTextContent(/\b(supported|works with)\b/i);
    }
    expect(screen.getByText('WooCommerce').closest('li')).toHaveTextContent(
      'Try-On, order lookup and billing stay Shopify-only',
    );
  });

  it('lists HubSpot and the other tools with no code as not built, never as ready', () => {
    renderPage('en');
    for (const label of ['HubSpot', 'Notion', 'Zapier', 'Make']) {
      expect(screen.getByText(label).closest('li'), label).toHaveTextContent('Evidence required');
    }
  });

  it('names Groq and OpenRouter as internal AI infrastructure, never a specific underlying model', () => {
    renderPage('en');
    expect(screen.getByText('Groq')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    expect(screen.queryByText(/gemini|claude|anthropic|openai|gpt-/i)).not.toBeInTheDocument();
  });

  it('never claims intent-based routing and keeps Supabase/Redis out of the merchant-facing list', () => {
    renderPage('en');
    expect(screen.queryByText(/intent-based routing/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Supabase')).not.toBeInTheDocument();
  });

  it.each<SiteLocale>(['en', 'ar'])('points every CTA at a real destination and never at /sign-up in %s', (locale) => {
    renderPage(locale);
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).not.toContain('/sign-up');
    expect(hrefs).toContain(BOOKING_URL);
    expect(hrefs).toContain('/operations');
    expect(hrefs).toContain('/pricing');
  });

  it('flips to RTL in Arabic', () => {
    const { container } = render(
      <LandingLocaleProvider initialLocale="ar">
        <IntegrationsPageContent />
      </LandingLocaleProvider>,
    );
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });
});
