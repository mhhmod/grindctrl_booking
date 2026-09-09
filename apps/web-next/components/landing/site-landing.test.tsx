import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from './landing-locale';
import { SiteLanding } from './site-landing';
import { getLandingDictionary } from '@/lib/landing/landing-i18n';

// Keep this regression focused on real footer controls, not animated proof
// sections whose layout/motion is covered separately in browser checks.
vi.mock('@/components/landing/ai-operations-chain', () => ({ AiOperationsChain: () => null }));
vi.mock('@/components/landing/automations-showcase', () => ({ AutomationsShowcase: () => null }));
vi.mock('@/components/landing/messaging-channels', () => ({ MessagingChannels: () => null }));
vi.mock('@/components/landing/render-receipt-figure', () => ({ RenderReceiptFigure: () => null }));
vi.mock('@/components/landing/collaborations-marquee', () => ({ CollaborationsMarquee: () => null }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));

describe('SiteLanding footer', () => {
  it.each(['en', 'ar'] as const)('reserves launcher clearance without removing %s footer controls', (locale) => {
    render(<LandingLocaleProvider initialLocale={locale}><SiteLanding /></LandingLocaleProvider>);
    const footer = screen.getByRole('contentinfo');
    const copy = getLandingDictionary(locale);

    // Structural guard only: jsdom cannot prove real element separation.
    expect(footer).toHaveClass('pb-24', 'pt-10');
    expect(within(footer).getByRole('link', { name: copy.footerHome })).toHaveAttribute('href', '/');
    expect(within(footer).getByRole('link', { name: copy.footerPricing })).toHaveAttribute('href', '/pricing');
    expect(within(footer).getByRole('button', {
      name: locale === 'en' ? 'Switch to dark mode' : 'التبديل إلى الوضع الداكن',
    })).toBeInTheDocument();

    fireEvent.click(within(footer).getByRole('button', { name: copy.langToggleLabel }));
    const nextCopy = getLandingDictionary(locale === 'en' ? 'ar' : 'en');
    expect(within(footer).getByRole('button', { name: nextCopy.langToggleLabel })).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: nextCopy.footerPricing })).toHaveAttribute('href', '/pricing');
  });
});
