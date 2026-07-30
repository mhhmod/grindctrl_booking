import { describe, expect, it } from 'vitest';
import { pickMerchantCopy } from './merchant-copy';

const both = {
  buttonLabel: 'Try it on with AI',
  buttonLabelAr: 'جرّبها بالذكاء الاصطناعي',
  catalogLabel: 'Try on',
  catalogLabelAr: 'جرّب',
  disclaimerText: 'AI preview',
  disclaimerTextAr: 'معاينة بالذكاء الاصطناعي',
};

describe('pickMerchantCopy', () => {
  it('serves English to an English shopper', () => {
    const c = pickMerchantCopy(both, 'en');
    expect(c.buttonLabel).toBe('Try it on with AI');
    expect(c.catalogLabel).toBe('Try on');
    expect(c.disclaimerText).toBe('AI preview');
  });

  it('serves Arabic to an Arabic shopper', () => {
    const c = pickMerchantCopy(both, 'ar');
    expect(c.buttonLabel).toBe('جرّبها بالذكاء الاصطناعي');
    expect(c.catalogLabel).toBe('جرّب');
    expect(c.disclaimerText).toBe('معاينة بالذكاء الاصطناعي');
  });

  it('falls back to the default language when Arabic is not filled in', () => {
    // Most merchants will fill one field and leave the other blank. Showing
    // an empty button is far worse than showing the wrong language.
    const c = pickMerchantCopy({ ...both, buttonLabelAr: null, catalogLabelAr: '' }, 'ar');
    expect(c.buttonLabel).toBe('Try it on with AI');
    expect(c.catalogLabel).toBe('Try on');
  });

  it('treats whitespace-only Arabic as not filled in', () => {
    const c = pickMerchantCopy({ ...both, buttonLabelAr: '   ' }, 'ar');
    expect(c.buttonLabel).toBe('Try it on with AI');
  });

  it('keeps a null disclaimer null so the built-in localized text is used', () => {
    // disclaimerText: null means "use the widget's own translated line".
    // Coercing it to a string would silently disable that.
    const c = pickMerchantCopy(
      { ...both, disclaimerText: null, disclaimerTextAr: null },
      'ar',
    );
    expect(c.disclaimerText).toBeNull();
  });

  it('uses the Arabic disclaimer even when the English one is null', () => {
    const c = pickMerchantCopy({ ...both, disclaimerText: null }, 'ar');
    expect(c.disclaimerText).toBe('معاينة بالذكاء الاصطناعي');
  });
});
