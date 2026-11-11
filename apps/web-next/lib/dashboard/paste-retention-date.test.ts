// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pasteInstallCopy } from './paste-install-copy';
import { pasteRetentionDate } from './paste-retention-date';

describe('paste retention copy and dates', () => {
  it('uses the owner-approved English and Arabic copy', () => {
    expect(pasteInstallCopy('en').disconnectRetention).toBe("Your shoppers' chats and details are kept for 30 days, then deleted. Reconnect before then to keep them.");
    expect(pasteInstallCopy('ar').disconnectRetention).toBe('نحتفظ بمحادثات المتسوقين وبياناتهم لمدة 30 يومًا ثم نحذفها. أعد الربط قبل ذلك للاحتفاظ بها.');
    expect(pasteInstallCopy('en').deletionDate('December 12, 2026')).toBe('Data will be deleted on December 12, 2026.');
    expect(pasteInstallCopy('ar').deletionDate('12 ديسمبر 2026')).toBe('سيتم حذف البيانات في 12 ديسمبر 2026.');
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
