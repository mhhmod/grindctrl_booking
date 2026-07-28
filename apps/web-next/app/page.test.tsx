import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SiteLanding } from '@/components/landing/site-landing';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

const plans = [
  {
    planKey: 'free-v1',
    name: 'Free',
    description: null,
    priceMinor: 0,
    currency: 'USD',
    rendersIncluded: 20,
    modelKey: 'lite',
    isFree: true,
    sortOrder: 10,
  },
  {
    planKey: 'launch-v1',
    name: 'Launch',
    description: null,
    priceMinor: 1500,
    currency: 'USD',
    rendersIncluded: 300,
    modelKey: 'lite',
    isFree: false,
    sortOrder: 20,
  },
  {
    planKey: 'dfy-v1',
    name: 'Done-for-you',
    description: null,
    priceMinor: 5900,
    currency: 'USD',
    rendersIncluded: 450,
    modelKey: 'flash',
    isFree: false,
    sortOrder: 30,
  },
];

function renderLanding(initialLocale: 'en' | 'ar' = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={initialLocale}>
      <SiteLanding plans={plans} />
    </LandingLocaleProvider>,
  );
}

describe('SiteLanding', () => {
  it('renders the virtual try-on positioning and a booking CTA', () => {
    renderLanding('en');

    expect(
      screen.getByRole('heading', {
        name: 'Let shoppers see it on themselves before they buy.',
      }),
    ).toBeInTheDocument();

    const bookingLinks = screen.getAllByRole('link', { name: /Book a call/i });
    expect(bookingLinks.length).toBeGreaterThan(0);
    expect(bookingLinks[0]).toHaveAttribute('href', expect.stringMatching(/^(mailto:|https?:)/));
  });

  it('links the live demo to the try-on page', () => {
    const { container } = renderLanding('en');
    const demoLink = container.querySelector('a[href="/try-on"]');
    expect(demoLink).toBeInTheDocument();
  });

  it('switches to Arabic and flips direction to RTL', () => {
    const { container } = renderLanding('ar');
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'دع عملاءك يرون القطعة عليهم قبل الشراء.' }),
    ).toBeInTheDocument();
  });
});
