'use client';

import { Button, CopyButton } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import type { ChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import classes from './v16-chat-studio.module.css';

/* How a WooCommerce store installs Store Chat: the WordPress plugin, kept in
   integrations/woocommerce and served as a zip from public/downloads
   (scripts/build-woo-plugin-zip.mjs). It is a setup path, not a claim that
   the platform is supported: lib/product-truth owns that. The last step is
   the StorefrontDomains section that follows, because Store Chat answers
   only on a domain the merchant has proven is theirs. */

export const WOO_PLUGIN_ZIP = '/downloads/grindctrl-store-chat.zip';

export function WoocommerceGuide({
  embedKey,
  copy,
  copyLabels,
}: {
  embedKey: string;
  copy: ChatStudioCopy['woocommerce'];
  copyLabels: Pick<ChatStudioCopy['domains'], 'copy' | 'copied'>;
}) {
  return (
    <div className={classes.block}>
      <h3 className={classes.h3}>{copy.title}</h3>
      <p className={classes.muted}>{copy.body}</p>
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
            <p>{copy.steps.key}</p>
            <div className={classes.keyRow}>
              <code dir="ltr" className={classes.recordValue}>
                {embedKey}
              </code>
              <CopyButton value={embedKey}>
                {({ copied, copy: doCopy }) => (
                  <Button
                    variant="default"
                    radius="pill"
                    className={classes.touch}
                    onClick={doCopy}
                    aria-label={`${copyLabels.copy}: ${copy.keyLabel}`}
                  >
                    {copied ? copyLabels.copied : copyLabels.copy}
                  </Button>
                )}
              </CopyButton>
            </div>
          </div>
        </li>
        <li>
          <p>{copy.steps.domain}</p>
        </li>
      </ol>
    </div>
  );
}
