'use client';

import { MantineUiProvider } from '@/components/mantine/provider';
import {
  V16YourStore,
  V16YourStoreNotConnected,
  V16YourStoreTodayCard,
} from '@/components/dashboard/v16/your-store/v16-your-store';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { buildTodayStoreCard, buildYourStoreView, type YourStoreFacts } from '@/lib/dashboard/your-store-model';

const NOW = Date.parse('2026-11-10T12:14:00.000Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const ADDRESS = 'lulus-fashion.myeasyorders.com';

const BASE: YourStoreFacts = {
  now: NOW,
  timeZone: 'Africa/Cairo',
  platform: 'paste_website',
  address: ADDRESS,
  storeUrl: `https://${ADDRESS}`,
  canChange: true,
  canBilling: true,
  code: { lastSeenAt: ago(3), connected: true },
  launchState: 'live',
  codeOutdated: false,
  tryOn: { tenant: 'site:demo', showButton: true, looksLeft: 15, looksIncluded: 15, planActive: true, pasteReason: null },
  chat: { siteId: 'demo', enabled: true },
  domains: [{ id: 'd1', domain: ADDRESS, verified: true, state: 'trusted', reason: null }],
};

const STATES: Record<string, YourStoreFacts> = {
  connected: { ...BASE, tryOn: { ...BASE.tryOn!, showButton: false }, chat: { siteId: 'demo', enabled: false } },
  tryon: { ...BASE, chat: { siteId: 'demo', enabled: false } },
  preview: { ...BASE, launchState: 'preview' },
  well: BASE,
  running: {
    ...BASE,
    tryOn: { ...BASE.tryOn!, looksLeft: 0 },
    domains: [
      ...BASE.domains,
      { id: 'd2', domain: 'www.lulusfashion.com', verified: false, state: 'trusted', reason: null },
      { id: 'd3', domain: 'a-very-long-store-name-that-must-wrap-not-overflow.example.com', verified: false, state: 'claimed', reason: 'held_elsewhere' },
    ],
  },
  low: { ...BASE, tryOn: { ...BASE.tryOn!, looksLeft: 2 }, codeOutdated: true, platform: 'paste_shopify' },
  waiting: { ...BASE, code: { lastSeenAt: null, connected: false } },
  codegone: { ...BASE, code: { lastSeenAt: ago(60 * 24 * 3), connected: true } },
};

export function YourStoreCheck({ state, locale, member }: { state: string; locale: 'en' | 'ar'; member: boolean }) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const copy = getYourStoreCopy(locale);
  const base = STATES[state];
  const facts = base ? { ...base, canChange: !member, canBilling: !member } : null;
  return (
    <MantineUiProvider dir={dir}>
      <main dir={dir} lang={locale} style={{ maxWidth: 1160, margin: '0 auto', padding: '22px 32px', display: 'grid', gap: 24 }}>
        {facts ? (
          <>
            <V16YourStoreTodayCard card={buildTodayStoreCard(facts, copy, locale)} locale={locale} />
            <V16YourStore
              view={buildYourStoreView(facts, copy, locale)}
              canChange={!member}
              locale={locale}
              actions={{
                setTryOnButton: async () => ({ ok: state !== 'well' }),
                setStoreChat: async () => ({ ok: true }),
                checkDomain: async () => new Promise((resolve) => setTimeout(resolve, 4000)),
              }}
            />
          </>
        ) : (
          <V16YourStoreNotConnected locale={locale} canChange={!member} />
        )}
      </main>
    </MantineUiProvider>
  );
}
