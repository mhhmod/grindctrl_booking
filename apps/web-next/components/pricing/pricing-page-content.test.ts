import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  getPlanCopyKey,
  isPricingRecordVisible,
  isRecommendedPlan,
  meterPercent,
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
    const benefits = getPricingCopy(locale).plans['launch-v1'].features.map((feature) => feature.text).join(' ');
    expect(benefits).toMatch(qualification);
  });

  it.each(['en', 'ar'] as const)('keeps the done-for-you setup row behind the managed-setup record in %s', (locale) => {
    const pro = getPricingCopy(locale).plans['pro-v1'];
    const setup = pro.features.find((feature) => feature.truthRecordId === 'service.managed-setup');
    expect(setup).toBeDefined();
    expect(isPricingRecordVisible('service.managed-setup')).toBe(false);
  });
});

describe('pricing plan mapping', () => {
  it('maps every live plan family to its copy entry', () => {
    expect(getPlanCopyKey('free-v2')).toBe('free-v1');
    expect(getPlanCopyKey('launch-v1-egp')).toBe('launch-v1');
    expect(getPlanCopyKey('growth-v1')).toBe('growth-v1');
    expect(getPlanCopyKey('growth-v1-egp')).toBe('growth-v1');
    expect(getPlanCopyKey('pro-v1-egp')).toBe('pro-v1');
    expect(getPlanCopyKey('dfy-v1')).toBe('dfy-v1');
    expect(getPlanCopyKey('something-else')).toBe('something-else');
  });

  it('gives Growth and Pro approved Arabic names instead of the English database names', () => {
    const ar = getPricingCopy('ar');
    expect(ar.plans['growth-v1'].name).toBe('نمو');
    expect(ar.plans['growth-v1'].description).toBe('للمتاجر التي تجاوزت شهرها الأول.');
    expect(ar.plans['pro-v1'].name).toBe('احترافي');
    expect(ar.plans['growth-v1'].button).toBe('احجز مكالمة عن خطة نمو');
    expect(ar.plans['pro-v1'].button).toBe('احجز مكالمة عن الخطة الاحترافية');
  });

  it('recommends the Launch family only', () => {
    expect(isRecommendedPlan({ planKey: 'launch-v1' })).toBe(true);
    expect(isRecommendedPlan({ planKey: 'launch-v1-egp' })).toBe(true);
    expect(isRecommendedPlan({ planKey: 'growth-v1' })).toBe(false);
    expect(isRecommendedPlan({ planKey: 'free-v2' })).toBe(false);
  });

  it('draws the try-ons meter against the largest plan, never under 3%', () => {
    expect(meterPercent(650, 650)).toBe(100);
    expect(meterPercent(350, 650)).toBe(54);
    expect(meterPercent(15, 650)).toBe(3);
    expect(meterPercent(0, 650)).toBe(3);
    expect(meterPercent(10, 0)).toBe(3);
  });
});
