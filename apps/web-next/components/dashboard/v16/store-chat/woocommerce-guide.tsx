'use client';

import * as React from 'react';
import { Button, CopyButton } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import type { ChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { WooSiteConnectionSummary } from '@/lib/woo/connection';
import classes from './v16-chat-studio.module.css';

/* How a WooCommerce store installs Store Chat: the WordPress plugin, kept in
   integrations/woocommerce and served as a zip from public/downloads
   (scripts/build-woo-plugin-zip.mjs). It is a setup path, not a claim that
   the platform is supported: lib/product-truth owns that. The last step is
   the StorefrontDomains section that follows, because Store Chat answers
   only on a domain the merchant has proven is theirs. */

export const WOO_PLUGIN_ZIP = '/downloads/grindctrl-store-chat.zip';

export type CreateWooPairingCode = (siteId: string) => Promise<
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; code: string; message: string; retryAfterSeconds?: number }
>;

function formatDateTime(value: string, locale: SiteLocale, timeOnly = false): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(
    locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB',
    timeOnly
      ? { hour: 'numeric', minute: '2-digit' }
      : { dateStyle: 'medium', timeStyle: 'short' },
  ).format(date);
}

export function WoocommerceGuide({
  locale,
  siteId,
  connection,
  createPairingCode,
  copy,
  copyLabels,
}: {
  locale: SiteLocale;
  siteId: string;
  connection: WooSiteConnectionSummary | null;
  createPairingCode: CreateWooPairingCode;
  copy: ChatStudioCopy['woocommerce'];
  copyLabels: Pick<ChatStudioCopy['domains'], 'copy' | 'copied'>;
}) {
  const [pairing, setPairing] = React.useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);

  const getCode = async () => {
    setBusy(true);
    setError(false);
    try {
      const result = await createPairingCode(siteId);
      if (result.ok) setPairing({ code: result.code, expiresAt: result.expiresAt });
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={classes.block}>
      <h3 className={classes.h3}>{copy.title}</h3>
      <p className={classes.muted}>{copy.body}</p>

      {connection && (
        <div className={classes.connectionState} data-state={connection.status}>
          <p className={classes.connectionStatus}>
            <GcIcon name={connection.status === 'active' ? 'check' : 'x'} size={14} />
            {connection.status === 'active' ? copy.connected : copy.disconnected}
          </p>
          <p className={classes.muted}>
            {copy.pluginVersion(connection.pluginVersion)}
          </p>
          <p className={classes.muted}>
            {connection.lastSeenAt ? (
              <time dateTime={connection.lastSeenAt}>
                {copy.lastSeen(formatDateTime(connection.lastSeenAt, locale))}
              </time>
            ) : copy.neverSeen}
          </p>
          {connection.status === 'active' && connection.cloneSuspected && (
            <p role="alert" className={classes.connectionError}>{copy.cloneWarning}</p>
          )}
          {connection.status === 'active' && connection.pluginOutdated && (
            <p className={classes.connectionError}>{copy.updatePlugin}</p>
          )}
        </div>
      )}

      <ol className={classes.steps}>
        <li>
          <div className={classes.stepBody}>
            <p>{copy.steps.download}</p>
            <Button
              component="a"
              href={WOO_PLUGIN_ZIP}
              download="grindctrl-store-chat.zip"
              variant="default"
              radius="pill"
              className={classes.touch}
              leftSection={<GcIcon name="dl" size={14} />}
            >
              {copy.download}
            </Button>
          </div>
        </li>
        <li>
          <p>{copy.steps.upload}</p>
        </li>
        <li>
          <div className={classes.stepBody}>
            <p>{copy.steps.code}</p>
            {!pairing && (
              <Button
                variant="default"
                radius="pill"
                className={classes.touch}
                loading={busy}
                onClick={() => void getCode()}
              >
                {busy ? copy.gettingCode : copy.getCode}
              </Button>
            )}
            {pairing && (
              <div className={classes.codeBlock} aria-live="polite">
                <div className={classes.keyRow}>
                  <code dir="ltr" className={classes.recordValue}>
                    {pairing.code}
                  </code>
                  <CopyButton value={pairing.code}>
                    {({ copied, copy: doCopy }) => (
                      <Button
                        variant="default"
                        radius="pill"
                        className={classes.touch}
                        onClick={doCopy}
                        aria-label={`${copyLabels.copy}: ${copy.codeLabel}`}
                      >
                        {copied ? copyLabels.copied : copyLabels.copy}
                      </Button>
                    )}
                  </CopyButton>
                </div>
                <p className={classes.muted}>
                  <time dateTime={pairing.expiresAt}>
                    {copy.codeExpires(formatDateTime(pairing.expiresAt, locale, true))}
                  </time>
                </p>
              </div>
            )}
            {error && <p role="alert" className={classes.connectionError}>{copy.codeError}</p>}
          </div>
        </li>
        <li>
          <p>{copy.steps.connect}</p>
        </li>
        <li>
          <p>{copy.steps.domain}</p>
        </li>
      </ol>
    </div>
  );
}
