import { describe, expect, it } from 'vitest';
import { pasteInstallCopy } from './paste-install-copy';

const OUTCOMES = ['awaiting_visit', 'not_found', 'outdated_code', 'wrong_site', 'password_required', 'password_rejected', 'unreachable',
  'rate_limited', null] as const;

describe('Shopify step four copy', () => {
  it.each(['en', 'ar'])('names a product page and what appears there once the code is found (%s)', (locale) => {
    const copy = pasteInstallCopy(locale);
    const found = copy.shopCheck('awaiting_visit', null);
    expect(found).toContain(locale === 'ar' ? 'صفحة منتج' : 'product page');
    expect(found).toContain(locale === 'ar' ? 'دردشة المتجر' : 'Store Chat');
    expect(found).toContain(locale === 'ar' ? 'زر التجربة الافتراضية' : 'Try-On button');
    expect(copy.waitingHintShopify).toContain(locale === 'ar' ? 'صفحة منتج' : 'product page');
  });

  it.each(['en', 'ar'])('tells a password-protected store what to do and what shoppers see (%s)', (locale) => {
    const copy = pasteInstallCopy(locale);
    expect(copy.shopCheck('password_required', null)).toContain(locale === 'ar' ? 'مرة واحدة' : 'once');
    expect(copy.passwordPageNote).toContain(locale === 'ar' ? 'التفضيلات' : 'Online Store, then Preferences');
  });

  it.each(['en', 'ar'])('keeps the house style: no em dashes (%s)', (locale) => {
    const copy = pasteInstallCopy(locale);
    const lines = [...OUTCOMES.map((outcome) => copy.shopCheck(outcome, 30)), copy.waitingHintShopify, copy.openProductPage, copy.passwordPageNote];
    for (const line of lines) expect(line).not.toMatch(/—/);
  });
});
