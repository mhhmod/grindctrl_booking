import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { RoiPageContent } from '@/components/roi/roi-page-content';
import { getRoiCopy } from '@/components/roi/roi-copy';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function renderRoi(locale: 'en' | 'ar' = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={locale}>
      <RoiPageContent initialCurrency="USD" />
    </LandingLocaleProvider>,
  );
}

describe('RoiPageContent', () => {
  it.each(['en', 'ar'] as const)('renders the calculator, results, and disclaimer in %s', (locale) => {
    renderRoi(locale);
    const t = getRoiCopy(locale);

    expect(screen.getByRole('heading', { name: t.title })).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.monthlySessions.label)).toBeInTheDocument();
    expect(screen.getByText(t.resultsTitle)).toBeInTheDocument();
    expect(screen.getByText(t.disclaimer)).toBeInTheDocument();
    expect(screen.getByText(t.noCausation)).toBeInTheDocument();
    // Scoped to <main>: SiteHeader also renders a "Book a call" link now that
    // the page shares the site header instead of its own bespoke one.
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: t.bookCall }),
    ).toHaveAttribute('href', expect.stringMatching(/^https?:/));
  });

  it('flips to RTL in Arabic', () => {
    const { container } = renderRoi('ar');
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });

  it('recalculates results when an input changes', () => {
    renderRoi('en');
    const t = getRoiCopy('en');

    const results = () => within(screen.getByTestId('roi-results'));
    const before = results().getByText(t.baselineRevenue).closest('div')?.textContent;

    fireEvent.change(screen.getByLabelText(t.fields.monthlySessions.label), {
      target: { value: '20000' },
    });

    const after = results().getByText(t.baselineRevenue).closest('div')?.textContent;
    expect(after).not.toBe(before);
  });

  it('shows an inline validation message and hides results for an out-of-range input', () => {
    renderRoi('en');
    const t = getRoiCopy('en');

    expect(screen.getByTestId('roi-results')).toBeInTheDocument();
    expect(screen.queryByText(t.errors['above-100'])).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(t.fields.grossMarginRate.label), {
      target: { value: '150' },
    });

    expect(screen.getByText(t.errors['above-100'])).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(t.fixInputs);
    expect(screen.queryByTestId('roi-results')).not.toBeInTheDocument();
  });

  it('clearing a field triggers the "enter a number" validation message', () => {
    renderRoi('en');
    const t = getRoiCopy('en');

    fireEvent.change(screen.getByLabelText(t.fields.averageOrderValue.label), {
      target: { value: '' },
    });

    expect(screen.getByText(t.errors['not-finite'])).toBeInTheDocument();
  });

  it('resets scenario controls to zero', () => {
    renderRoi('en');
    const t = getRoiCopy('en');

    const improvementInput = screen.getByLabelText(
      t.fields.conversionImprovement.label,
    ) as HTMLInputElement;
    fireEvent.change(improvementInput, { target: { value: '5' } });
    expect(improvementInput.value).toBe('5');

    fireEvent.click(screen.getByRole('button', { name: t.resetScenario }));
    expect(improvementInput.value).toBe('0');
  });
});
