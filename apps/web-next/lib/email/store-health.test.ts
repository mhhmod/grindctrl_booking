import { describe, expect, it } from 'vitest';
import { buildStoreHealthEmail } from './store-health';
import { STORE_HEALTH_PROBLEMS } from '@/lib/store-health/problems';

describe('store health A7 email rendering', () => {
  for (const locale of ['en', 'ar'] as const) for (const recovery of [false, true]) {
    it(`snapshots ${locale} ${recovery ? 'recovery' : 'problem'}, including subject/dir/link/plain text`, () => {
      const email = buildStoreHealthEmail({ problem: 'code_gone', recovery, locale, address: 'lulus-fashion.myeasyorders.com', storeName: locale === 'ar' ? 'أزياء لولو' : "Lulu's Fashion", sinceDay: locale === 'ar' ? 'يوم الاثنين' : 'Monday' });
      expect(email).toMatchSnapshot();
      expect(email.html).toContain(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`);
      expect(email.html).toContain('max-width:560px');
      expect(email.html).toContain('https://grindctrl.cloud/dashboard/store#alerts');
      expect(email.text).toContain('GRINDCTRL');
      expect(email.text).not.toMatch(/<[^>]*>/);
      expect(email.html).not.toMatch(/<img|<script/);
      if (recovery) { expect(email.html).not.toContain('gc-health-cta"'); expect(email.text).not.toContain('#check-'); }
      else { expect(email.html).toContain('https://grindctrl.cloud/dashboard/store#check-code_gone'); expect(email.text).toContain('#check-code_gone'); }
    });
  }
  it.each(STORE_HEALTH_PROBLEMS)('gives %s a clear problem heading and the matching row link', (problem) => {
    for (const locale of ['en', 'ar'] as const) {
      const email = buildStoreHealthEmail({ problem, recovery: false, locale, address: 'store.example', storeName: 'Store', sinceDay: 'Monday' });
      expect(email.html).toContain(problem === 'tryon_out_of_looks' ? 'mailto:grindctrlnow@gmail.com' : `#check-${problem}`);
      expect(email.text).toContain(problem === 'tryon_out_of_looks' ? 'mailto:grindctrlnow@gmail.com' : `#check-${problem}`);
      expect(email.subject).toContain('store.example');
      expect(email.html).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
      if (problem !== 'code_gone') expect(email.subject).toContain(locale === 'ar' ? 'عن العمل على' : 'stopped working on');
    }
  });
  it('escapes merchant names and prevents header/text line injection', () => {
    const email = buildStoreHealthEmail({ problem: 'code_gone', recovery: false, locale: 'en', address: 'store.example\r\nBcc: evil', storeName: '<img src=x>\nFake CTA', sinceDay: 'Monday' });
    expect(email.html).toContain('&lt;img src=x&gt; Fake CTA');
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.text).toContain('<img src=x> Fake CTA');
  });
});
