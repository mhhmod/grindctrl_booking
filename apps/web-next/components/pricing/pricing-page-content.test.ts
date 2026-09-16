import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  isPricingRecordVisible,
} from '@/components/pricing/pricing-page-content';
import { getPricingCopy } from '@/components/pricing/pricing-copy';

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

describe('pricing truth gating', () => {
  it('keeps source-backed refund behavior visible with qualification', () => {
    expect(isPricingRecordVisible('pricing.failed-generations-refunded')).toBe(true);
  });

  it('hides owner-review commercial assertions', () => {
    expect(isPricingRecordVisible('pricing.competitor-entry-volume')).toBe(false);
    expect(isPricingRecordVisible('pricing.topups-valid-365-days')).toBe(false);
    expect(isPricingRecordVisible('pricing.manual-payment-same-day-activation')).toBe(false);
    expect(isPricingRecordVisible('pricing.month-to-month-no-contract')).toBe(false);
  });

  it('fails closed for unknown pricing record ids', () => {
    expect(isPricingRecordVisible('pricing.not-registered')).toBe(false);
  });

  it.each(['en', 'ar'] as const)('attaches the 365-day FAQ copy to its owner-review record in %s', (locale) => {
    const rolloverFaq = getPricingCopy(locale).faq.find((item) => /365/.test(item.answer));
    expect(rolloverFaq?.truthRecordId).toBe('pricing.topups-valid-365-days');
    expect(isPricingRecordVisible(rolloverFaq?.truthRecordId ?? '')).toBe(false);
  });

  it.each([
    ['en', /may be available.*confirm/i],
    ['ar', /قد تتوفر.*نؤكدها/],
  ] as const)('qualifies the visible Launch top-up benefit in %s', (locale, qualification) => {
    const benefits = getPricingCopy(locale).plans['launch-v1'].benefits.join(' ');
    expect(benefits).toMatch(qualification);
  });
});
