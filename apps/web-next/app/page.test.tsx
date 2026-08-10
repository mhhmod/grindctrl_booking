import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SiteLanding } from '@/components/landing/site-landing';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

/* The plan fixture went with the pricing teaser. The landing page no longer
   takes a catalog: it quotes no prices, so it cannot show a currency it has
   not resolved. /pricing owns that. */
function renderLanding(initialLocale: 'en' | 'ar' = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={initialLocale}>
      <SiteLanding />
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
