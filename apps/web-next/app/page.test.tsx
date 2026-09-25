import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { LandingStory } from '@/components/landing/story/landing-story';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

/* The landing is the v15 paced story now (components/landing/story). The
   heading moved to the new design's line, in both languages, from
   docs/handoff/site-v15/copy/landing.json. The booking and try-on link
   checks are unchanged. */
function renderLanding(initialLocale: 'en' | 'ar' = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={initialLocale}>
      <LandingStory />
    </LandingLocaleProvider>,
  );
}

describe('LandingStory', () => {
  it('renders the try-on positioning and a booking CTA', () => {
    renderLanding('en');

    expect(
      screen.getByRole('heading', { level: 1, name: 'The fitting room your online store was missing.' }),
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
      screen.getByRole('heading', { level: 1, name: 'غرفة القياس التي افتقدها متجرك الإلكتروني.' }),
    ).toBeInTheDocument();
  });
});
