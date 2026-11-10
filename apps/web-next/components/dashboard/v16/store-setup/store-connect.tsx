'use client';

import * as React from 'react';
import { Button } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { ShopifyMark, WooCommerceLogo, WordPressMark } from '@/components/brand-marks';
import { appEmbedActivationUrl } from '@/lib/shopify/app-identity';
import { buildCanonicalInstallSnippet } from '@/lib/adapters/install';
import { getChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { pasteInstallCopy } from '@/lib/dashboard/paste-install-copy';
import type { DomainActions } from '@/lib/messenger/dashboard-actions-contract';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { WooSiteConnectionSummary } from '@/lib/woo/connection';
import { StorefrontDomains } from '../store-chat/storefront-domains';
import { PasteInstall, type PasteInstallActions } from '../store-chat/paste-install';
import { WoocommerceGuide, type CreateWooPairingCode } from '../store-chat/woocommerce-guide';
import classes from './store-connect.module.css';

export type StoreConnectMeta = {
  domain: string | null;
  embedKey: string;
  /** Minutes since the code was last seen on the storefront, or null if never. */
  lastSeenMinutes: number | null;
  wooConnection: WooSiteConnectionSummary | null;
  /** What the storefront check found the site runs on, e.g. "woocommerce". */
  platformDetected: string | null;
};

export type StoreConnectActions = {
  createWooPairingCodeAction: CreateWooPairingCode;
  paste?: PasteInstallActions;
} & Partial<DomainActions>;

function Platform({ meta, shopify }: { meta: StoreConnectMeta; shopify: boolean }) {
  if (shopify) {
    return (
      <span className={classes.platform}>
        <ShopifyMark className={classes.mark} decorative />
        Shopify
      </span>
    );
  }
  if (meta.wooConnection || meta.platformDetected === 'woocommerce') {
    return (
      <span className={classes.platform}>
        <WordPressMark className={classes.mark} decorative />
        WordPress ·
        <WooCommerceLogo size={12} title="WooCommerce" />
      </span>
    );
  }
  return null;
}

/* Connect your store, the first section of Store setup (owner decision
   2026-11-10): the install flow lives here, not under Store Chat. Until the
   code has been seen it is open; afterwards it folds to one line with the
   steps a tap away. A person who cannot change settings sees the status
   only. */
export function StoreConnect({
  locale,
  siteId,
  meta,
  actions,
}: {
  locale: SiteLocale;
  siteId: string;
  meta: StoreConnectMeta;
  /** Absent for people who cannot change settings. */
  actions?: StoreConnectActions;
}) {
  const copy = getYourStoreCopy(locale);
  const chat = getChatStudioCopy(locale);
  const id = React.useId();
  const shopify = Boolean(meta.domain && meta.domain.endsWith('.myshopify.com'));
  const installed = meta.lastSeenMinutes !== null;
  const [open, setOpen] = React.useState(!installed);
  const [copied, setCopied] = React.useState(false);

  return (
    <section id="connect" aria-labelledby={`${id}-title`} className={classes.card}>
      <div className={classes.head}>
        <span className={`${classes.tile} ${installed ? classes.tileOk : ''}`} aria-hidden="true">
          <GcIcon name={installed ? 'check' : 'store'} size={22} />
        </span>
        <div className={classes.headText}>
          <h2 id={`${id}-title`} className={classes.title}>
            {installed ? copy.connect.connectedTitle : copy.connect.title}
          </h2>
          <p className={classes.status} data-state={installed ? 'ok' : 'waiting'}>
            <span className={classes.dot} aria-hidden="true" />
            {installed ? copy.connect.installed(chat.ago(meta.lastSeenMinutes!)) : copy.connect.waiting}
          </p>
          {(meta.domain || shopify || meta.wooConnection || meta.platformDetected === 'woocommerce') && (
            <p className={classes.where}>
              {meta.domain && (
                <bdi dir="ltr" className={classes.address}>
                  {meta.domain}
                </bdi>
              )}
              <Platform meta={meta} shopify={shopify} />
            </p>
          )}
        </div>
        <div className={classes.headActions}>
          {meta.domain && installed && (
            <Button
              component="a"
              href={`https://${meta.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="default"
              radius="pill"
              rightSection={<GcIcon name="ext" size={14} />}
            >
              {copy.connect.openStore}
            </Button>
          )}
          {installed && actions && (
            <Button variant="subtle" radius="pill" aria-expanded={open} aria-controls={`${id}-steps`} onClick={() => setOpen((v) => !v)}>
              {open ? copy.connect.hideSteps : copy.installSteps}
            </Button>
          )}
        </div>
      </div>

      {open && actions && (
        <div id={`${id}-steps`} className={classes.body}>
          {shopify && meta.domain && (
            <div className={classes.buttons}>
              <Button
                component="a"
                href={appEmbedActivationUrl(meta.domain, 'messenger')}
                target="_blank"
                rel="noopener noreferrer"
                variant="default"
                radius="pill"
                rightSection={<GcIcon name="ext" size={14} />}
              >
                {chat.openThemeEditor}
              </Button>
            </div>
          )}
          {(shopify || !actions.paste) && (
            <p className={classes.muted}>
              {chat.notShopify}{' '}
              <Button
                variant="subtle"
                size="compact-sm"
                className={classes.inlineButton}
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(buildCanonicalInstallSnippet(meta.embedKey))
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    })
                    .catch(() => {});
                }}
              >
                {copied ? chat.copied : chat.copyScript}
              </Button>
            </p>
          )}
          {!shopify && actions.paste && (
            <PasteInstall
              siteId={siteId}
              locale={locale}
              copy={pasteInstallCopy(locale)}
              ago={chat.ago}
              actions={actions.paste}
              initialPlatform={meta.wooConnection ? 'woocommerce' : null}
              woocommerce={
                <>
                  <WoocommerceGuide
                    locale={locale}
                    siteId={siteId}
                    connection={meta.wooConnection}
                    createPairingCode={actions.createWooPairingCodeAction}
                    copy={chat.woocommerce}
                    copyLabels={chat.domains}
                  />
                  {actions.listDomainsAction && actions.addDomainAction && actions.checkDomainAction && actions.removeDomainAction && (
                    <StorefrontDomains
                      siteId={siteId}
                      copy={chat.domains}
                      actions={{
                        listDomainsAction: actions.listDomainsAction,
                        addDomainAction: actions.addDomainAction,
                        checkDomainAction: actions.checkDomainAction,
                        removeDomainAction: actions.removeDomainAction,
                      }}
                    />
                  )}
                </>
              }
            />
          )}
          {!shopify && !actions.paste && (
            <WoocommerceGuide
              locale={locale}
              siteId={siteId}
              connection={meta.wooConnection}
              createPairingCode={actions.createWooPairingCodeAction}
              copy={chat.woocommerce}
              copyLabels={chat.domains}
            />
          )}
          {!shopify &&
            !actions.paste &&
            actions.listDomainsAction &&
            actions.addDomainAction &&
            actions.checkDomainAction &&
            actions.removeDomainAction && (
              <StorefrontDomains
                siteId={siteId}
                copy={chat.domains}
                actions={{
                  listDomainsAction: actions.listDomainsAction,
                  addDomainAction: actions.addDomainAction,
                  checkDomainAction: actions.checkDomainAction,
                  removeDomainAction: actions.removeDomainAction,
                }}
              />
            )}
        </div>
      )}
    </section>
  );
}
