import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { SiteLanding } from '@/components/landing/site-landing';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function renderLanding(initialLocale: 'en' | 'ar' = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={initialLocale}>
      <SiteLanding />
    </LandingLocaleProvider>,
  );
}

describe('SiteLanding', () => {
  it('renders the done-for-you positioning and a booking CTA', () => {
    renderLanding('en');

    expect(
      screen.getByRole('heading', { name: 'We build, run, and maintain your AI.' }),
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
      screen.getByRole('heading', { name: 'نبني ونُشغّل ونصون الذكاء الاصطناعي الخاص بك.' }),
    ).toBeInTheDocument();
  });
});
