import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './ai';
import { DEFAULT_HANDOFF_RULES } from './handoff-rules';
import type { KnowledgeEntry } from './knowledge';
import { KNOWLEDGE_TOTAL_CHARS, matchTerms, planKnowledge } from './retrieval';

/* v16 phase zero item 11: approved answers must actually reach the model.
   Grounding used to be the 30 newest entries cut to 6,000 characters, so an
   answer approved last month fell out once a few newer entries existed. */

const TOPICS = [
  ['Shipping inside Cairo', 'We deliver inside Cairo and Giza within two working days. Orders placed before 2 pm leave the same day.'],
  ['Payment', 'You can pay by card, InstaPay or cash on delivery. Cash on delivery adds a small fee at checkout.'],
  ['Fabric care', 'Wash abayas inside out in cold water and hang them to dry. Iron on low heat with a cloth on top.'],
  ['Our story', 'Maison Noor started in a small workshop in Heliopolis in 2019 and still sews every piece in Cairo.'],
  ['Gift cards', 'Gift cards come in any amount from EGP 500 and never expire. They arrive by email within minutes.'],
  ['Store hours', 'Our Zamalek showroom opens from noon to 10 pm every day except Friday mornings.'],
  ['Materials', 'Our crepe is 100% polyester with a soft matte finish. Linen pieces are 70% linen and 30% viscose.'],
  ['Wholesale', 'Boutiques can buy from us at trade prices. Write to the team with the pieces you want.'],
  ['Sizing help', 'Our pieces run true to size. Between two sizes, pick the larger one for a looser fall.'],
  ['Discount codes', 'One code per order. Codes cannot be combined with sale prices or gift cards.'],
];

const filler = (index: number): string =>
  `${TOPICS[index % TOPICS.length][1]} `.repeat(6) + `Note ${index + 1} about the collection.`;

