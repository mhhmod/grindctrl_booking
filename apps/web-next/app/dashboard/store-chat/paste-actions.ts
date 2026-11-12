'use server';

import { auth } from '@clerk/nextjs/server';
import { pasteShopperPrivacy } from '@/lib/paste/privacy';
import { scheduleStoreConnectedEmail } from '@/lib/email/store-connected-sender';
import { recordAudit } from '@/lib/messenger/conversations';
import { scheduleProductsRefresh } from '@/lib/messenger/products-refresh';
import { requireSiteAccess, UnauthorizedError } from '@/lib/messenger/provisioning';
import { RoleNotAllowedError, type DashboardCapability } from '@/lib/rbac/dashboard-policy';
import { requireMerchantRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import {
  addPasteDomain, removePasteDomain, provePasteDomain, provePasteDomainMeta, disconnectPasteInstall, enablePasteInstall, getPasteConnection,
  grantPasteDomainPlan, listPasteDomains, normalizePasteDomain, pasteTrust, rotatePasteSecret, shopAppInstalled,
} from '@/lib/paste/store';
import { listActiveWooSiteIds } from '@/lib/woo/connection';
import { buildPasteSnippet } from '@/lib/paste/snippet';
import { schedulePasteDomainPlatformCheck } from '@/lib/paste/platform-check';
import { checkPasteDomain } from '@/lib/paste/domain-check';
import { readPasteInstallStatus, type PasteInstallStatus } from '@/lib/paste/status';
import { pasteCapabilitySecret } from '@/lib/paste/signing';
import {
  PasteError, type PasteConflictHolder, type PasteDomain, type PasteDomainCheck, type PastePlatform, type PasteResult, type PasteShopProof,
  type PasteSnippet,
} from '@/lib/paste/types';
async function authorized<T>(siteId: string, capability: DashboardCapability, mode: 'read' | 'write',
  work: (site: Awaited<ReturnType<typeof requireSiteAccess>>, userId: string) => Promise<T>): Promise<PasteResult<T>> {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, code: 'forbidden', signedOut: true };
    const site = await requireSiteAccess(userId, siteId, capability);
    await requireMerchantRateLimit(`paste:${site.id}:${userId}`, mode);
    const data = await work(site, userId);
    if (mode === 'write') invalidateProxyConfig(siteTenantKey(site.id));
    return { ok: true, data };
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof RoleNotAllowedError) return { ok: false, code: 'forbidden' };
    if (error instanceof PasteError) return { ok: false, code: error.code };
    if (error instanceof RequestRateLimitError) return { ok: false, code: error.status === 429 ? 'rate_limited' : 'unavailable', retryAfterSeconds: error.retryAfterSeconds };
    return { ok: false, code: 'unavailable' };
  }
}

/** Explicit opt-in for existing own-website sites; ordinary site provisioning
 * and app/plugin installs keep their existing flows. Owner only. */
export async function enablePasteInstallAction(siteId: string, platform: PastePlatform, shopDomain?: string): Promise<PasteResult<{ tenantKey: string }>> {
  let holder: Promise<PasteConflictHolder | null> = Promise.resolve(null);
  const result = await authorized(siteId, 'store', 'write', async (site) => {
    if (platform !== 'website' && platform !== 'shopify') throw new PasteError('invalid_platform');
    const shop = platform === 'shopify' ? normalizeShopDomain(shopDomain) : null;
    if (platform === 'shopify' && !shop) throw new PasteError('invalid_platform');
    if (!pasteCapabilitySecret(site.id)) throw new PasteError('unavailable');
    try {
      await enablePasteInstall(site.id, platform, shop);
    } catch (error) {
      if (error instanceof PasteError && error.code === 'connection_conflict') holder = conflictHolder(site, shop);
      throw error;
    }
    return { tenantKey: siteTenantKey(site.id) };
  });
  const heldBy = await holder;
  return !result.ok && heldBy ? { ...result, heldBy } : result;
}

/** Which connection holds the store after enable_paste_install refused it,
 *  read only to word the answer. Null when it cannot be told. Never throws. */
