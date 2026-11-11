import { expect, it } from 'vitest';
import { buildStoreJourneyEmail, type StoreJourneyEvent } from './store-journey';
it.each(['en', 'ar'] as const)('M10/M12/M13/M14: all notices have localized next steps, plain text and the health email look (%s)', (locale) => {
  for (const event of ['signature', 'daily_limit', 'low_looks', 'disconnected'] as StoreJourneyEvent[]) {
    const email = buildStoreJourneyEmail({ event, locale, storeName: 'Store', address: '<shop.example>', looksLeft: 4, resetTime: '2:00', globalLimit: true });
    expect(email.html).toContain(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`);
    expect(email.html).toContain('gc-health-card');
    expect(email.html).toContain('&lt;shop.example&gt;');
    expect(email.html).not.toContain('<script');
    expect(email.text).toContain('<shop.example>');
    expect(email.text).not.toContain('<html');
    expect(email.subject + email.text).not.toContain('—');
    expect(email.text).toMatch(/https:\/\/grindctrl.cloud\/dashboard|mailto:grindctrlnow@gmail.com/);
    if (event === 'daily_limit') expect(email.text).toContain(locale === 'ar' ? 'المشترك' : 'across all stores');
    if (event === 'disconnected') {
      expect(email.text).toContain(locale === 'ar' ? 'رمز الربط' : 'link code');
      expect(email.text).toContain('/dashboard/try-on/setup?shop=');
      expect(email.text).not.toContain('#alerts');
    }
  }
});