function entry(overrides: Partial<KnowledgeEntry> & { id: string }): KnowledgeEntry {
  return {
    title: 'Entry',
    content: 'Content',
    source: 'manual',
    source_url: null,
    status: 'active',
    last_synced_at: null,
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Fifty entries: one approved exchange answer from last month, and 49
 *  newer ones about everything else, long enough to fill the budget. */
function fiftyEntries(): KnowledgeEntry[] {
  const newer = Array.from({ length: 49 }, (_, index) =>
    entry({
      id: `k${index + 1}`,
      title: TOPICS[index % TOPICS.length][0],
      content: filler(index),
      updated_at: new Date(Date.UTC(2026, 9, 15, 12, index)).toISOString(),
    }),
  );
  const approved = entry({
    id: 'approved-exchanges',
    title: 'Exchanges',
    source: 'approved',
    content:
      'Yes. Exchanges are free within 30 days if the piece is unworn and still has its tags. Refunds are within 14 days. Send your order number here and the team will arrange it.',
    updated_at: '2026-09-10T09:00:00.000Z',
  });
  // Newest first, as getActiveKnowledge returns them: the approved answer is last.
  return [...newer.reverse(), approved];
}

const PROMPT_BASE = {
  storeName: 'Maison Noor',
  assistantName: 'Noor',
  ai: {
    enabled: true,
    tone: 'friendly' as const,
    instructions: '',
    languageMode: 'auto' as const,
    arabicDialect: 'egyptian' as const,
    escalationEnabled: true,
    handoffRules: DEFAULT_HANDOFF_RULES,
  },
};

describe('ranking knowledge against the shopper\'s message', () => {
  it('used to drop the old approved answer: the newest 30 alone fill the budget', () => {
    const entries = fiftyEntries();
    const newestThirty = entries.slice(0, 30);
    expect(newestThirty.some((item) => item.id === 'approved-exchanges')).toBe(false);
    const recencyChars = newestThirty.reduce((sum, item) => sum + Math.min(item.content.length, 1_200), 0);
    expect(recencyChars).toBeGreaterThan(KNOWLEDGE_TOTAL_CHARS);
  });

  it.each([
    ['Arabic', 'ينفع أبدل المقاس؟'],
    ['Franco', 'momken abadel el size?'],
    ['English', 'Can I exchange it for another size?'],
  ])('puts the old approved answer in the prompt when asked in %s', (_language, question) => {
    const plan = planKnowledge(fiftyEntries(), question);
    expect(plan.placed[0].id).toBe('approved-exchanges');
    expect(plan.placed[0].approved).toBe(true);
    expect(plan.placed[0].cut).toBe(false);

    const prompt = buildSystemPrompt({ ...PROMPT_BASE, locale: 'ar', knowledge: fiftyEntries(), query: question });
    expect(prompt).toContain('[approved answer] (Exchanges) Yes. Exchanges are free within 30 days');
    expect(prompt).toContain("An [approved answer] is the store's own answer to that question");
  });

  it('keeps within the budget, marks every cut, and counts what was left out', () => {
    const plan = planKnowledge(fiftyEntries(), 'ينفع أبدل المقاس؟');
    const used = plan.placed.reduce((sum, item) => sum + item.text.length, 0);
    expect(used).toBeLessThanOrEqual(KNOWLEDGE_TOTAL_CHARS);
    expect(plan.placed.length + plan.leftOut).toBe(50);
    expect(plan.leftOut).toBeGreaterThan(0);
    expect(plan.placed.some((item) => item.cut)).toBe(true);

    const prompt = buildSystemPrompt({ ...PROMPT_BASE, locale: 'ar', knowledge: fiftyEntries(), query: 'ينفع أبدل المقاس؟' });
    expect(prompt).toContain(' […]');
    expect(prompt).toMatch(/Entries ending in \[…\] were shortened to the parts that match this question, and \d+ less relevant entries were left out\./);
  });

  it('spends a long entry\'s room on the passage that matches, not its opening', () => {
    const page = entry({
      id: 'policies',
      title: 'Store policies',
      content: [
        'Welcome to our policies page. '.repeat(30),
        'Shipping to Alexandria takes three working days and costs EGP 80.',
        'Thank you for shopping with us. '.repeat(30),
      ].join(' '),
    });
    const plan = planKnowledge([page], 'How long does shipping to Alexandria take?');
    expect(plan.placed[0].cut).toBe(true);
    expect(plan.placed[0].text).toContain('Shipping to Alexandria takes three working days');
    expect(plan.placed[0].text.length).toBeLessThanOrEqual(1_200);
  });

  it('ranks the matching entry above newer ones', () => {
    const entries = [
      entry({ id: 'new', title: 'Gift cards', content: 'Gift cards never expire.', updated_at: '2026-10-15T00:00:00.000Z' }),
      entry({ id: 'old', title: 'Delivery', content: 'We deliver across Egypt in 3 to 5 days.', updated_at: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(planKnowledge(entries, 'بتشحنوا اسكندرية؟').placed[0].id).toBe('old');
    expect(planKnowledge(entries, 'el sha7n by5od kam yom?').placed[0].id).toBe('old');
  });

  it('keeps today\'s order when nothing matches, newest first', () => {
    const entries = [
      entry({ id: 'a', content: 'Alpha.', updated_at: '2026-10-15T00:00:00.000Z' }),
      entry({ id: 'b', content: 'Beta.', updated_at: '2026-10-14T00:00:00.000Z' }),
    ];
    expect(planKnowledge(entries, 'hello').placed.map((item) => item.id)).toEqual(['a', 'b']);
    expect(planKnowledge(entries, '').placed.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('puts an approved answer that does not match after the ones that do', () => {
    const entries = [
      entry({ id: 'approved-gift', title: 'Gift cards', content: 'Gift cards never expire.', source: 'approved' }),
      entry({ id: 'shipping', title: 'Shipping', content: 'Shipping takes two days.' }),
    ];
    expect(planKnowledge(entries, 'how long is shipping?').placed.map((item) => item.id)).toEqual(['shipping', 'approved-gift']);
  });

  it('reads one question three ways through the shared vocabulary', () => {
    const concept = (text: string) => [...matchTerms(text)].filter((term) => term.startsWith('#')).sort();
    expect(concept('exchange the size')).toEqual(['#exchange', '#size']);
    expect(concept('أبدل المقاس')).toEqual(['#exchange', '#size']);
    expect(concept('abadel el ma2as')).toEqual(['#exchange', '#size']);
  });
});
