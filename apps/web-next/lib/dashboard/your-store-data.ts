import 'server-only';

import { getMessengerServiceClient } from '@/lib/messenger/db';
import { getShopEntitlement, type ShopEntitlement } from '@/lib/try-on/entitlement';
import { readTryOnShowButton, readTryOnShowCardPill } from '@/lib/try-on/settings';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { launchView, type LaunchState } from '@/lib/launch/audience';
import { storeFlags } from '@/lib/flags/store-flags';
import { readPasteInstallStatus, type PasteInstallStatus } from '@/lib/paste/status';
import { getWooSiteConnection } from '@/lib/woo/connection';
import { roleCan, type DashboardWorkspaceRole } from '@/lib/rbac/dashboard-policy';
import { activeTenantKey, flagStoreOf, type ActiveStore } from './active-store';
import { listDashboardShops } from './active-store-server';
import { readHealthCounts } from '@/lib/store-health/signals';
import { readPasteDomainPlatforms } from '@/lib/paste/store';
import { readButtonPlacement } from '@/lib/try-on/placement-store';
import type { YourStoreFacts, YourStorePlatform } from './your-store-model';

/* The facts behind Your store, for the active store only (resolved among
   the caller's own and team stores, so every read below is one this person
   may make). Null when no store is connected yet: no Shopify app install,
   no paired WooCommerce plugin and no pasted code. A read that fails
   throws, so the page shows the dashboard's error state rather than a
   status it could not see. */

async function readSiteStatus(siteId: string): Promise<string> {
  const result = await getMessengerServiceClient().from('widget_sites').select('status').eq('id', siteId).maybeSingle();
  if (result.error) throw new Error(`store chat site read failed: ${result.error.message}`);
  if (!result.data) throw new Error('store chat site not found');
  return (result.data as { status: string }).status;
}

async function readLaunchState(activeStore: ActiveStore, tenant: string, now: number): Promise<LaunchState> {
  const flagStore = flagStoreOf(activeStore);
  if (!flagStore || !(await storeFlags(flagStore)).includes('n5_preview_mode')) return 'live';
  return launchView(await getStoreLaunch(tenant, now), new Date(now)).state;
}

function hostOf(url: string): { host: string; href: string } | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? { host: parsed.host, href: parsed.href } : null;
  } catch {
    return null;
  }
}

const shopUrl = (domain: string) => ({ host: domain, href: `https://${domain}` });

/** The address a pasted website shows first: one confirmed live, else the
 *  one our code last reported from, else the first one added. */
function pasteWebsiteAddress(status: PasteInstallStatus): string | null {
  const live = status.domains.find((domain) => domain.domainVerified && domain.state === 'trusted');
  return live?.domain ?? status.seenHost ?? status.domains[0]?.domain ?? null;
}

/** The latest signal from pasted code: the Shopify shop host, or any of the
 *  website's trusted addresses. */
function pasteLastSeenAt(status: PasteInstallStatus): string | null {
  const times = [status.shopLastSeenAt, ...status.domains.filter((domain) => domain.state === 'trusted').map((domain) => domain.lastSeenAt)]
    .filter((at): at is string => Boolean(at) && Number.isFinite(Date.parse(at!)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return times[0] ?? null;
}

function looksOf(entitlement: ShopEntitlement) {
  return {
    looksLeft: entitlement.totalCreditsRemaining,
    looksIncluded: entitlement.rendersIncluded + entitlement.topUpCreditsRemaining,
    planActive: entitlement.status === 'active' || entitlement.status === 'grace',
  };
}

export async function getYourStoreFacts({
  activeStore,
  role,
  timeZone,
  now = Date.now(),
  installedShop,
}: {
  activeStore: ActiveStore;
  role: DashboardWorkspaceRole;
  timeZone: string;
  now?: number;
  /** Background checks supply their service-read install state, without a Clerk request. */
  installedShop?: boolean;
}): Promise<YourStoreFacts | null> {
  const tenant = activeTenantKey(activeStore);
  const siteId = activeStore.siteId;
  if (!tenant) return null;

  let platform: YourStorePlatform;
  let paste: PasteInstallStatus | null = null;
  let siteStatus: string | null = null;
  let code: YourStoreFacts['code'];
  let url: { host: string; href: string } | null = null;

  if (activeStore.platform === 'shopify' && activeStore.shopDomain) {
    const installed = installedShop ?? (await listDashboardShops()).find((shop) => shop.domain === activeStore.shopDomain)?.status === 'installed';
    if (!installed) return null;
    platform = 'shopify_app';
    // The app reports its install; it has no storefront signal to time.
    code = { lastSeenAt: null, connected: true };
    url = shopUrl(activeStore.shopDomain);
    siteStatus = siteId ? await readSiteStatus(siteId) : null;
  } else if (activeStore.platform === 'woocommerce' && siteId) {
    const [connection, status] = await Promise.all([getWooSiteConnection(siteId), readSiteStatus(siteId)]);
    if (connection?.status !== 'active') return null;
    platform = 'woocommerce';
    siteStatus = status;
    // The plugin's daily heartbeat is its signal.
    code = { lastSeenAt: connection.lastSeenAt, connected: true };
    url = hostOf(connection.homeUrl);
  } else if (activeStore.platform === 'paste' && siteId) {
    siteStatus = await readSiteStatus(siteId);
    paste = await readPasteInstallStatus({ id: siteId, status: siteStatus }, new Date(now));
    if (!paste.connected) return null;
    platform = paste.platform === 'shopify' ? 'paste_shopify' : 'paste_website';
    code = { lastSeenAt: pasteLastSeenAt(paste), connected: false };
    const address = platform === 'paste_shopify' ? paste.shopDomain : pasteWebsiteAddress(paste);
    url = address ? shopUrl(address) : null;
  } else {
    return null;
  }

  const [showButton, entitlement, launchState, health, pillsOn, domainPlatforms, placement] = await Promise.all([
    readTryOnShowButton(tenant),
    paste ? Promise.resolve(paste.plan) : getShopEntitlement(tenant),
    paste ? Promise.resolve(paste.mode) : readLaunchState(activeStore, tenant, now),
    readHealthCounts(siteId ? [siteId] : [], now),
    readTryOnShowCardPill(tenant),
    platform === 'paste_website' && siteId ? readPasteDomainPlatforms(siteId) : Promise.resolve(null),
    // The Shopify app block is placed in the theme editor. A failed read only softens Store check.
    platform === 'shopify_app' ? Promise.resolve(null) : readButtonPlacement(tenant).then((value) => value.placement, () => null),
  ]);

  return {
    now,
    timeZone,
    platform,
    address: url?.host ?? null,
    storeUrl: url?.href ?? null,
    canChange: roleCan(role, 'settings'),
    canBilling: roleCan(role, 'billing'),
    code,
    launchState,
    codeOutdated: paste?.codeOutdated ?? false,
    health,
    ...(placement ? { placement } : {}),
    pillsOn,
    wooDetected: domainPlatforms?.some((domain) => domain.platform === 'woocommerce') ?? false,
    easyOrders: domainPlatforms?.some((domain) => domain.platform === 'easyorders') ?? false,
    tryOn: { tenant, showButton, ...looksOf(entitlement), pasteReason: paste?.tryOnReason ?? null },
    chat: siteId && siteStatus !== null ? { siteId, enabled: siteStatus === 'active' } : null,
    domains:
      platform === 'paste_website' && paste
        ? paste.domains.map((domain) => ({
            id: domain.id,
            domain: domain.domain,
            verified: domain.domainVerified,
            state: domain.state,
            reason: domain.verificationReason,
          }))
        : [],
  };
}
