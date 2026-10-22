import { describe, expect, it } from 'vitest';
import type { KnowledgeEntry } from '@/lib/messenger/knowledge';
import { getChatKnowsCopy } from './chat-knows-copy';
import { buildChatHead, buildPagesAndNotes } from './chat-knows-model';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const DAY = 86_400_000;
const en = getChatKnowsCopy('en');
const ar = getChatKnowsCopy('ar');

function entry(over: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: 'k1',
    title: 'Shipping and returns',
    content: 'We ship in 2 days.',
    source: 'manual',
    source_url: null,
    status: 'active',
    last_synced_at: null,
    updated_at: new Date(NOW - 2 * 3_600_000).toISOString(),
    ...over,
  };
}

describe('the Store Chat head', () => {
  it('says where it is live and how much the assistant answered on its own', () => {
    expect(buildChatHead({ active: true, domain: 'https://MaisonNoor.com/', solved7: 120, handedOff7: 20 }, en)).toEqual({
      badge: { live: true, label: 'Live on maisonnoor.com' },
      subtitle: 'In the last 7 days the assistant answered 86% of 140 chats on its own.',
      storeUrl: 'https://maisonnoor.com',
    });
  });

  it('says it is hidden, says plainly when there were no chats, and leaves the line out when the numbers are unknown', () => {
    expect(buildChatHead({ active: false, domain: null, solved7: 0, handedOff7: 0 }, en)).toEqual({
      badge: { live: false, label: 'Hidden from shoppers' },
      subtitle: 'No finished chats in the last 7 days yet.',
      storeUrl: null,
    });
    expect(buildChatHead({ active: true, domain: 'not a domain', solved7: null, handedOff7: null }, en)).toEqual({
      badge: { live: true, label: 'Live on your store' },
      subtitle: null,
      storeUrl: null,
    });
  });

  it('counts chats as Arabic does', () => {
    expect(buildChatHead({ active: true, domain: 'maisonnoor.com', solved7: 3, handedOff7: 1 }, ar).subtitle).toBe(
      'خلال آخر 7 أيام أجاب المساعد بنفسه عن 75% من 4 محادثات.',
    );
    expect(ar.answeredShare(86, 140)).toBe('خلال آخر 7 أيام أجاب المساعد بنفسه عن 86% من 140 محادثة.');
    expect(ar.answeredShare(100, 1)).toBe('خلال آخر 7 أيام أجاب المساعد بنفسه عن 100% من محادثة واحدة.');
  });
});

describe('Pages and notes', () => {
  it('lists the notes and pages added by link, with how fresh each is', () => {
    const pages = buildPagesAndNotes(
      [
        entry({ id: 'n1', title: 'Fabric care', updated_at: new Date(NOW - 3 * DAY).toISOString() }),
        entry({ id: 'p1', title: 'FAQ', source: 'url', source_url: 'https://maisonnoor.com/pages/faq', last_synced_at: new Date(NOW - 5 * 60_000).toISOString() }),
        entry({ id: 'p2', title: 'Shipping', source: 'url', source_url: 'https://maisonnoor.com/pages/shipping', status: 'disabled', last_synced_at: null }),
      ],
      en,
      NOW,
    );
    expect(pages.summary).toBe('Fabric care, FAQ and 1 more');
    expect(pages.rows).toEqual([
      { id: 'n1', title: 'Fabric care', kind: 'note', host: null, active: true, freshness: 'Updated 3 days ago', canResync: false },
      { id: 'p1', title: 'FAQ', kind: 'page', host: 'maisonnoor.com', active: true, freshness: 'Synced today', canResync: true },
      { id: 'p2', title: 'Shipping', kind: 'page', host: 'maisonnoor.com', active: false, freshness: 'Not synced yet', canResync: true },
    ]);
  });

  it('leaves out the sources that get their own cards later, and says when there is nothing yet', () => {
    const pages = buildPagesAndNotes([entry({ source: 'approved' }), entry({ source: 'policy' }), entry({ source: 'product' })], en, NOW);
    expect(pages.rows).toEqual([]);
    expect(pages.summary).toBe(en.pagesAndNotesNone);
  });

  it('names two titles in words', () => {
    expect(buildPagesAndNotes([entry({ id: 'a', title: 'FAQ' }), entry({ id: 'b', title: 'Fabric care' })], en, NOW).summary).toBe('FAQ and Fabric care');
    expect(buildPagesAndNotes([entry({ id: 'a', title: 'FAQ' }), entry({ id: 'b', title: 'العناية بالقماش' })], ar, NOW).summary).toBe('FAQ والعناية بالقماش');
  });

  it('reads in Arabic with counts that agree and Western digits', () => {
    const three = [1, 2, 3, 4, 5].map((n) => entry({ id: `n${n}`, title: `ملاحظة ${n}`, updated_at: new Date(NOW - 4 * DAY).toISOString() }));
    const pages = buildPagesAndNotes(three, ar, NOW);
    expect(pages.summary).toBe('ملاحظة 1، ملاحظة 2 و3 أخرى');
    expect(pages.rows[0].freshness).toBe('حُدّثت قبل 4 أيام');
    expect(ar.syncedDaysAgo(2)).toBe('تمت المزامنة قبل يومين');
    expect(ar.syncedDaysAgo(11)).toBe('تمت المزامنة قبل 11 يوماً');
    expect(JSON.stringify(pages)).not.toMatch(/[٠-٩]/);
  });
});
