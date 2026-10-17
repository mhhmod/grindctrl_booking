import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  deleteCalls: [] as Array<[string, unknown]>,
  deleteError: null as null | { message: string },
}));

vi.mock('./db', () => ({
  getMessengerServiceClient: () => ({
    from: () => ({
      insert: db.insert,
      delete: () => {
        const chain = {
          eq: (column: string, value: unknown) => {
            db.deleteCalls.push([`eq:${column}`, value]);
            return chain;
          },
          lt: async (column: string, value: unknown) => {
            db.deleteCalls.push([`lt:${column}`, value]);
            return { error: db.deleteError };
          },
        };
        return chain;
      },
    }),
  }),
}));

import { productHandleFromUrl, recordUnansweredQuestion, redactQuestion } from './questions';

describe('keeping an unanswered question (N8)', () => {
  beforeEach(() => {
    db.insert.mockReset();
    db.insert.mockResolvedValue({ error: null });
    db.deleteCalls = [];
    db.deleteError = null;
  });

  it('strips emails, phone numbers and order numbers', () => {
    expect(redactQuestion('Is order #1043 shipped? Mail me at sara@example.com or call +20 100 123 4567')).toBe(
      'Is order [order] shipped? Mail me at [email] or call [phone]',
    );
    expect(redactQuestion('الطلب رقم ١٠٤٣ فين؟ رقمي ٠١٠٠١٢٣٤٥٦٧')).toBe('الطلب رقم [order] فين؟ رقمي [phone]');
    expect(redactQuestion('el order 1043 wesel?')).toBe('el order [order] wesel?');
    // Sizes, prices and quantities stay: they are the question.
    expect(redactQuestion('Do you have size 42 in 3 colours for EGP 1500?')).toBe('Do you have size 42 in 3 colours for EGP 1500?');
  });

  it('reads the product handle from the page the shopper was on', () => {
    expect(productHandleFromUrl('https://maison.example/products/layla-abaya?variant=1')).toBe('layla-abaya');
    expect(productHandleFromUrl('https://maison.example/ar/collections/new/products/Layla-Abaya')).toBe('layla-abaya');
    expect(productHandleFromUrl('https://maison.example/collections/new')).toBeNull();
    expect(productHandleFromUrl('not a url')).toBeNull();
    expect(productHandleFromUrl(null)).toBeNull();
  });

  it('stores the question and drops this store\'s questions older than 90 days', async () => {
    const now = new Date('2026-10-17T12:00:00.000Z');
    const outcome = await recordUnansweredQuestion({
      siteId: 'site-1',
      conversationId: 'conv-1',
      messageId: 'm-1',
      question: 'Do you ship to Jeddah? sara@example.com',
      language: 'en',
      product: 'Layla abaya',
      pageUrl: 'https://maison.example/products/layla-abaya',
      now,
    });
    expect(outcome).toBe('stored');
    expect(db.insert).toHaveBeenCalledWith({
      widget_site_id: 'site-1',
      conversation_id: 'conv-1',
      message_id: 'm-1',
      question: 'Do you ship to Jeddah? [email]',
      language: 'en',
      product: 'Layla abaya',
      product_handle: 'layla-abaya',
    });
    expect(db.deleteCalls).toEqual([
      ['eq:widget_site_id', 'site-1'],
      ['lt:created_at', '2026-07-19T12:00:00.000Z'],
    ]);
  });

  it('skips a message that was nothing but personal details', async () => {
    const outcome = await recordUnansweredQuestion({
      siteId: 'site-1', conversationId: 'conv-1', messageId: null, question: 'sara@example.com', language: 'en', product: null, pageUrl: null,
    });
    expect(outcome).toBe('skipped');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('reports a database error to the caller', async () => {
    db.insert.mockResolvedValue({ error: { message: 'relation "messenger_unanswered" does not exist' } });
    await expect(
      recordUnansweredQuestion({ siteId: 's', conversationId: 'c', messageId: null, question: 'Do you ship abroad?', language: 'en', product: null, pageUrl: null }),
    ).rejects.toThrow('unanswered insert failed');
  });
});
