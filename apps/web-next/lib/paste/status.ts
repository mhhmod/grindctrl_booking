import 'server-only';
import { ACTIVE_INSTALL_WINDOW_MS } from '@/lib/adapters/install';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { getShopEntitlement, type ShopEntitlement } from '@/lib/try-on/entitlement';
import { tryOnLaunchFromEntitlement } from '@/lib/try-on/launch';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { launchView, type LaunchState } from '@/lib/launch/audience';
import { storeFlags } from '@/lib/flags/store-flags';
import { pasteCapabilitySecret } from './signing';
import { getPasteConnection, listPasteDomains, pasteShopHost, pasteTrust } from './store';
import { pasteTurnstileSiteKey } from './turnstile';
import type { PasteDomain, PastePlatform } from './types';

/** Why the connection is not trusted yet; null once it is. */
export type PasteConnectionReason =
  | 'paste_not_connected'
  /** Shopify: enabled, waiting for the first signed render from the shop. */
  | 'shop_proof_pending'
  /** Another site's signed render proved this shop; re-enable to claim it back. */
  | 'shop_proven_elsewhere'
  /** The GrindCtrl Shopify app is installed on this shop and takes precedence. */
  | 'shopify_app_installed';

export type PasteInstallStatus = {
  siteId: string;
  tenantKey: string;
  platform: PastePlatform | null;
  /** The signed Shopify shop (implicitly trusted once proven); null for websites. */
  shopDomain: string | null;
  /** Shopify only: `pending` until a signed render from the shop's theme
   *  arrives ("Waiting for your code on your store"), then `proven`. */
  shopProof: 'pending' | 'proven' | null;
  shopProvenAt: string | null;
  /** Signals on the shop host itself, which is not one of `domains`. */
  shopFirstSeenAt: string | null;
  shopLastSeenAt: string | null;
  /** Paste install is enabled for this site (a pending Shopify shop included):
   *  show the snippet and steps. */
  connected: boolean;
  /** Our code is trusted on this site's hosts: origins, signals, Try-On. */
  trusted: boolean;
  connectionReason: PasteConnectionReason | null;
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
  const trust = pasteTrust(connection);
  const connected = connection?.status === 'active' || connection?.status === 'pending';
  const trusted = trust === 'trusted';
  const connectionReason: PasteConnectionReason | null = trusted ? null
    : trust === 'not_connected' ? (connection?.disconnected_reason === 'displaced' ? 'shop_proven_elsewhere' : 'paste_not_connected')
    : trust;
  const shop = connected && connection?.platform === 'shopify' ? connection : null;
  const trustedDomains = trusted ? domains.filter((domain) => domain.state === 'trusted') : [];
  const shopHost = pasteShopHost(connection);
  const signals = [
    ...trustedDomains.map((domain) => ({ host: domain.domain, at: domain.lastSeenAt })),
    ...(shopHost ? [{ host: shopHost, at: connection?.last_seen_at ?? null }] : []),
  ].flatMap(({ host, at }) => {
    const time = at ? Date.parse(at) : NaN;
    return Number.isFinite(time) && now.getTime() - time <= ACTIVE_INSTALL_WINDOW_MS ? [{ host, time }] : [];
  }).sort((a, b) => b.time - a.time);
  const seen = signals.length > 0;
  const entitlement = tryOnLaunchFromEntitlement(plan);
  const mode = features.includes('n5_preview_mode') ? launchView(launch, now).state : 'live';
  const turnstileConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim() && pasteTurnstileSiteKey());
  const reason = connectionReason ?? (!trustedDomains.length && !shopHost ? 'no_trusted_domain'
    : !pasteCapabilitySecret(site.id) ? 'unavailable' : mode === 'setup' || mode === 'preview' ? 'preview'
    : connection?.platform === 'website' && !turnstileConfigured ? 'turnstile_not_configured' : entitlement.reason);
  return {
    siteId: site.id, tenantKey, platform: connection?.platform ?? null, shopDomain: connection?.shop_domain ?? null,
    shopProof: shop ? (shop.status === 'active' && shop.shop_proven_at ? 'proven' : 'pending') : null,
    shopProvenAt: shop?.shop_proven_at ?? null,
    shopFirstSeenAt: shopHost ? connection?.first_seen_at ?? null : null,
    shopLastSeenAt: shopHost ? connection?.last_seen_at ?? null : null,
    connected, trusted, connectionReason, domains, seen, seenHost: seen ? signals[0].host : null,
    chatLive: site.status === 'active' && seen && (mode === 'live' || mode === 'holdout'),
    tryOnReady: site.status !== 'disabled' && !reason,
    tryOnReason: site.status === 'disabled' ? 'site_disabled' : reason,
    plan, mode, secretVersion: connection?.secret_version ?? null,
    rotationOverlapUntil: connection?.previous_valid_until ?? null,
    turnstileConfigured,
  };
}
