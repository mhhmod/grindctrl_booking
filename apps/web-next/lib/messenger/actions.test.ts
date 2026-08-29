// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ACTION_SENTINEL, normalizeOrderNumber, parseModelTurn } from './actions';

const action = (payload: object) => `${ACTION_SENTINEL}${JSON.stringify(payload)}`;

describe('normalizeOrderNumber', () => {
  it('accepts the shapes a shopper actually types', () => {
    expect(normalizeOrderNumber('1234')).toBe('1234');
    expect(normalizeOrderNumber('#1234')).toBe('1234');
    expect(normalizeOrderNumber('no. 1234')).toBe('1234');
    expect(normalizeOrderNumber('order 1234')).toBe('1234');
    expect(normalizeOrderNumber(1234)).toBe('1234');
  });

  it('rejects nothing-to-work-with and absurd lengths', () => {
    expect(normalizeOrderNumber('ABC')).toBeNull();
    expect(normalizeOrderNumber('')).toBeNull();
    expect(normalizeOrderNumber(null)).toBeNull();
    expect(normalizeOrderNumber('1'.repeat(13))).toBeNull();
  });
});

describe('parseModelTurn', () => {
  it('passes ordinary prose straight through', () => {
    expect(parseModelTurn('  We ship within two days.  ')).toEqual({
      kind: 'prose',
      text: 'We ship within two days.',
    });
  });

  it('reads a well-formed action', () => {
    const parsed = parseModelTurn(action({ action: 'lookup_order', order_number: '#1234', email: 'A@B.com' }));
    expect(parsed).toEqual({
      kind: 'action',
      action: { name: 'lookup_order', orderNumber: '1234', email: 'a@b.com' },
    });
  });

  it('drops arguments the schema does not declare', () => {
    // The loop-hole this closes: a model inventing its own authorization.
    const parsed = parseModelTurn(
      action({
        action: 'lookup_order',
        order_number: '1',
        email: 'a@b.com',
        customer_id: '999',
        verified: true,
        shop: 'other.myshopify.com',
      }),
    );
    if (parsed.kind !== 'action') throw new Error('expected an action');
    expect(Object.keys(parsed.action).sort()).toEqual(['email', 'name', 'orderNumber']);
    expect(JSON.stringify(parsed.action)).not.toContain('999');
  });

  it('rejects a second action in the same turn instead of running the first', () => {
    const twice = `${action({ action: 'lookup_order', order_number: '1' })}\n${action({ action: 'lookup_order', order_number: '2' })}`;
    expect(parseModelTurn(twice)).toEqual({ kind: 'rejected', reason: 'multiple_actions' });
  });

  it('rejects an action name that is not in the registry', () => {
    expect(parseModelTurn(action({ action: 'refund_order', order_number: '1' }))).toEqual({
      kind: 'rejected',
      reason: 'unknown_action',
    });
    expect(parseModelTurn(action({ order_number: '1' }))).toEqual({
      kind: 'rejected',
      reason: 'unknown_action',
    });
  });

  it('rejects malformed payloads rather than guessing at them', () => {
    expect(parseModelTurn(`${ACTION_SENTINEL}not json`)).toEqual({ kind: 'rejected', reason: 'malformed' });
    expect(parseModelTurn(`${ACTION_SENTINEL}{"action":`)).toEqual({ kind: 'rejected', reason: 'malformed' });
    expect(parseModelTurn(ACTION_SENTINEL)).toEqual({ kind: 'rejected', reason: 'malformed' });
  });

  it('keeps the sentinel out of anything a shopper could see', () => {
    const parsed = parseModelTurn(`Sure! ${action({ action: 'lookup_order', order_number: '7', email: 'a@b.com' })}`);
    // Prose around an action is discarded with it: the reply for this turn
    // comes from the second completion, once the server knows the answer.
    expect(parsed.kind).toBe('action');
  });

  it('nulls out unusable arguments instead of passing junk to the executor', () => {
    const parsed = parseModelTurn(action({ action: 'lookup_order', order_number: 'ABC', email: 'a@b.com, c@d.com' }));
    if (parsed.kind !== 'action') throw new Error('expected an action');
    expect(parsed.action.orderNumber).toBeNull();
    expect(parsed.action.email).toBeNull();
  });
});
