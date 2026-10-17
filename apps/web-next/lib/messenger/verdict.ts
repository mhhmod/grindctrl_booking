/* The small verdict the model returns with each reply (N8 and N25, phase
   zero items 10 and 11). It says whether the store's data answered the
   question, what the message was about, which product, and whether the
   shopper seems upset. The server decides what happens from it; the
   shopper never sees it. Taught only while n25_handoff_rules or
   n8_unanswered_questions is on. */

import type { ShopperIntent } from './handoff-intent';

export type VerdictIntent = Exclude<ShopperIntent, 'person'>;

export interface ReplyVerdict {
  answered: boolean;
  intent: VerdictIntent;
  /** The product asked about, in the shopper's words. */
  product: string | null;
  upset: boolean;
}

const INTENTS: readonly VerdictIntent[] = [
  'policy_question',
  'refund_request',
  'exchange_request',
  'order_change',
  'bulk',
  'other',
];

/** Every form the marker takes, closed or cut off by the token limit. */
const VERDICT_MARKER = /\[\[\s*VERDICT\b[\s\S]*?(?:\]\]|$)/gi;

export function verdictInstructions(piecesOfOne: number): string {
  return [
    'REPLY VERDICT (for the store system; the shopper never sees it):',
    'After your reply, on a new last line, write exactly one line in this form:',
    '[[VERDICT {"answered":true,"intent":"other","product":null,"upset":false}]]',
    '- answered: false only when STORE REFERENCE DATA does not cover what the shopper asked; true otherwise, small talk included.',
    `- intent: "policy_question" when the shopper asks whether or how something is possible ("can I exchange the size?", "how long do refunds take?"); "refund_request" when they ask for their money back or to return a piece they already received; "exchange_request" when they ask to exchange a piece they already received; "order_change" when they ask to cancel or change an order they placed, its address or contact details; "bulk" when they want ${piecesOfOne} or more of one piece, or wholesale; otherwise "other". A question about the policy is never a request.`,
    '- product: the product the shopper is asking about, in their own words, or null.',
    '- upset: true when the shopper is clearly angry or distressed.',
    'If your reply also brings in the team, put [[HANDOFF]] at the end of the reply, before the verdict line.',
  ].join('\n');
}

/** Takes the verdict out of the model's text. The text comes back without
 *  any verdict marker, whole or broken, so none can reach a shopper. */
export function takeVerdict(raw: string): { text: string; verdict: ReplyVerdict | null } {
  let verdict: ReplyVerdict | null = null;
  for (const match of raw.matchAll(VERDICT_MARKER)) {
    const json = match[0].replace(/^\[\[\s*VERDICT\b/i, '').replace(/\]\]$/, '').trim();
    const parsed = parseVerdict(json);
    if (parsed) verdict = parsed;
  }
  return { text: raw.replace(VERDICT_MARKER, '').trim(), verdict };
}

function parseVerdict(json: string): ReplyVerdict | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const intent = INTENTS.includes(source.intent as VerdictIntent) ? (source.intent as VerdictIntent) : 'other';
  const product =
    typeof source.product === 'string' && source.product.trim() ? source.product.trim().slice(0, 120) : null;
  return {
    answered: source.answered !== false,
    intent,
    product,
    upset: source.upset === true,
  };
}
