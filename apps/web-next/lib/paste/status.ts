import 'server-only';
import { ACTIVE_INSTALL_WINDOW_MS } from '@/lib/adapters/install';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { getShopEntitlement, type ShopEntitlement } from '@/lib/try-on/entitlement';
import { tryOnLaunchFromEntitlement } from '@/lib/try-on/launch';
import { readTryOnShowButton } from '@/lib/try-on/settings';
import { getStoreLaunch } from '@/lib/launch/store-launch';
import { launchView, type LaunchState } from '@/lib/launch/audience';
import { storeFlags } from '@/lib/flags/store-flags';
import { pasteCapabilitySecret } from './signing';
import { getPasteConnection, listPasteDomains, pasteShopHost, pasteTrust, readPasteCodeVersion } from './store';
import { pasteTurnstileSiteKey } from './turnstile';
import { cachedShopCheck, SHOP_CHECK_RETRY_SECONDS } from './shop-proof';
import { PASTE_SHOPIFY_CODE_VERSION, type PasteDomain, type PastePlatform, type PasteShopCheckOutcome } from './types';

/** Why the connection is not trusted yet; null once it is. */
export type PasteConnectionReason =
  | 'paste_not_connected'
  /** Shopify: enabled, waiting for the storefront proof (see `shopCheck`). */
  | 'shop_proof_pending'
  /** Another site proved this shop from its storefront; re-enable to claim it back. */
  | 'shop_proven_elsewhere'
  /** The GrindCtrl Shopify app is installed on this shop and takes precedence. */
  | 'shopify_app_installed';

export type PasteInstallStatus = {
  siteId: string;
  tenantKey: string;
  platform: PastePlatform | null;
  /** The signed Shopify shop (implicitly trusted once proven); null for websites. */
  shopDomain: string | null;
  /** Shopify only: `pending` ("Waiting for your code on your store") until
   *  our server found this site's snippet on the shop's storefront and a
   *  signed render arrived from it, then `proven`. */
  shopProof: 'pending' | 'proven' | null;
  shopProvenAt: string | null;
  /** Shopify only: the last storefront check (provePasteShopAction or a
   *  render), null before the first one. `retryAfterSeconds` is how long
   *  "Check my store" reuses a failed result (a password skips the wait). */
  shopCheck: { outcome: PasteShopCheckOutcome; checkedAt: string; retryAfterSeconds: number | null } | null;
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
  /** The merchant's Try-On button switch (tryon_settings.show_button); null
   *  when it could not be read. Off hides the button whatever `tryOnReady`
   *  says: shoppers' context requests are refused as `paused`. */
  showButton: boolean | null;
  /** Shopify: the snippet version (`data-gc-v`, 1 when the tag has none)
   *  seen in the latest verified signed render; null before one arrived,
   *  for website code, or before 20261108_paste_code_version.sql runs. */
  codeVersion: number | null;
  codeVersionSeenAt: string | null;
  /** The store runs older pasted code than the snippet we hand out now
   *  (PASTE_SHOPIFY_CODE_VERSION): ask the merchant to copy the new code.
   *  Version 2 adds the "Try on" pill on product cards. False while unknown. */
  codeOutdated: boolean;
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
  const [connection, domains, plan, launch, features, showButton, seenCode] = await Promise.all([
    getPasteConnection(site.id), listPasteDomains(site.id), getShopEntitlement(tenantKey),
    getStoreLaunch(tenantKey), storeFlags({ widgetSiteId: site.id }),
    readTryOnShowButton(tenantKey).catch(() => null),
    // A dashboard hint: an unreadable version must not fail the status.
    readPasteCodeVersion(site.id).catch(() => null),
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
  const code = connected && connection?.platform === 'shopify' ? seenCode : null;
  const turnstileConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim() && pasteTurnstileSiteKey());
  const reason = connectionReason ?? (!trustedDomains.length && !shopHost ? 'no_trusted_domain'
    : !pasteCapabilitySecret(site.id) ? 'unavailable' : mode === 'setup' || mode === 'preview' ? 'preview'
    : connection?.platform === 'website' && !turnstileConfigured ? 'turnstile_not_configured' : entitlement.reason);
  return {
    siteId: site.id, tenantKey, platform: connection?.platform ?? null, shopDomain: connection?.shop_domain ?? null,
    shopProof: shop ? (shop.status === 'active' && shop.shop_proven_at ? 'proven' : 'pending') : null,
    shopProvenAt: shop?.shop_proven_at ?? null,
    shopCheck: shop?.shop_check_outcome && shop.shop_checked_at ? {
      outcome: shop.shop_check_outcome, checkedAt: shop.shop_checked_at,
      retryAfterSeconds: cachedShopCheck(shop, SHOP_CHECK_RETRY_SECONDS.owner, now.getTime())?.retryAfterSeconds ?? null,
    } : null,
    shopFirstSeenAt: shopHost ? connection?.first_seen_at ?? null : null,
    shopLastSeenAt: shopHost ? connection?.last_seen_at ?? null : null,
    connected, trusted, connectionReason, domains, seen, seenHost: seen ? signals[0].host : null,
    chatLive: site.status === 'active' && seen && (mode === 'live' || mode === 'holdout'),
    tryOnReady: site.status !== 'disabled' && !reason,
    tryOnReason: site.status === 'disabled' ? 'site_disabled' : reason,
    showButton,
    codeVersion: code?.version ?? null,
    codeVersionSeenAt: code?.seenAt ?? null,
    codeOutdated: code !== null && code.version < PASTE_SHOPIFY_CODE_VERSION,
    plan, mode, secretVersion: connection?.secret_version ?? null,
    rotationOverlapUntil: connection?.previous_valid_until ?? null,
    turnstileConfigured,
  };
}