async function conflictHolder(site: { id: string; domain: string | null }, shop: string | null): Promise<PasteConflictHolder | null> {
  try {
    const existing = await getPasteConnection(site.id);
    if (existing && existing.status !== 'disconnected') {
      return existing.app_installed ? { kind: 'shopify_app', store: existing.shop_domain }
        : { kind: 'paste', platform: existing.platform, store: existing.shop_domain };
    }
    if ((await listActiveWooSiteIds([site.id])).has(site.id)) return { kind: 'woocommerce' };
    if (site.domain?.endsWith('.myshopify.com')) return { kind: 'shopify_app', store: site.domain };
    if (shop && await shopAppInstalled(shop)) return { kind: 'shopify_app', store: shop };
    return null;
  } catch {
    return null;
  }
}

/** "Use a different store": the owner undoes the pasted install. The code on
 * the store stops working at once and its addresses are released; plan,
 * looks stay with this account. The privacy trigger schedules shopper data
 * removal in 30 days unless the site reconnects. Audited. Owner only. */
export async function disconnectPasteInstallAction(siteId: string): Promise<PasteResult<null>> {
  return authorized(siteId, 'store', 'write', async (site, userId) => {
    let released;
    try {
      released = await disconnectPasteInstall(site.id);
    } catch (error) {
      // Before 20261111_paste_disconnect.sql runs: not "installing is almost ready".
      throw error instanceof PasteError && error.code === 'schema_not_ready' ? new PasteError('unavailable') : error;
    }
    await recordAudit({ siteId: site.id, actorClerkUserId: userId, action: 'store_disconnected',
      detail: { install: 'paste', platform: released.platform, shop_domain: released.shopDomain } });
    return null;
  });
}

/** A domain the owner just proved by DNS or meta tag is verified: claim the
 * website free plan with it (the RPC re-checks the verification) and
 * fingerprint its store platform after the response. */
async function afterProof(siteId: string, domain: PasteDomain): Promise<PasteDomain> {
  if (domain.state !== 'trusted') return domain;
  await grantPasteDomainPlan(siteId, domain.domain);
  schedulePasteDomainPlatformCheck(siteId, domain.domain);
  if (domain.domainVerified) {
    scheduleStoreConnectedEmail(siteId, { path: 'website_paste', host: domain.domain });
    scheduleProductsRefresh(siteId);
  }
  return domain;
}

/** Adding a domain looks for the code on it at once, so a store that already
 * has the code is confirmed in the same step. The domain is added either
 * way: a check that cannot run leaves it waiting for the automatic one. */
export async function addPasteDomainAction(siteId: string, domain: string): Promise<PasteResult<PasteDomain>> {
  return authorized(siteId, 'settings', 'write', async (site, userId) => {
    const added = await addPasteDomain(site.id, domain);
    await recordAudit({ siteId: site.id, actorClerkUserId: userId, action: 'trusted_domain_added', detail: { domain_id: added.id, domain: added.domain, state: added.state } });
    if (added.domainVerified || added.state === 'disputed') return added;
    try {
      return (await checkPasteDomain({ id: site.id, embedKey: site.embed_key }, added, 'added')).domain;
    } catch {
      return added;
    }
  });
}

/** "Check my store" for one website domain: our server looks for this
 * site's code on the domain's home page. */
export async function checkPasteDomainAction(siteId: string, domainId: string): Promise<PasteResult<PasteDomainCheck>> {
  return authorized(siteId, 'settings', 'write', async (site) => {
    const domain = (await listPasteDomains(site.id)).find((row) => row.id === domainId);
    if (!domain) throw new PasteError('not_found');
    if (domain.domainVerified) return { domain, outcome: 'verified', retryAfterSeconds: null };
    return checkPasteDomain({ id: site.id, embedKey: site.embed_key }, domain, 'owner');
  });
}

export async function removePasteDomainAction(siteId: string, domainId: string): Promise<PasteResult<null>> {
  return authorized(siteId, 'settings', 'write', async (site, userId) => {
    await removePasteDomain(site.id, domainId);
    await recordAudit({ siteId: site.id, actorClerkUserId: userId, action: 'trusted_domain_removed', detail: { domain_id: domainId } });
    return null;
  });
}

export async function provePasteDomainAction(siteId: string, domainId: string): Promise<PasteResult<PasteDomain>> {
  return authorized(siteId, 'settings', 'write', async (site) => afterProof(site.id, await provePasteDomain(site.id, domainId)));
}

export async function provePasteDomainMetaAction(siteId: string, domainId: string): Promise<PasteResult<PasteDomain>> {
  return authorized(siteId, 'settings', 'write', async (site) => afterProof(site.id, await provePasteDomainMeta(site.id, domainId)));
}

