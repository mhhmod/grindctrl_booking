// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pasteInstallCopy } from './paste-install-copy';
import { pasteRetentionDate } from './paste-retention-date';

describe('paste retention copy and dates', () => {
  it('names the old store and same-store reconnect exception in English and Arabic', () => {
    expect(pasteInstallCopy('en').disconnectRetention).toBe('Shopper data is kept for 30 days. Reconnect the same store before then to keep it.');
    expect(pasteInstallCopy('ar').disconnectRetention).toBe('نحتفظ ببيانات المتسوقين 30 يومًا. أعد ربط المتجر نفسه قبلها للاحتفاظ بها.');
    expect(pasteInstallCopy('en').deletionDate('December 12, 2026')).toBe('Shopper data for your old store will be removed on December 12, 2026 unless you reconnect the same store.');
    expect(pasteInstallCopy('ar').deletionDate('12 ديسمبر 2026')).toBe('تُحذف بيانات المتسوقين لمتجرك السابق في 12 ديسمبر 2026 ما لم تُعد ربط المتجر نفسه.');
  });
  it.each(['en', 'ar'] as const)('formats %s dates in Gregorian with Latin digits', locale => {
    const formatted = pasteRetentionDate('2026-12-12T23:59:00Z', locale);
    expect(formatted).toContain('2026'); expect(formatted).toContain('12');
    expect(formatted).not.toMatch(/[٠-٩۰-۹]/);
    expect(formatted).toContain(locale === 'ar' ? 'ديسمبر' : 'December');
  });
  it('hides missing or invalid deadlines', () => {
    for (const date of [null, undefined, '', 'invalid']) expect(pasteRetentionDate(date, 'ar')).toBeNull();
  });
});
