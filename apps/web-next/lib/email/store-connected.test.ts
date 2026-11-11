// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildStoreConnectedEmail } from './store-connected';

describe('store connected email', () => {
  it('says what shoppers now see, with one dashboard button and a help line, in English', () => {
    const email = buildStoreConnectedEmail({ storeName: 'Harmony', host: 'harmong-eg.myshopify.com', locale: 'en' });
    expect(email.subject).toBe('Your store is connected: harmong-eg.myshopify.com');
    expect(email.text).toBe([
      'GRINDCTRL', '', 'Hi Harmony, your store is connected.',
      'Shoppers now see Store Chat on every page of harmong-eg.myshopify.com.',
      'The Try-On button shows on your product pages.', '',
      'Open your dashboard: https://grindctrl.cloud/dashboard/store', '',
      'Need a hand? Reply to this email and we will help.', '',
      'You get this email once, when a store first connects.', 'Grind CTRL · grindctrl.cloud',
    ].join('\n'));
    expect(email.html).toContain('<html lang="en" dir="ltr">');
    expect(email.html.match(/<a /g)).toHaveLength(1);
    expect(email.html).toContain('href="https://grindctrl.cloud/dashboard/store"');
    expect(email.html).toContain('<span dir="ltr">harmong-eg.myshopify.com</span>');
    expect(email.html).not.toMatch(/—/);
  });

  it('is right-to-left in Arabic and keeps the address readable inside it', () => {
    const email = buildStoreConnectedEmail({ storeName: 'متجر هارموني', host: 'harmony.example', locale: 'ar' });
    expect(email.subject).toBe('تم ربط متجرك: ⁦harmony.example⁩');
    expect(email.text).toContain('يرى المتسوقون الآن محادثة المتجر في كل صفحات ⁦harmony.example⁩.');
    expect(email.text).toContain('يظهر زر القياس الافتراضي في صفحات منتجاتك.');
    expect(email.html).toContain('<html lang="ar" dir="rtl">');
    expect(email.html).toContain('text-align:right');
    expect(email.html).toContain('افتح لوحة التحكم');
  });

  it('escapes what the merchant typed and strips direction overrides', () => {
    const email = buildStoreConnectedEmail({ storeName: '<b>Shop</b>‮', host: 'shop.example', locale: 'en' });
    expect(email.html).toContain('Hi &lt;b&gt;Shop&lt;/b&gt;, your store is connected.');
    expect(email.text).not.toContain('‮');
  });

  it('falls back to the address when the store has no name', () => {
    expect(buildStoreConnectedEmail({ storeName: '  ', host: 'shop.example', locale: 'en' }).text)
      .toContain('Hi shop.example, your store is connected.');
  });
});
