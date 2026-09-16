import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import {
  CtaRow,
  MarketingPage,
  NotLiveList,
  ProductHero,
  ProductSection,
} from '@/components/marketing/page-primitives';
import { BOOKING_URL } from '@/lib/booking';
import { getLandingDictionary, type SiteLocale } from '@/lib/landing/landing-i18n';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function withLocale(locale: SiteLocale, node: React.ReactNode) {
  return render(
    <LandingLocaleProvider initialLocale={locale}>{node}</LandingLocaleProvider>,
  );
}

describe('MarketingPage', () => {
  it.each<SiteLocale>(['en', 'ar'])('wraps content with the shared header and footer in %s', (locale) => {
    const t = getLandingDictionary(locale);
    withLocale(
      locale,
      <MarketingPage>
        <p>page body</p>
      </MarketingPage>,
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText('page body')).toBeInTheDocument();
    // The shared header/footer bring their own book-call CTA in this locale.
    expect(screen.getAllByRole('link', { name: t.bookCall }).length).toBeGreaterThan(0);
  });
});

describe('ProductHero', () => {
  it.each<SiteLocale>(['en', 'ar'])('renders the eyebrow, heading, lead and CTAs in %s', (locale) => {
    withLocale(
      locale,
      <ProductHero
        eyebrow="Eyebrow"
        title="Hero title"
        lead="Hero lead copy."
        cta={{
          bookCallLabel: 'Book a call',
          section: 'test_hero',
          secondary: [{ href: '/pricing', label: 'View pricing', cta: 'pricing' }],
        }}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Hero title' })).toBeInTheDocument();
    expect(screen.getByText('Hero lead copy.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book a call' })).toHaveAttribute('href', BOOKING_URL);
    expect(screen.getByRole('link', { name: 'View pricing' })).toHaveAttribute('href', '/pricing');
  });
});

describe('ProductSection', () => {
  it('links the heading id to the section for accessible labelling', () => {
    withLocale(
      'en',
      <ProductSection id="proof" eyebrow="Eyebrow" title="Section title" body="Section body">
        <p>child content</p>
      </ProductSection>,
    );

    const region = screen.getByRole('region', { name: 'Section title' });
    expect(within(region).getByText('child content')).toBeInTheDocument();
  });
});

describe('CtaRow', () => {
  it('tracks the book-call click with the given section and cta id', () => {
    render(<CtaRow bookCallLabel="Book a call" section="shopping_hero" />);
    const link = screen.getByRole('link', { name: 'Book a call' });
    expect(link).toHaveAttribute('href', BOOKING_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('never links to /sign-up', () => {
    render(
      <CtaRow
        bookCallLabel="Book a call"
        section="shopping_hero"
        secondary={[{ href: '/try-on', label: 'Try it live', cta: 'try_on' }]}
      />,
    );
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('/sign-up');
    }
  });
});

describe('NotLiveList', () => {
  it('shows each item with its status badge', () => {
    render(
      <NotLiveList
        title="What's not live yet"
        items={[
          { label: 'CRM pipeline', note: 'Preview data only.', status: 'Planned' },
          { label: 'WhatsApp channel', status: 'Evidence required' },
        ]}
      />,
    );

    expect(screen.getByText("What's not live yet")).toBeInTheDocument();
    expect(screen.getByText('CRM pipeline')).toBeInTheDocument();
    expect(screen.getByText('Preview data only.')).toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp channel')).toBeInTheDocument();
    expect(screen.getByText('Evidence required')).toBeInTheDocument();
  });
});
