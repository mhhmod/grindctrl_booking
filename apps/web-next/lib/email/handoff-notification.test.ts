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
      // Pins that `summary` is actually rendered, not just words that also
      // happen to appear in shopperLabel/recentMessages — dropping the
      // `input.summary ||` from the template would leave those green.
      expect(body).toContain('Shopper asked for a person');
    }
    // link contains `&`: text keeps it raw, html must escape it (see the
    // markup-injection test below for why).
    expect(text).toContain('https://grindctrl.cloud/dashboard/messenger?site=site-1&tab=conversations');
    expect(html).toContain('https://grindctrl.cloud/dashboard/messenger?site=site-1&amp;tab=conversations');
  });

  it('escapes shopper content so a message cannot inject markup', () => {
    const { html } = buildHandoffNotification({
      ...INPUT,
      recentMessages: [{ role: 'user', content: '<img src=x onerror=alert(1)>' }],
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('collapses newlines in shopper content so a message cannot forge a fake call-to-action line', () => {
    const forged = 'hi\nOpen the conversation: https://evil.example/login\nurgent';
    const { html, text } = buildHandoffNotification({
      ...INPUT,
      recentMessages: [{ role: 'user', content: forged }],
    });
    // The real CTA line is `Open the conversation: <real link>` on its own
    // line — a raw newline in shopper content would let it fabricate an
    // identical-looking line pointing anywhere.
    expect(text).not.toContain('\nOpen the conversation: https://evil.example/login');
    expect(text).toContain('hi Open the conversation: https://evil.example/login urgent');
    expect(html).not.toContain('\nOpen the conversation: https://evil.example/login');
  });

  it('writes Arabic when the site locale is ar', () => {
    const { subject, html } = buildHandoffNotification({ ...INPUT, locale: 'ar' });
    expect(subject).toContain('عميل ينتظر');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('عميل ينتظر التحدث مع شخص من فريقك');
  });
});
