'use client';

import React from 'react';
import { MantineUiProvider } from '@/components/mantine/provider';
import { V16ChatStudio, type ChatStudioActions } from '@/components/dashboard/v16/store-chat/v16-chat-studio';
import type { CannedReply } from '@/lib/messenger/canned-replies-limits';
import type { MessengerConfig } from '@/lib/messenger/types';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import { DEV_ICON } from './dev-icon';

const REPLIES: CannedReply[] = [
  { id: 'r1', title: 'Shipping times', content: 'Orders arrive in two to four working days across Egypt.', status: 'active', sort_order: 0, updated_at: '2026-11-01T00:00:00Z' },
  { id: 'r2', title: 'Returns', content: 'You can return unworn pieces within 14 days.', status: 'disabled', sort_order: 1, updated_at: '2026-11-01T00:00:00Z' },
];

export function SetupCheck({ locale, config }: { locale: 'en' | 'ar'; config: MessengerConfig }) {
  const payload = { active: true, aiEnabled: true, attachmentsEnabled: false, appearance: config.appearance, behaviour: config.behaviour } as unknown as PublicMessengerPayload;
  const ok = async () => ({ ok: true as const });
  const actions: ChatStudioActions = {
    saveDraftSections: ok,
    publishConfig: ok,
    revertConfigAction: ok,
    setMessengerEnabled: ok,
    disconnectSiteAction: ok,
    discardDraft: ok,
    uploadLauncherIconAction: async () => ({ ok: true as const, url: DEV_ICON }),
    addCannedReply: ok,
    updateCannedReplyStatus: ok,
    deleteCannedReply: ok,
    createWooPairingCodeAction: async () => ({ ok: true as const, code: 'K7QM4TXP', expiresAt: '2026-11-04T10:15:00.000Z' }),
  };
  return (
    <MantineUiProvider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale} data-capture="ready" style={{ padding: 16, maxInlineSize: 1400, marginInline: 'auto' }}>
        <V16ChatStudio
          locale={locale}
          siteId="site_dev"
          published={config}
          config={config}
          payload={payload}
          cannedReplies={REPLIES}
          meta={{
            domain: 'maison-noor.myshopify.com',
            embedKey: 'emb_dev',
            active: true,
            version: 14,
            canRevert: false,
            canDisconnect: false,
            ordersAuthorized: false,
            ordersGrant: null,
            shopTimezone: 'Africa/Cairo',
            lastSeenMinutes: 2,
            handoffRules: false,
            wooConnection: null,
          }}
          actions={actions}
        />
      </div>
    </MantineUiProvider>
  );
}
