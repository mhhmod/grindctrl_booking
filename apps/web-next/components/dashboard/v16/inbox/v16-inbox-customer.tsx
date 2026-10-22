'use client';

import * as React from 'react';
import { GcIcon } from '@/components/icons';
import { getInboxCustomerCopy } from '@/lib/dashboard/inbox-customer-copy';
import type { InboxCustomerView } from '@/lib/dashboard/inbox-customer-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './v16-inbox-customer.module.css';

/* The v16 Inbox's customer column (04-dashboard.md, the Inbox board's
   "About Salma") for the open conversation, read when it opens. The model
   in lib/dashboard/inbox-customer-model.ts decides what has a source; each
   part shows only when its data does. */

export type FetchInboxCustomer = (siteId: string, conversationId: string) => Promise<{ ok: true; view: InboxCustomerView } | { ok: false }>;

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; view: InboxCustomerView };

function Address({ value }: { value: string }) {
  const at = value.indexOf('@');
  if (at <= 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, at)}
      <wbr />
      {value.slice(at)}
    </>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes.link}>
      {children}
      <GcIcon name="ext" size={14} />
    </a>
  );
}

export function V16InboxCustomer({
  locale,
  siteId,
  conversationId,
  fetchCustomer,
}: {
  locale: SiteLocale;
  siteId: string;
  conversationId: string;
  fetchCustomer: FetchInboxCustomer;
}) {
  const copy = getInboxCustomerCopy(locale);
  // The column and the phone sheet can both be in the page, so ids are per instance.
  const id = React.useId();
  const [state, setState] = React.useState<State>({ status: 'loading' });

  React.useEffect(() => {
    let live = true;
    fetchCustomer(siteId, conversationId)
      .then((result) => live && setState(result.ok ? { status: 'ready', view: result.view } : { status: 'error' }))
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [fetchCustomer, siteId, conversationId]);

  if (state.status !== 'ready') {
    return (
      <div className={classes.column}>
        <p className={classes.muted} role="status">
          {state.status === 'loading' ? copy.loading : copy.couldNotLoad}
        </p>
      </div>
    );
  }

  const view = state.view;
  return (
    <div className={classes.column}>
      <section className={classes.section} aria-labelledby={`${id}-customer`}>
        <h2 id={`${id}-customer`} className={classes.name}>
          <bdi>{view.name ?? copy.shopper}</bdi>
        </h2>
        {view.email && (
          <p className={classes.muted} dir="ltr">
            <Address value={view.email} />
          </p>
        )}
        {view.lines.map((line) => (
          <p key={line} className={classes.muted}>
            {line}
          </p>
        ))}
        {view.customerUrl && <ExternalLink href={view.customerUrl}>{copy.openCustomer}</ExternalLink>}
      </section>

      {view.order && (
        <section className={classes.section} aria-labelledby={`${id}-order`}>
          <h3 id={`${id}-order`} className={classes.label}>
            <bdi>{view.order.title}</bdi>
          </h3>
          <span className={classes.pill} data-tone={view.order.tone}>
            {view.order.stage}
          </span>
          {view.order.total && <p className={classes.strong}>{view.order.total}</p>}
          {view.order.items.length > 0 && (
            <ul className={classes.list}>
              {view.order.items.map((item, i) => (
                <li key={`${item}-${i}`}>
                  <bdi>{item}</bdi>
                </li>
              ))}
            </ul>
          )}
          <div className={classes.links}>
            {view.order.shopifyUrl && <ExternalLink href={view.order.shopifyUrl}>{copy.openInShopify}</ExternalLink>}
            {view.order.trackingUrl && <ExternalLink href={view.order.trackingUrl}>{copy.track}</ExternalLink>}
          </div>
        </section>
      )}

      {view.cart && (
        <section className={classes.section} aria-labelledby={`${id}-cart`}>
          <h3 id={`${id}-cart`} className={classes.label}>
            {copy.inCart}
          </h3>
          <ul className={classes.cart}>
            {view.cart.items.map((item, i) => (
              <li key={`${item.title}-${i}`}>
                <GcIcon name="cart" size={16} />
                <bdi className={classes.cartTitle}>{item.title}</bdi>
                <span className={classes.strong}>{item.price}</span>
              </li>
            ))}
          </ul>
          <p className={classes.muted}>{view.cart.total}</p>
        </section>
      )}

      <section className={classes.section} aria-labelledby={`${id}-past`}>
        <h3 id={`${id}-past`} className={classes.label}>
          {copy.pastConversations}
        </h3>
        {view.past.length === 0 ? (
          <p className={classes.muted}>{copy.noPast}</p>
        ) : (
          <ul className={classes.past}>
            {view.past.map((conversation) => (
              <li key={conversation.id}>
                {conversation.preview && (
                  <p className={classes.preview}>
                    <bdi>{conversation.preview}</bdi>
                  </p>
                )}
                <p className={classes.muted}>{[conversation.status, conversation.date].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
