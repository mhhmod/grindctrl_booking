import 'server-only';
import { ACTIVE_INSTALL_WINDOW_MS } from '@/lib/adapters/install';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { getShopEntitlement, type ShopEntitlement } from '@/lib/try-on/entitlement';
import { tryOnLaunchFromEntitlement } from '@/lib/try-on/launch';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { launchView, type LaunchState } from '@/lib/launch/audience';
import { storeFlags } from '@/lib/flags/store-flags';
import { pasteCapabilitySecret } from './signing';
import { getPasteConnection, listPasteDomains, pasteShopHost } from './store';
import type { PasteDomain, PastePlatform } from './types';

export type PasteInstallStatus = {
  siteId: string;
  tenantKey: string;
  platform: PastePlatform | null;
  /** The signed Shopify shop (implicitly trusted); null for websites. */
  shopDomain: string | null;
  /** Signals on the shop host itself, which is not one of `domains`. */
  shopFirstSeenAt: string | null;
  shopLastSeenAt: string | null;
  connected: boolean;
  domains: PasteDomain[];
  /** Our code ran on a trusted domain or the shop host within the active
   *  install window, whatever the launch mode. This is "installed". */
  seen: boolean;
  /** The host of the most recent signal inside that window; null when not seen. */
  seenHost: string | null;
  /** Shoppers see Store Chat: seen, site active and launched (live/holdout). */
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
  const shopHost = pasteShopHost(connection);
  const signals = [
    ...trusted.map((domain) => ({ host: domain.domain, at: domain.lastSeenAt })),
    ...(shopHost ? [{ host: shopHost, at: connection?.last_seen_at ?? null }] : []),
  ].flatMap(({ host, at }) => {
    const time = at ? Date.parse(at) : NaN;
    return Number.isFinite(time) && now.getTime() - time <= ACTIVE_INSTALL_WINDOW_MS ? [{ host, time }] : [];
  }).sort((a, b) => b.time - a.time);
  const seen = connected && signals.length > 0;
  const entitlement = tryOnLaunchFromEntitlement(plan);
  const mode = features.includes('n5_preview_mode') ? launchView(launch, now).state : 'live';
  const turnstileConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
  const reason = !connected ? 'paste_not_connected' : !trusted.length && !shopHost ? 'no_trusted_domain'
    : !pasteCapabilitySecret(site.id) ? 'unavailable' : mode === 'setup' || mode === 'preview' ? 'preview'
    : connection?.platform === 'website' && !turnstileConfigured ? 'turnstile_not_configured' : entitlement.reason;
  return {
    siteId: site.id, tenantKey, platform: connection?.platform ?? null, shopDomain: connection?.shop_domain ?? null,
    shopFirstSeenAt: shopHost ? connection?.first_seen_at ?? null : null,
    shopLastSeenAt: shopHost ? connection?.last_seen_at ?? null : null,
    connected, domains, seen, seenHost: seen ? signals[0].host : null,
    chatLive: site.status === 'active' && seen && (mode === 'live' || mode === 'holdout'),
    tryOnReady: site.status !== 'disabled' && !reason,
    tryOnReason: site.status === 'disabled' ? 'site_disabled' : reason,
    plan, mode, secretVersion: connection?.secret_version ?? null,
    rotationOverlapUntil: connection?.previous_valid_until ?? null,
    turnstileConfigured,
  };
}
