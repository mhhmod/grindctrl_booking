import 'server-only';
import { ACTIVE_INSTALL_WINDOW_MS } from '@/lib/adapters/install';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { getShopEntitlement, type ShopEntitlement } from '@/lib/try-on/entitlement';
import { tryOnLaunchFromEntitlement } from '@/lib/try-on/launch';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { launchView, type LaunchState } from '@/lib/launch/audience';
import { storeFlags } from '@/lib/flags/store-flags';
import { pasteCapabilitySecret } from './signing';
import { getPasteConnection, listPasteDomains } from './store';
import type { PasteDomain, PastePlatform } from './types';

export type PasteInstallStatus = {
  siteId: string;
  tenantKey: string;
  platform: PastePlatform | null;
  connected: boolean;
  domains: PasteDomain[];
  chatLive: boolean;
  tryOnReady: boolean;
  tryOnReason: string | null;
  plan: ShopEntitlement;
  mode: LaunchState;
  secretVersion: number | null;
  rotationOverlapUntil: string | null;
  turnstileConfigured: boolean;
};

/** Authorized server caller supplies the site's stored status; no mutation,
 * free-plan grant or secret material occurs during a status read. */
export async function readPasteInstallStatus(site: { id: string; status: string }, now = new Date()): Promise<PasteInstallStatus> {
  const tenantKey = siteTenantKey(site.id);
  const [connection, domains, plan, launch, features] = await Promise.all([
    getPasteConnection(site.id), listPasteDomains(site.id), getShopEntitlement(tenantKey),
    getStoreLaunch(tenantKey), storeFlags({ widgetSiteId: site.id }),
  ]);
  const connected = connection?.status === 'active';
  const trusted = domains.filter((domain) => domain.state === 'trusted');
  const liveSignal = trusted.some((domain) => domain.lastSeenAt
    && now.getTime() - Date.parse(domain.lastSeenAt) <= ACTIVE_INSTALL_WINDOW_MS);
  const entitlement = tryOnLaunchFromEntitlement(plan);
  const mode = features.includes('n5_preview_mode') ? launchView(launch, now).state : 'live';
  const turnstileConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
  const reason = !connected ? 'paste_not_connected' : !trusted.length ? 'no_trusted_domain'
    : !pasteCapabilitySecret(site.id) ? 'unavailable' : mode === 'setup' || mode === 'preview' ? 'preview'
    : connection?.platform === 'website' && !turnstileConfigured ? 'turnstile_not_configured' : entitlement.reason;
  return {
    siteId: site.id, tenantKey, platform: connection?.platform ?? null, connected, domains,
    chatLive: site.status === 'active' && connected && liveSignal && (mode === 'live' || mode === 'holdout'),
    tryOnReady: site.status !== 'disabled' && !reason,
    tryOnReason: site.status === 'disabled' ? 'site_disabled' : reason,
    plan, mode, secretVersion: connection?.secret_version ?? null,
    rotationOverlapUntil: connection?.previous_valid_until ?? null,
    turnstileConfigured,
  };
}
