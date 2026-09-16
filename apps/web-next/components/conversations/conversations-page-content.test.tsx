import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { ConversationsPageContent } from '@/components/conversations/conversations-page-content';
import { getConversationsCopy } from '@/components/conversations/conversations-copy';
import { BOOKING_URL } from '@/lib/booking';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function renderPage(locale: SiteLocale = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={locale}>
      <ConversationsPageContent />
    </LandingLocaleProvider>,
  );
}

describe('ConversationsPageContent', () => {
  it.each<SiteLocale>(['en', 'ar'])('renders exactly one h1 with the hero title in %s', (locale) => {
    renderPage(locale);
    const t = getConversationsCopy(locale);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: t.heroTitle })).toBeInTheDocument();
  });

  it.each<SiteLocale>(['en', 'ar'])('states the honest capability boundaries in %s', (locale) => {
    renderPage(locale);
    const t = getConversationsCopy(locale);

    // Only the storefront web chat channel is live; WhatsApp/Instagram
    // evidence-required, Telegram planned, no intent classifier, no
    // AI-drafts/human-approves mode (phase4-evidence-conversations.json).
    expect(screen.getByText(t.notLiveTitle)).toBeInTheDocument();
    for (const item of t.notLiveItems) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
      expect(screen.getByText(item.note)).toBeInTheDocument();
    }
  });

  it('flips to RTL in Arabic', () => {
    const { container } = renderPage('ar');
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });

  it('CTAs are Book a call, /pricing, and /integrations, never /sign-up', () => {
    renderPage('en');
    const t = getConversationsCopy('en');

    const bookCallLinks = screen.getAllByRole('link', { name: t.bookCall });
    expect(bookCallLinks.length).toBeGreaterThan(0);
    for (const link of bookCallLinks) {
      expect(link).toHaveAttribute('href', BOOKING_URL);
    }

    expect(screen.getAllByRole('link', { name: t.ctaPricing })[0]).toHaveAttribute('href', '/pricing');
    expect(screen.getAllByRole('link', { name: t.ctaIntegrations })[0]).toHaveAttribute('href', '/integrations');

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('/sign-up');
    }
  });

  it('does not link to a live demo, since none exists for this page', () => {
    renderPage('en');
    // Scoped to <main>: SiteHeader/SiteFooter carry the site-wide "Live
    // demo" (/try-on) link on every page; this page's own content must not
    // add another one.
    for (const link of within(screen.getByRole('main')).getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('/try-on');
    }
  });

  it('names the live capabilities inside the "how it works" region', () => {
    renderPage('en');
    const t = getConversationsCopy('en');

    const region = screen.getByRole('region', { name: t.pillarsTitle });
    for (const pillar of t.pillars) {
      expect(within(region).getByText(pillar.title)).toBeInTheDocument();
    }
  });
});
