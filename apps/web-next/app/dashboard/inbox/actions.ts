'use server';

import { auth } from '@clerk/nextjs/server';
import { getRequestLocale } from '@/lib/auth/locale';
import { getActiveStore, getActiveStoreTimeZone } from '@/lib/dashboard/active-store-server';
import { getInboxCustomerFacts } from '@/lib/dashboard/inbox-customer-data';
import { getInboxCustomerCopy } from '@/lib/dashboard/inbox-customer-copy';
import { buildInboxCustomerView, type InboxCustomerView } from '@/lib/dashboard/inbox-customer-model';
import { requireMerchantRateLimit } from '@/lib/request-rate-limit';

/* The Inbox's customer column for one conversation (04-dashboard.md), read
   when a conversation is opened. getInboxCustomerFacts checks that the
   person may answer the site's chats and that the conversation is the
   site's; the view is built here, in the person's language and the active
   store's time zone. */
export async function fetchInboxCustomer(siteId: string, conversationId: string): Promise<{ ok: true; view: InboxCustomerView } | { ok: false }> {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false };
    await requireMerchantRateLimit(`account:${userId}`, 'read');
    const [facts, locale, timeZone] = await Promise.all([
      getInboxCustomerFacts({ userId, siteId: String(siteId), conversationId: String(conversationId) }),
      getRequestLocale(),
      getActiveStore().then(getActiveStoreTimeZone),
    ]);
    return { ok: true, view: buildInboxCustomerView(facts, getInboxCustomerCopy(locale), locale, timeZone) };
  } catch (error) {
    console.error('[inbox] customer failed:', error instanceof Error ? error.message : error);
    return { ok: false };
  }
}
