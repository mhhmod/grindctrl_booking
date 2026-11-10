'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { ConnectShopPanel } from '@/components/dashboard/connect-shop-panel';
import type { ShopChoice } from '@/lib/dashboard/shell-model';
import { getStatesCopy } from '@/lib/dashboard/states-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { V16Notice, V16NoticeGroup } from './notice';

/* The dashboard states that belong to no single page (04-dashboard.md): a
   person with no store, a store list that could not be read, and a page that
   needs a connected store. Each names the real next step. */

/** A new account: nothing is connected yet, so Today, Inbox and Settings
 *  have nothing to show. The two ways in are connecting a Shopify store
 *  with a code, and Store Chat on another website. */
export function V16NoStore({ locale }: { locale: SiteLocale }) {
  const copy = getStatesCopy(locale);
  return (
    <V16Notice title={copy.noStore.title} body={copy.noStore.body}>
      <ConnectShopPanel locale={locale} />
      <Button component={Link} href="/dashboard/store#connect" variant="default" radius="pill" h={44}>
        {copy.noStore.setUpChat}
      </Button>
    </V16Notice>
  );
}

/** The person's stores could not be read, which is not the same as having
 *  none. The layout shows this in place of the page, with a retry that
 *  reads them again. */
export function V16StoreLookupFailed({ locale }: { locale: SiteLocale }) {
  const copy = getStatesCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <V16Notice title={copy.lookupFailed.title} body={copy.lookupFailed.body} role="alert">
      <Button radius="pill" h={44} loading={pending} onClick={() => startTransition(() => router.refresh())}>
        {copy.lookupFailed.retry}
      </Button>
    </V16Notice>
  );
}

/** Try-On and Plan belong to a Shopify store or a paired WooCommerce store.
 *  When the active store is a Store Chat site with neither (or there is
 *  none), say so, offer the Shopify store the person already has, and both
 *  ways to connect one: a Shopify linking code, or the WooCommerce plugin. */
export function V16NeedsStore({
  locale,
  feature,
  shops,
}: {
  locale: SiteLocale;
  feature: 'tryOn' | 'plan';
  shops: ShopChoice[];
}) {
  const copy = getStatesCopy(locale);
  const text = copy.needsStore[feature];
  const path = feature === 'tryOn' ? '/dashboard/try-on' : '/dashboard/plan';
  return (
    <V16Notice title={text.title} body={text.body}>
      {shops.length > 0 && (
        <V16NoticeGroup hint={copy.needsStore.switchBody}>
          {shops.map((shop) => (
            // A plain link: choosing a store loads the page, so the dashboard remembers it.
            <Button
              key={shop.domain}
              component="a"
              href={`${path}?shop=${encodeURIComponent(shop.domain)}`}
              radius="pill"
              h={44}
            >
              {copy.needsStore.switchTo(shop.label)}
            </Button>
          ))}
        </V16NoticeGroup>
      )}
      {/* Pasting the code needs no app review, so it leads until the
          Shopify app is listed; the plugin and the app follow. */}
      <V16NoticeGroup hint={copy.needsStore.pasteHint}>
        <Button component={Link} href="/dashboard/store#connect" radius="pill" h={44}>
          {copy.needsStore.pasteAction}
        </Button>
      </V16NoticeGroup>
      <V16NoticeGroup hint={copy.needsStore.wooHint}>
        <Button component={Link} href="/dashboard/store#connect" variant="default" radius="pill" h={44}>
          {copy.needsStore.wooAction}
        </Button>
      </V16NoticeGroup>
      <V16NoticeGroup>
        <ConnectShopPanel locale={locale} hasShops={shops.length > 0} />
      </V16NoticeGroup>
    </V16Notice>
  );
}

/** Another account already owns this store's Store Chat, which a retry
 *  cannot fix. Try-On holds the linking code that moves it here. */
export function V16StoreTaken({ locale }: { locale: SiteLocale }) {
  const copy = getStatesCopy(locale);
  return (
    <V16Notice title={copy.storeTaken.title} body={copy.storeTaken.body}>
      <Button component={Link} href="/dashboard/try-on" radius="pill" h={44}>
        {copy.storeTaken.action}
      </Button>
    </V16Notice>
  );
}

/** The way back from More settings to the Set up board. */
export function V16BackToSetUp({ locale }: { locale: SiteLocale }) {
  const copy = getStatesCopy(locale);
  return (
    <div>
      <Button
        component={Link}
        href="/dashboard/store-chat/setup"
        variant="subtle"
        radius="pill"
        h={44}
        leftSection={<GcIcon name="back" size={16} />}
      >
        {copy.backToSetUp}
      </Button>
    </div>
  );
}
