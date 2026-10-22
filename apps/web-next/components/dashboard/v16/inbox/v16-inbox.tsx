'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { ConversationsPanel } from '@/components/dashboard/messenger/conversations-panel';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import { getInboxCopy } from '@/lib/dashboard/inbox-copy';
import { getInboxCustomerCopy } from '@/lib/dashboard/inbox-customer-copy';
import { V16InboxCustomer, type FetchInboxCustomer } from './v16-inbox-customer';
import type { InboxData } from '@/lib/dashboard/inbox-data';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './v16-inbox.module.css';

/* The v16 Inbox (04-dashboard.md): today's conversation panel, with its
   list, thread, Take over, Return to AI, Assign to, Mark resolved and the
   Reply and Note composer with Saved replies, under the board's three tabs
   (Needs you, Assistant, Resolved), and the board's customer column for the
   open conversation (v16-inbox-customer.tsx). The board's other new parts
   wait for their back ends: intent tags (N25), summaries, who else is
   viewing (N14), the suggested reply (N15), the product insert (N10), the
   shopper's city, orders and total (N16), Change address (N17) and the look
   they sent (N18). */

export type InboxActions = Pick<
  MessengerHostActions,
  | 'fetchConversationMessages'
  | 'staffReply'
  | 'pingStaffTyping'
  | 'addInternalNote'
  | 'takeoverConversation'
  | 'assignConversationAction'
  | 'releaseConversation'
  | 'closeConversationAction'
  | 'markConversationRead'
>;

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <section className={classes.notice}>
      <h2 className={classes.noticeTitle}>{title}</h2>
      <p className={classes.muted}>{body}</p>
      {action}
    </section>
  );
}

export function V16Inbox({
  locale,
  data,
  actions,
  fetchCustomer,
}: {
  locale: SiteLocale;
  data: InboxData;
  actions: InboxActions;
  /** The customer column's read; without it the panel has two columns. */
  fetchCustomer?: FetchInboxCustomer;
}) {
  const copy = getInboxCopy(locale);
  const customerCopy = getInboxCustomerCopy(locale);
  if (data.conversations.length === 0) return <Notice title={copy.emptyTitle} body={copy.emptyBody} />;
  return (
    <div className={classes.inbox}>
      <ConversationsPanel
        locale={locale}
        siteId={data.siteId}
        conversations={data.conversations}
        cannedReplies={data.cannedReplies}
        actions={actions}
        currentProfileId={data.currentProfileId}
        assignableMembers={data.assignableMembers}
        inboxTabs
        aside={
          fetchCustomer
            ? {
                label: customerCopy.showCustomer,
                closeLabel: customerCopy.close,
                render: (conversationId) => (
                  <V16InboxCustomer
                    key={conversationId}
                    locale={locale}
                    siteId={data.siteId}
                    conversationId={conversationId}
                    fetchCustomer={fetchCustomer}
                  />
                ),
              }
            : undefined
        }
      />
    </div>
  );
}

export function V16InboxNoStoreChat({ locale }: { locale: SiteLocale }) {
  const copy = getInboxCopy(locale);
  return (
    <Notice
      title={copy.noStoreChatTitle}
      body={copy.noStoreChatBody}
      action={
        <Button component={Link} href="/dashboard/store-chat/setup" radius="pill" className={classes.action}>
          {copy.openStoreChat}
        </Button>
      }
    />
  );
}

export function V16InboxError({ locale }: { locale: SiteLocale }) {
  const copy = getInboxCopy(locale);
  return (
    <p className={classes.notice} role="status">
      {copy.couldNotLoad}
    </p>
  );
}
