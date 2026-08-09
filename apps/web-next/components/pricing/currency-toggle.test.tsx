import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { CurrencyToggle } from '@/components/pricing/currency-toggle';
import type { Currency } from '@/lib/pricing/currency';

function renderToggle(currency: Currency, locale: 'en' | 'ar' = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={locale}>
      <CurrencyToggle currency={currency} />
    </LandingLocaleProvider>,
  );
}

beforeEach(() => {
  refresh.mockClear();
  document.cookie = 'gc-currency=; path=/; max-age=0';
});

describe('CurrencyToggle', () => {
  it('offers the currency you are not currently seeing', () => {
    renderToggle('USD');
    expect(screen.getByRole('button', { name: /EGP/ })).toBeInTheDocument();
  });

  it('offers USD when the page is in EGP', () => {
    renderToggle('EGP');
    expect(screen.getByRole('button', { name: /USD/ })).toBeInTheDocument();
  });

  it('writes the choice to a cookie so it survives the next page load', () => {
    renderToggle('USD');
    fireEvent.click(screen.getByRole('button', { name: /EGP/ }));

    expect(document.cookie).toContain('gc-currency=EGP');
  });

  /* The price is computed on the server, so a refresh is the only thing that
     changes what the visitor sees. Without it the label would flip and the
     numbers would not. */
  it('refreshes so the server re-renders the price', () => {
    renderToggle('USD');
    fireEvent.click(screen.getByRole('button', { name: /EGP/ }));

    expect(refresh).toHaveBeenCalled();
  });

  it('labels itself in Arabic on the Arabic page', () => {
    renderToggle('USD', 'ar');
    expect(screen.getByRole('button', { name: /اعرض الأسعار/ })).toBeInTheDocument();
  });
});
