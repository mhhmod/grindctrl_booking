// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveMessengerConfig } from '@/lib/messenger/config';
import type { MessengerConfig } from '@/lib/messenger/types';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import { getChatStudioCopy } from './chat-studio-copy';
import {
  changedFields,
  changedSections,
  hidePatch,
  hoursLine,
  minutesSince,
  previewPayload,
  reviewRows,
  withPattern,
  withRecipient,
} from './chat-studio-model';

const en = getChatStudioCopy('en');
const ar = getChatStudioCopy('ar');
const PUBLISHED = resolveMessengerConfig({});

function edit(change: (config: MessengerConfig) => void): MessengerConfig {
  const next = structuredClone(PUBLISHED);
  change(next);
  return next;
}

describe('what changed against the published version', () => {
  it('lists each changed field and its section, and nothing for an unchanged draft', () => {
    expect(changedFields(PUBLISHED, PUBLISHED)).toEqual([]);
    const draft = edit((c) => {
      c.appearance.launcherIcon = 'help';
      c.ai.tone = 'warm';
    });
    expect(changedFields(PUBLISHED, draft).map((f) => `${f.section}.${f.key}`)).toEqual(['appearance.launcherIcon', 'ai.tone']);
    expect(changedSections(PUBLISHED, draft)).toEqual(['appearance', 'ai']);
  });

  it('names the review rows as the cards do, in the page’s language', () => {
    const draft = edit((c) => {
      c.appearance.position = 'bottom-left';
      c.behaviour.excludePatterns = ['/pages/wholesale'];
      c.behaviour.targetingMode = 'custom';
      c.behaviour.welcomeTitle = { en: 'Welcome to Maison Noor', ar: 'أهلاً بك في ميزون نور' };
      c.ai.enabled = false;
      c.notifications.recipients = ['hana@maisonnoor.com'];
    });
    expect(reviewRows(PUBLISHED, draft, en, 'en')).toEqual([
      { key: 'appearance.position', label: 'Chat bubble', before: 'Bottom right', after: 'Bottom left' },
      expect.objectContaining({ key: 'behaviour.welcomeTitle', label: 'Welcome screen: Title', after: 'Welcome to Maison Noor' }),
      { key: 'behaviour.excludePatterns', label: 'Hide on some pages', before: 'Empty', after: '/pages/wholesale' },
      { key: 'ai.enabled', label: 'Assistant replies', before: 'On', after: 'Off' },
      { key: 'notifications.recipients', label: 'Alert emails', before: 'Empty', after: 'hana@maisonnoor.com' },
    ]);
    const arabic = reviewRows(PUBLISHED, draft, ar, 'ar');
    expect(arabic[0]).toEqual({ key: 'appearance.position', label: 'فقاعة الدردشة', before: 'أسفل اليمين', after: 'أسفل اليسار' });
    expect(arabic[1].after).toBe('أهلاً بك في ميزون نور');
  });

  it('reads opening hours as one sentence, and the handoff rules by name', () => {
    const draft = edit((c) => {
      c.behaviour.availabilityMode = 'hours';
      c.behaviour.availabilityTimezone = 'Africa/Cairo';
      c.behaviour.availabilityHours = [0, 1, 2].map((day) => ({ day, startMinute: 600, endMinute: 1320 }));
      c.ai.handoffRules = { ...c.ai.handoffRules, upset: false, bigOrder: { ...c.ai.handoffRules.bigOrder, enabled: false } };
    });
    const rows = reviewRows(PUBLISHED, draft, en, 'en');
    expect(rows.filter((row) => row.label === 'Opening hours')).toHaveLength(1);
    expect(rows.find((row) => row.label === 'Opening hours')?.after).toMatch(/10 am to 10 pm/);
    expect(rows.find((row) => row.key === 'ai.handoffRules')).toMatchObject({
      before: 'Requests to refund, exchange or change an order, The shopper seems upset, Big orders',
      after: 'Requests to refund, exchange or change an order',
    });
  });
});

describe('the lists on the cards', () => {
  it('keeps page address parts in lower case, once each, and sets the mode from the list', () => {
    expect(withPattern(['/account'], ' /Pages/Wholesale ')).toEqual(['/account', '/pages/wholesale']);
    expect(withPattern(['/account'], '/ACCOUNT')).toBeNull();
    expect(withPattern([], '  ')).toBeNull();
    expect(hidePatch(['/account'])).toEqual({ excludePatterns: ['/account'], targetingMode: 'custom' });
    expect(hidePatch([])).toEqual({ excludePatterns: [], targetingMode: 'everywhere' });
  });

  it('takes up to five full email addresses for alerts', () => {
    expect(withRecipient([], ' Hana@MaisonNoor.com ')).toEqual({ ok: true, recipients: ['hana@maisonnoor.com'] });
    expect(withRecipient([], 'hana@')).toEqual({ ok: false, reason: 'bad' });
    expect(withRecipient(['a@x.co'], 'a@x.co')).toEqual({ ok: true, recipients: ['a@x.co'] });
    expect(withRecipient(['a@x.co', 'b@x.co', 'c@x.co', 'd@x.co', 'e@x.co'], 'f@x.co')).toEqual({ ok: false, reason: 'full' });
  });
});

describe('hours, the storefront check and the preview', () => {
  it('says the opening hours in words, as Settings does', () => {
    expect(hoursLine(PUBLISHED.behaviour, 'en')).toBe('Always open.');
    expect(hoursLine({ ...PUBLISHED.behaviour, availabilityMode: 'hours', availabilityHours: [] }, 'en')).toBe('No opening hours are set.');
    expect(hoursLine({ ...PUBLISHED.behaviour, availabilityMode: 'always' }, 'ar')).toBe('مفتوح دائماً.');
  });

  it('counts minutes since the storefront check', () => {
    expect(minutesSince(null, 0)).toBeNull();
    expect(minutesSince('2026-10-22T12:00:00Z', Date.parse('2026-10-22T12:02:30Z'))).toBe(2);
    expect(en.ago(2)).toBe('2 min ago');
    expect(ar.ago(2)).toBe('قبل دقيقتين');
  });

  it('draws the draft in the preview', () => {
    const payload = { active: true, aiEnabled: true, attachmentsEnabled: false, appearance: PUBLISHED.appearance, behaviour: { ...PUBLISHED.behaviour } } as unknown as PublicMessengerPayload;
    const draft = edit((c) => {
      c.appearance.accentColor = '#123456';
      c.ai.enabled = false;
      c.behaviour.welcomeTitle = { en: 'Hello', ar: 'أهلاً' };
    });
    const shown = previewPayload(payload, draft);
    expect(shown.appearance.accentColor).toBe('#123456');
    expect(shown.aiEnabled).toBe(false);
    expect(shown.behaviour.welcomeTitle).toEqual({ en: 'Hello', ar: 'أهلاً' });
  });

  it('counts changes in Arabic', () => {
    expect([1, 2, 3, 11].map(ar.notLive)).toEqual(['تغيير واحد لم يُنشر بعد', 'تغييران لم يُنشرا بعد', '3 تغييرات لم تُنشر بعد', '11 تغييراً لم يُنشر بعد']);
    expect(en.notLive(2)).toBe('2 changes not live yet');
  });
});
