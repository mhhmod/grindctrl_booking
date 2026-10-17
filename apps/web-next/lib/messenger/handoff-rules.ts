/* The store's rules for bringing in a person (N25, flag n25_handoff_rules).

   Asking for a person is always on and lives in handoff-intent.ts. These
   are the others: requests to refund, exchange or change an order, a
   shopper who seems upset, and big orders. The server decides from them;
   the model only reports what the message was about. */

import type { ShopperCart } from './cart';
import type { ShopperIntent } from './handoff-intent';
import type { ShopperLanguage } from './language';
import type { HandoffRules } from './types';

export const DEFAULT_HANDOFF_RULES: HandoffRules = {
  orderChanges: true,
  upset: true,
  // EGP 10,000, or 5 or more of one piece (copy: "Over EGP 10,000, or 5 or
  // more of one piece").
  bigOrder: { enabled: true, amountMinor: 1_000_000, currency: 'EGP', piecesOfOne: 5 },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function boundedInt(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function normalizeHandoffRules(raw: unknown): HandoffRules {
  const source = record(raw);
  const big = record(source.bigOrder);
  const defaults = DEFAULT_HANDOFF_RULES.bigOrder;
  const currency = typeof big.currency === 'string' ? big.currency.trim().toUpperCase() : '';
  return {
    orderChanges: source.orderChanges !== false,
    upset: source.upset !== false,
    bigOrder: {
      enabled: big.enabled !== false,
      amountMinor: boundedInt(big.amountMinor, 1, 100_000_000_00, defaults.amountMinor),
      currency: /^[A-Z]{3}$/.test(currency) ? currency : defaults.currency,
      piecesOfOne: boundedInt(big.piecesOfOne, 2, 10_000, defaults.piecesOfOne),
    },
  };
}

export type HandoffRuleReason = 'order_change' | 'upset' | 'big_order';

/** What the message was about, from the pre-check or the model's verdict. */
export type MessageIntent = ShopperIntent;

const ORDER_INTENTS = new Set<MessageIntent>(['refund_request', 'exchange_request', 'order_change']);

/** A cart over the amount in the rule's currency, or holding enough of one
 *  piece. A cart in another currency is judged on pieces alone. */
export function isBigCart(cart: ShopperCart | null | undefined, rule: HandoffRules['bigOrder']): boolean {
  if (!cart) return false;
  if (cart.currency === rule.currency && cart.totalMinor >= rule.amountMinor) return true;
  return cart.items.some((line) => line.quantity >= rule.piecesOfOne);
}

/** Which rule, if any, brings in a person. */
export function ruleHandoffReason(
  rules: HandoffRules,
  signal: { intent?: MessageIntent | null; upset?: boolean; bigCart?: boolean },
): HandoffRuleReason | null {
  if (rules.orderChanges && signal.intent && ORDER_INTENTS.has(signal.intent)) return 'order_change';
  if (rules.bigOrder.enabled && (signal.intent === 'bulk' || signal.bigCart)) return 'big_order';
  if (rules.upset && signal.upset) return 'upset';
  return null;
}

/** Tags the Inbox shows and filters on (metadata.tags). */
export type ConversationTag = 'refund' | 'exchange' | 'order_change' | 'bulk_order' | 'upset' | 'franco';

export const CONVERSATION_TAGS: readonly ConversationTag[] = [
  'refund',
  'exchange',
  'order_change',
  'bulk_order',
  'upset',
  'franco',
];

export function tagsFor(signal: {
  intent?: MessageIntent | null;
  upset?: boolean;
  bigCart?: boolean;
  language?: ShopperLanguage;
}): ConversationTag[] {
  const tags: ConversationTag[] = [];
  if (signal.intent === 'refund_request') tags.push('refund');
  if (signal.intent === 'exchange_request') tags.push('exchange');
  if (signal.intent === 'order_change') tags.push('order_change');
  if (signal.intent === 'bulk' || signal.bigCart) tags.push('bulk_order');
  if (signal.upset) tags.push('upset');
  if (signal.language === 'franco') tags.push('franco');
  return tags;
}

/** Known tags only, in a stable order, without repeats. */
export function mergeTags(existing: unknown, added: readonly ConversationTag[]): ConversationTag[] {
  const have = new Set<string>(Array.isArray(existing) ? existing.filter((tag) => typeof tag === 'string') : []);
  for (const tag of added) have.add(tag);
  return CONVERSATION_TAGS.filter((tag) => have.has(tag));
}

/** Where a message goes before the model runs: to the team, or to the
 *  assistant. Asking for a person always goes to the team; the store's
 *  other rules count only while n25_handoff_rules is on. */
export function routeBeforeModel(
  intent: MessageIntent,
  rules: HandoffRules,
  options: { rulesOn: boolean },
): 'team' | 'assistant' {
  if (intent === 'person') return 'team';
  if (!options.rulesOn) return 'assistant';
  return ruleHandoffReason(rules, { intent }) ? 'team' : 'assistant';
}