export async function rotatePasteSecretAction(siteId: string): Promise<PasteResult<{ version: number; overlapUntil: string }>> {
  return authorized(siteId, 'store', 'write', async (site, userId) => {
    const result = await rotatePasteSecret(site.id);
    await recordAudit({ siteId: site.id, actorClerkUserId: userId, action: 'site_key_regenerated', detail: { version: result.version } });
    return result;
  });
}

/** Only this owner-only action returns Liquid containing a derived secret.
 * Rotation returns metadata; status never includes a secret or a snippet. */
export async function getPasteSnippetAction(siteId: string): Promise<PasteResult<PasteSnippet>> {
  return authorized(siteId, 'store', 'read', async (site) => {
    // A pending Shopify shop needs its snippet: pasting it is how it proves.
    const connection = await getPasteConnection(site.id);
    const trust = pasteTrust(connection);
    if (!connection || trust === 'not_connected') throw new PasteError('not_found');
    if (trust === 'shopify_app_installed') throw new PasteError('connection_conflict');
    return buildPasteSnippet(connection, site.embed_key);
  });
}

/** "Check my store": our server fetches the pending shop's storefront and
 * looks for this site's signed snippet. Once found, and a signed render has
 * come from the store (opening any product page), this site holds the shop.
 * `storefrontPassword` opens a password-protected store for this one check;
 * it is never stored, logged or returned. Owner only, like enabling. */
export async function provePasteShopAction(siteId: string, storefrontPassword?: string): Promise<PasteResult<PasteShopProof>> {
  return authorized(siteId, 'store', 'write', async (site, userId) => {
    const password = typeof storefrontPassword === 'string' && storefrontPassword !== '' ? storefrontPassword : undefined;
    const connection = await getPasteConnection(site.id);
    const { checkPasteShop } = await import('@/lib/paste/shop-proof');
    const result = await checkPasteShop(connection, { kind: 'owner', password });
    const primary = result.storefront?.primaryHost;
    if (!result.storefront || !primary) return result;
    const addedDomain = await addShopPrimaryDomain(site, userId, primary, result.storefront.passwordPage);
    return { ...result, storefront: { ...result.storefront, addedDomain } };
  });
}

/** The shop sent our server's fetch on to its custom primary domain and the
 *  code was there: that domain is where shoppers (and the render that
 *  finishes the proof) come from. Added exactly like "Add" on the address
 *  form, audit row and snippet check included; a store behind its password
 *  page is left for the automatic check, since its home page shows only the
 *  password form. Returns the added domain, or null when it was already
 *  there or could not be added (the proof result stands either way). */
async function addShopPrimaryDomain(site: { id: string; embed_key: string }, userId: string, host: string,
  passwordPage: boolean): Promise<string | null> {
  try {
    const name = normalizePasteDomain(host);
    if (!name || (await listPasteDomains(site.id)).some((row) => row.domain === name)) return null;
    const added = await addPasteDomain(site.id, name);
    await recordAudit({ siteId: site.id, actorClerkUserId: userId, action: 'trusted_domain_added',
      detail: { domain_id: added.id, domain: added.domain, state: added.state, source: 'shop_check' } });
    if (!passwordPage && !added.domainVerified && added.state !== 'disputed') {
      await checkPasteDomain({ id: site.id, embedKey: site.embed_key }, added, 'added').catch(() => null);
    }
    return added.domain;
  } catch {
    console.error('[paste] primary domain not added', { code: 'paste_primary_domain', site: site.id });
    return null;
  }
}

export async function getPasteInstallStatusAction(siteId: string): Promise<PasteResult<PasteInstallStatus>> {
  // Includes the complete billing state, so it is the owner's alone.
  return authorized(siteId, 'store', 'read', (site) => readPasteInstallStatus(site));
}

/** Owner-only privacy fulfilment, reusing the plugin's bounded export/erase
 * and durable Storage queue. Each call handles one page/batch. */
export async function pastePrivacyRequestAction(siteId: string, operation: 'export' | 'erase', request: unknown) {
  return authorized(siteId, 'store', operation === 'export' ? 'read' : 'write', async (site) => {
    if (operation !== 'export' && operation !== 'erase') throw new PasteError('invalid_request');
    return pasteShopperPrivacy(site.id, operation, request);
  });
}
