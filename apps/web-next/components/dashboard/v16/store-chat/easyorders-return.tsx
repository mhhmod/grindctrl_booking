'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@mantine/core';
import {
  cancelEasyOrdersInstall, confirmEasyOrdersInstall, inspectEasyOrdersInstall,
} from '@/app/dashboard/store-chat/easyorders-actions';
import { getEasyOrdersReturnCopy } from '@/lib/dashboard/easyorders-return-copy';
import type { EasyOrdersInstallResult } from '@/lib/easyorders/types';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { V16Notice } from '../notice';

/* Where EasyOrders sends the merchant after they approve the app. The store is
   only staged at this point; it is connected when the person who created the
   link presses Connect here. Showing the store first lets them refuse one they
   did not expect. */

// Store ids and names keep their own direction inside Arabic or English text.
const isolate = (value: string) => `⁨${value}⁩`;

type Step = (state: string) => Promise<EasyOrdersInstallResult>;

export function EasyOrdersReturn({ locale, state, initial }: {
  locale: SiteLocale; state: string; initial: EasyOrdersInstallResult;
}) {
  const copy = getEasyOrdersReturnCopy(locale);
  const [result, setResult] = React.useState(initial);
  const [running, setRunning] = React.useState<Step | null>(null);
  const [, startTransition] = React.useTransition();
  const run = (step: Step) => {
    setRunning(() => step);
    startTransition(async () => {
      const next = await step(state);
      setResult(next);
      setRunning(null);
    });
  };
  const busy = running !== null;
  const button = (step: Step, label: string, variant?: 'default') => (
    <Button radius="pill" h={44} variant={variant} loading={running === step} disabled={busy && running !== step}
      onClick={() => run(step)}>
      {label}
    </Button>
  );
  const storeChat = (label: string, variant?: 'default') => (
    <Button component={Link} href="/dashboard/store-chat" radius="pill" h={44} variant={variant}>{label}</Button>
  );

  let notice: { title: string; body: string };
  let actions: React.ReactNode;
  let alert = false;
  switch (result.status) {
    case 'pending_confirmation':
      if (result.reason === 'awaiting_callback') {
        notice = copy.awaiting;
        actions = button(inspectEasyOrdersInstall, copy.actions.checkAgain);
      } else if (result.reason) {
        notice = result.reason === 'rate_limited' ? copy.rateLimited(result.retryAfterSeconds ?? 60) : copy.providerUnavailable;
        actions = <>{button(confirmEasyOrdersInstall, copy.actions.tryAgain)}{button(cancelEasyOrdersInstall, copy.actions.cancel, 'default')}</>;
      } else {
        notice = copy.confirm(isolate(result.storeId ?? ''));
        actions = <>{button(confirmEasyOrdersInstall, copy.actions.connect)}{button(cancelEasyOrdersInstall, copy.actions.cancel, 'default')}</>;
      }
      break;
    case 'active':
      notice = copy.active(isolate(result.storeName ?? result.storeId));
      actions = storeChat(copy.actions.openStoreChat);
      break;
    case 'expired':
      notice = copy.expired;
      actions = storeChat(copy.actions.backToStoreChat);
      break;
    default:
      alert = true;
      notice = copy.failed[result.reason];
      actions = result.reason === 'unavailable' || result.reason === 'rate_limited'
        ? <>{button(inspectEasyOrdersInstall, copy.actions.tryAgain)}{storeChat(copy.actions.backToStoreChat, 'default')}</>
        : storeChat(copy.actions.backToStoreChat);
  }

  return (
    <div aria-live="polite" aria-busy={busy}>
      <V16Notice title={notice.title} body={notice.body} role={alert ? 'alert' : undefined}>
        {actions}
      </V16Notice>
    </div>
  );
}
