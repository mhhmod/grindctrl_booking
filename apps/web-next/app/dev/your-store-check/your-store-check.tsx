'use client';

import { MantineUiProvider } from '@/components/mantine/provider';
import {
  V16YourStore,
  V16YourStoreNotConnected,
  V16YourStoreTodayCard,
} from '@/components/dashboard/v16/your-store/v16-your-store';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { StoreConnect } from '@/components/dashboard/v16/store-setup/store-connect';
import type { PasteInstallStatus } from '@/lib/paste/status';
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

/* Connect your store with sample data: a pasted WooCommerce site that was
   seen, and (state "new") a store that never was. */
const pasteStatus = (seen: boolean): PasteInstallStatus => ({
  siteId: 'demo', tenantKey: 'site:demo', platform: 'website', shopDomain: null, shopProof: null, shopProvenAt: null,
  shopCheck: null, shopFirstSeenAt: null, shopLastSeenAt: null, connected: true, trusted: true, connectionReason: null,
  domains: seen ? [{ id: 'd1', domain: ADDRESS, state: 'trusted', firstSeenAt: ago(90), lastSeenAt: ago(34), domainVerified: true,
    proof: { txtName: '', txtValue: '', meta: { name: '', content: '' } } }] as unknown as PasteInstallStatus['domains'] : [],
  seen: false, seenHost: null, chatLive: true, tryOnReady: true, tryOnReason: null, showButton: true,
  plan: { totalCreditsRemaining: 13 } as PasteInstallStatus['plan'], mode: 'live', secretVersion: 1, rotationOverlapUntil: null,
  turnstileConfigured: true,
} as unknown as PasteInstallStatus);
function connectFor(state: string, member: boolean, locale: 'en' | 'ar') {
  const seen = state !== 'new';
  const ok = async <T,>(data: T) => ({ ok: true as const, data });
  return (
    <StoreConnect
      locale={locale}
      siteId="demo"
      meta={{ domain: seen ? ADDRESS : null, embedKey: 'gc_demo', lastSeenMinutes: seen ? 34 : null, wooConnection: null, platformDetected: seen ? 'woocommerce' : null }}
      actions={member ? undefined : {
        createWooPairingCodeAction: async () => ({ ok: false, error: 'demo' }) as never,
        paste: {
          enable: async () => ok({ tenantKey: 'site:demo' }),
          addDomain: async () => ({ ok: false, code: 'invalid_domain' }) as never,
          removeDomain: async () => ok(null),
          proveDns: async () => ({ ok: false, code: 'proof_failed' }) as never,
          proveMeta: async () => ({ ok: false, code: 'proof_failed' }) as never,
          rotate: async () => ok({ version: 2, overlapUntil: new Date(NOW).toISOString() }),
          snippet: async () => ok({ platform: 'website' as const, snippet: '<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="gc_demo" data-gc-install="paste" data-gc-platform="website"></script>', steps: [{ kind: 'save' as const }], contextEndpoint: '/api/try-on/paste-context' as const }),
          status: async () => ok(pasteStatus(seen)),
          proveShop: async () => ({ ok: false, code: 'unavailable' }) as never,
          checkDomain: async () => ok(null) as never,
        } as never,
      }}
    />
  );
}

const EMPTY_HEALTH = { inline: 0, floating: 0, detected: 0, missing: 0, listings: 0, pills: 0, photos: 0, photoHost: null };
const STATES: Record<string, YourStoreFacts> = {
  'health-working': { ...BASE, platform: 'paste_shopify', health: { ...EMPTY_HEALTH, inline: 12, detected: 12, photos: 2, listings: 1, pills: 24 } },
  'health-broken': { ...BASE, platform: 'paste_shopify', codeOutdated: true, health: { ...EMPTY_HEALTH, missing: 4, floating: 1, photoHost: 'a-very-long-product-image-cdn-host-that-must-wrap.example.com' } },
  'health-off': { ...BASE, platform: 'paste_shopify', pillsOn: false, health: EMPTY_HEALTH },
  'health-easyorders': { ...BASE, easyOrders: true, health: EMPTY_HEALTH },
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
              alerts={{ siteId: 'preview-site', enabled: true, save: async () => ({ ok: state !== 'low' }) }}
              connect={connectFor(state, member, locale)}
              actions={{
                setTryOnButton: async () => ({ ok: state !== 'well' }),
                setStoreChat: async () => ({ ok: true }),
                checkDomain: async () => new Promise((resolve) => setTimeout(resolve, 4000)),
              }}
            />
          </>
        ) : (
          state === 'new' ? connectFor(state, member, locale) : <V16YourStoreNotConnected locale={locale} canChange={!member} />
        )}
      </main>
    </MantineUiProvider>
  );
}
