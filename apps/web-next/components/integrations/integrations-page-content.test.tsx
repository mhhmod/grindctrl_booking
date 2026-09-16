import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { IntegrationsPageContent } from '@/components/integrations/integrations-page-content';
import { getIntegrationsCopy } from '@/components/integrations/integrations-copy';
import { BOOKING_URL } from '@/lib/booking';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

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

  it('names Shopify as implemented and never claims WhatsApp/Instagram are available', () => {
    renderPage('en');
    expect(screen.getByText('Implemented')).toBeInTheDocument();
    expect(screen.queryByText(/whatsapp.*(available|ready)/i)).not.toBeInTheDocument();
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
