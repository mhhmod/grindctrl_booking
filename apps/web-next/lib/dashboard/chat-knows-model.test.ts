import { describe, expect, it } from 'vitest';
import type { KnowledgeEntry } from '@/lib/messenger/knowledge';
import { getChatKnowsCopy } from './chat-knows-copy';
import { parseProductsStatus } from '@/lib/messenger/products-status';
import { buildChatHead, buildPagesAndNotes, buildProductsLine } from './chat-knows-model';

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
  it('isolates a Latin store address inside the Arabic live badge', () => {
    const head = buildChatHead({ active: true, domain: 'harmong-eg.myshopify.com', solved7: 0, handedOff7: 0 }, ar);
    expect(head.badge.label).toBe('تعمل على \u2068harmong-eg.myshopify.com\u2069');
    expect(head.storeUrl).toBe('https://harmong-eg.myshopify.com');
  });
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

  it('says the count, not a percentage, while there are fewer than 5 chats', () => {
    const head = (solved7: number, handedOff7: number, copy = en) => buildChatHead({ active: true, domain: null, solved7, handedOff7 }, copy).subtitle;
    expect(head(1, 0)).toBe('In the last 7 days the assistant answered 1 of 1 chat on its own.');
    expect(head(0, 4)).toBe('In the last 7 days the assistant answered 0 of 4 chats on its own.');
    expect(head(4, 1)).toBe('In the last 7 days the assistant answered 80% of 5 chats on its own.');
    expect(head(1, 0, ar)).toBe('خلال آخر 7 أيام أجاب المساعد بنفسه عن 1 من أصل محادثة واحدة.');
    expect(head(2, 1, ar)).toBe('خلال آخر 7 أيام أجاب المساعد بنفسه عن 2 من أصل 3 محادثات.');
  });

  it('counts chats as Arabic does', () => {
    expect(buildChatHead({ active: true, domain: 'maisonnoor.com', solved7: 6, handedOff7: 2 }, ar).subtitle).toBe(
      'خلال آخر 7 أيام أجاب المساعد بنفسه عن 75% من 8 محادثات.',
    );
    expect(ar.answeredShare(86, 140)).toBe('خلال آخر 7 أيام أجاب المساعد بنفسه عن 86% من 140 محادثة.');
    expect(ar.answeredShare(100, 1)).toBe('خلال آخر 7 أيام أجاب المساعد بنفسه عن 100% من محادثة واحدة.');
  });
});

describe('the Products line', () => {
  const at = '2026-10-22T03:00:00Z';
  it('says what was read, or why not and what happens next, in English and Arabic', () => {
    expect(buildProductsLine({ outcome: 'ok', count: 1, at }, en)).toEqual({ ok: true, text: 'We read 1 product from your store.' });
    expect(buildProductsLine({ outcome: 'ok', count: 42, at }, en)?.text).toBe('We read 42 products from your store.');
    expect(buildProductsLine({ outcome: 'ok', count: 2, at }, ar)?.text).toBe('قرأنا منتجين من متجرك.');
    for (const outcome of ['password_page', 'not_found', 'unreachable', 'rate_limited'] as const) {
      const line = buildProductsLine({ outcome, count: 0, at }, en);
      expect(line?.ok).toBe(false);
      expect(line?.text.length).toBeGreaterThan(20);
      expect(buildProductsLine({ outcome, count: 0, at }, ar)?.text).toMatch(/[؀-ۿ]/);
    }
    // The real reason in plain words, and what still works meanwhile; never "couldn't reach".
    expect(buildProductsLine({ outcome: 'password_page', count: 0, at }, en)?.text).toBe(
      'Your store is password protected, so we can read its products once it opens. Store Chat still answers from your pages and notes.');
    expect(buildProductsLine({ outcome: 'password_page', count: 0, at }, ar)?.text).not.toBe(ar.productsUnreachable);
  });
  it('says nothing when no read is recorded', () => {
    expect(buildProductsLine(null, en)).toBeNull();
  });
  it('trusts only a stored result in the shape this app writes', () => {
    expect(parseProductsStatus({ outcome: 'ok', count: 3, at })).toEqual({ outcome: 'ok', count: 3, at });
    for (const bad of [null, 'ok', {}, { outcome: 'bogus', count: 1, at }, { outcome: 'ok', count: -1, at }, { outcome: 'ok', count: 1, at: 'x' }]) {
      expect(parseProductsStatus(bad)).toBeNull();
    }
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
