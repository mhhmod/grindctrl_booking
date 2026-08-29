import { describe, expect, it } from 'vitest';
import { buildHandoffNotification } from './handoff-notification';

const INPUT = {
  storeName: 'Sara’s Store',
  siteId: 'site-1',
  locale: 'en' as const,
  shopperLabel: 'sara@example.com',
  reason: 'shopper_requested_human',
  summary: 'Shopper asked for a person. Last message: "is my parcel lost?"',
  recentMessages: [
    { role: 'user' as const, content: 'hello?' },
    { role: 'assistant' as const, content: 'Hi! How can I help?' },
    { role: 'user' as const, content: 'is my parcel lost?' },
  ],
};

describe('buildHandoffNotification', () => {
  it('names the store in the subject so a multi-store owner can triage', () => {
    expect(buildHandoffNotification(INPUT).subject).toBe('A shopper needs you — Sara’s Store');
  });

  it('includes the summary, the recent messages and a deep link', () => {
    const { html, text } = buildHandoffNotification(INPUT);
    for (const body of [html, text]) {
      expect(body).toContain('is my parcel lost?');
      expect(body).toContain('sara@example.com');
      expect(body).toContain('https://grindctrl.cloud/dashboard/messenger?site=site-1&tab=conversations');
    }
  });

  it('escapes shopper content so a message cannot inject markup', () => {
    const { html } = buildHandoffNotification({
      ...INPUT,
      recentMessages: [{ role: 'user', content: '<img src=x onerror=alert(1)>' }],
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('writes Arabic when the site locale is ar', () => {
    const { subject } = buildHandoffNotification({ ...INPUT, locale: 'ar' });
    expect(subject).toContain('عميل ينتظر');
  });
});
