import { describe, expect, it } from 'vitest';
import { parseCart } from './cart';
import {
  DEFAULT_HANDOFF_RULES,
  isBigCart,
  mergeTags,
  normalizeHandoffRules,
  ruleHandoffReason,
  tagsFor,
} from './handoff-rules';

const line = (quantity: number, priceMinor = 50_000) => ({ handle: 'layla', variantId: '42', title: 'Layla', quantity, priceMinor });

describe('the store\'s handoff rules (N25)', () => {
  it('defaults to every rule on, EGP 10,000 and 5 pieces', () => {
    expect(normalizeHandoffRules(undefined)).toEqual(DEFAULT_HANDOFF_RULES);
    expect(DEFAULT_HANDOFF_RULES.bigOrder).toEqual({ enabled: true, amountMinor: 1_000_000, currency: 'EGP', piecesOfOne: 5 });
  });

  it('keeps a merchant\'s choices and refuses values it cannot use', () => {
    const rules = normalizeHandoffRules({
      orderChanges: false,
      upset: false,
      bigOrder: { enabled: false, amountMinor: 500_000, currency: 'sar', piecesOfOne: 10 },
    });
    expect(rules).toEqual({ orderChanges: false, upset: false, bigOrder: { enabled: false, amountMinor: 500_000, currency: 'SAR', piecesOfOne: 10 } });
    const odd = normalizeHandoffRules({ bigOrder: { amountMinor: -1, currency: 'pounds', piecesOfOne: 1.5 } });
    expect(odd.bigOrder).toEqual(DEFAULT_HANDOFF_RULES.bigOrder);
  });

  it('reads a big cart by amount in the same currency, or by pieces of one', () => {
    const rule = DEFAULT_HANDOFF_RULES.bigOrder;
    expect(isBigCart({ totalMinor: 1_000_000, currency: 'EGP', items: [line(1, 1_000_000)] }, rule)).toBe(true);
    expect(isBigCart({ totalMinor: 985_000, currency: 'EGP', items: [line(2)] }, rule)).toBe(false);
    // Another currency is judged on pieces alone, never converted.
    expect(isBigCart({ totalMinor: 5_000_000, currency: 'SAR', items: [line(1)] }, rule)).toBe(false);
    expect(isBigCart({ totalMinor: 250_000, currency: 'SAR', items: [line(5)] }, rule)).toBe(true);
    expect(isBigCart(null, rule)).toBe(false);
  });

  it('names the rule that brings in a person', () => {
    expect(ruleHandoffReason(DEFAULT_HANDOFF_RULES, { intent: 'refund_request' })).toBe('order_change');
    expect(ruleHandoffReason(DEFAULT_HANDOFF_RULES, { intent: 'exchange_request' })).toBe('order_change');
    expect(ruleHandoffReason(DEFAULT_HANDOFF_RULES, { intent: 'order_change' })).toBe('order_change');
    expect(ruleHandoffReason(DEFAULT_HANDOFF_RULES, { intent: 'bulk' })).toBe('big_order');
    expect(ruleHandoffReason(DEFAULT_HANDOFF_RULES, { intent: 'other', bigCart: true })).toBe('big_order');
    expect(ruleHandoffReason(DEFAULT_HANDOFF_RULES, { intent: 'other', upset: true })).toBe('upset');
    expect(ruleHandoffReason(DEFAULT_HANDOFF_RULES, { intent: 'policy_question' })).toBeNull();
    const off = normalizeHandoffRules({ orderChanges: false, upset: false, bigOrder: { enabled: false } });
    expect(ruleHandoffReason(off, { intent: 'refund_request', upset: true, bigCart: true })).toBeNull();
  });

  it('tags what the conversation is about, without repeats', () => {
    expect(tagsFor({ intent: 'exchange_request', language: 'franco' })).toEqual(['exchange', 'franco']);
    expect(tagsFor({ intent: 'other', bigCart: true, upset: true })).toEqual(['bulk_order', 'upset']);
    expect(mergeTags(['franco', 'made_up'], ['exchange', 'franco'])).toEqual(['exchange', 'franco']);
  });
});

describe('the shopper\'s cart', () => {
  const cart = { totalMinor: 985_000, currency: 'egp', items: [{ handle: 'Layla-Abaya', variantId: 4455667788, title: 'Layla abaya, M', quantity: 2, priceMinor: 492_500 }] };

  it('keeps a cart in the contract\'s shape', () => {
    expect(parseCart(cart)).toEqual({
      totalMinor: 985_000,
      currency: 'EGP',
      items: [{ handle: 'layla-abaya', variantId: '4455667788', title: 'Layla abaya, M', quantity: 2, priceMinor: 492_500 }],
    });
  });

  it('refuses anything that is not one', () => {
    expect(parseCart(null)).toBeNull();
    expect(parseCart({ ...cart, totalMinor: 10.5 })).toBeNull();
    expect(parseCart({ ...cart, currency: 'pounds' })).toBeNull();
    expect(parseCart({ ...cart, items: [{ ...cart.items[0], quantity: 0 }] })).toBeNull();
    expect(parseCart({ ...cart, items: [{ ...cart.items[0], variantId: 'abc' }] })).toBeNull();
    expect(parseCart({ ...cart, items: Array.from({ length: 51 }, () => cart.items[0]) })).toBeNull();
  });
});
