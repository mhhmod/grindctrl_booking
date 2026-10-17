import 'server-only';

import { getMessengerServiceClient } from './db';
import type { ShopperLanguage } from './language';

/* Questions the assistant could not answer (N8, flag n8_unanswered_questions,
   phase zero item 11). The model's reply verdict says when the store's data
   did not cover a question; the send route stores it here so Knowledge can
   group the questions shoppers keep asking. Table:
   supabase/messenger_questions.sql. */

export const QUESTION_RETENTION_DAYS = 90;
export const QUESTION_MAX_CHARS = 500;

const DIGIT = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]';
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}/g;
const PHONE = new RegExp(`\\+?${DIGIT}[${DIGIT.slice(1, -1)}\\s\\-().]{5,}${DIGIT}`, 'g');
const ORDER = new RegExp(
  `(?:#\\s?${DIGIT}{3,})|((?:order|orders|طلب|الطلب|طلبي|اوردر|أوردر|الاوردر|الأوردر|talab|el\\s?order)(?:\\s*(?:no\\.?|number|num|رقم|nemra|#))?\\s*)${DIGIT}{3,}`,
  'giu',
);

/** Emails, phone numbers and order numbers out; the question stays. */
export function redactQuestion(text: string): string {
  return text
    .replace(EMAIL, '[email]')
    .replace(ORDER, (_match, lead: string | undefined) => `${(lead ?? '').replace(/#\s*$/, '')}[order]`)
    .replace(PHONE, (match) => ((match.match(new RegExp(DIGIT, 'g')) ?? []).length >= 7 ? '[phone]' : match))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, QUESTION_MAX_CHARS);
}

/** The product page's handle, from a storefront URL such as
 *  /products/layla-abaya or /ar/collections/new/products/layla-abaya. */
export function productHandleFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const match = path.match(/\/products\/([^/?#]+)/);
  if (!match) return null;
  let handle: string;
  try {
    handle = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  handle = handle.trim().toLowerCase();
  return handle && handle.length <= 255 ? handle : null;
}

/** Stores one unanswered question, and drops this store's questions older
 *  than the retention window. Throws on a database error; the send route
 *  catches, because a lost record must never cost the shopper a reply. */
export async function recordUnansweredQuestion(input: {
  siteId: string;
  conversationId: string;
  messageId: string | null;
  question: string;
  language: ShopperLanguage;
  product: string | null;
  pageUrl: string | null;
  now?: Date;
}): Promise<'stored' | 'skipped'> {
  const question = redactQuestion(input.question);
  // Nothing left to learn from once the personal details are out.
  if (question.replace(/\[(?:email|phone|order)\]/g, '').replace(/[^\p{L}\p{N}]/gu, '').length < 3) {
    return 'skipped';
  }
  const supabase = getMessengerServiceClient();
  const inserted = await supabase.from('messenger_unanswered').insert({
    widget_site_id: input.siteId,
    conversation_id: input.conversationId,
    message_id: input.messageId,
    question,
    language: input.language,
    product: input.product ? input.product.trim().slice(0, 120) || null : null,
    product_handle: productHandleFromUrl(input.pageUrl),
  });
  if (inserted.error) throw new Error(`unanswered insert failed: ${inserted.error.message}`);

  const cutoff = new Date((input.now ?? new Date()).getTime() - QUESTION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const pruned = await supabase
    .from('messenger_unanswered')
    .delete()
    .eq('widget_site_id', input.siteId)
    .lt('created_at', cutoff.toISOString());
  if (pruned.error) throw new Error(`unanswered prune failed: ${pruned.error.message}`);
  return 'stored';
}
