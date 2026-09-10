import { describe, expect, it } from 'vitest';
import { formatCurrency, formatNumber } from '@/components/pricing/pricing-page-content';

describe('pricing number formatting', () => {
  it.each(['en', 'ar'] as const)('uses Latin digits for %s numbers', (locale) => {
    expect(formatNumber(1234, locale)).toMatch(/1.*234/);
    expect(formatNumber(1234, locale)).not.toMatch(/[٠-٩]/);
  });

  it.each(['en', 'ar'] as const)('uses Latin digits for %s currency', (locale) => {
    expect(formatCurrency(1234, 'EGP', locale, 0)).toMatch(/1.*234/);
    expect(formatCurrency(1234, 'EGP', locale, 0)).not.toMatch(/[٠-٩]/);
  });
});
