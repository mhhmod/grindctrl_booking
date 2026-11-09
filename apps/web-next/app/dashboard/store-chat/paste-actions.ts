'use server';

import { auth } from '@clerk/nextjs/server';
import { requireSiteAccess, UnauthorizedError } from '@/lib/messenger/provisioning';
import { RoleNotAllowedError, type DashboardCapability } from '@/lib/rbac/dashboard-policy';
import { requireMerchantRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';
import { siteTenantKey } from '@/lib/tenancy/tenant-key';
import { addPasteDomain, removePasteDomain, provePasteDomain, provePasteDomainMeta, enablePasteInstall, getPasteConnection, pasteTrust, rotatePasteSecret } from '@/lib/paste/store';
import { buildPasteSnippet } from '@/lib/paste/snippet';
import { schedulePasteDomainPlatformCheck } from '@/lib/paste/platform-check';
import { readPasteInstallStatus, type PasteInstallStatus } from '@/lib/paste/status';
import { pasteCapabilitySecret } from '@/lib/paste/signing';
import { PasteError, type PasteDomain, type PastePlatform, type PasteResult, type PasteShopProof, type PasteSnippet } from '@/lib/paste/types';
async function authorized<T>(siteId: string, capability: DashboardCapability, mode: 'read' | 'write',
  work: (site: Awaited<ReturnType<typeof requireSiteAccess>>) => Promise<T>): Promise<PasteResult<T>> {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, code: 'forbidden' };
    const site = await requireSiteAccess(userId, siteId, capability);
    await requireMerchantRateLimit(`paste:${site.id}:${userId}`, mode);
    const data = await work(site);
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
  return authorized(siteId, 'store', 'write', async (site) => {
    if (platform !== 'website' && platform !== 'shopify') throw new PasteError('invalid_platform');
    const shop = platform === 'shopify' ? normalizeShopDomain(shopDomain) : null;
    if (platform === 'shopify' && !shop) throw new PasteError('invalid_platform');
    if (!pasteCapabilitySecret(site.id)) throw new PasteError('unavailable');
    await enablePasteInstall(site.id, platform, shop);
    return { tenantKey: siteTenantKey(site.id) };
  });
}

/** A domain that just became trusted gets its store platform fingerprinted
 * after the response (which platform image servers its photos may use). */
function fingerprintWhenTrusted(siteId: string, domain: PasteDomain): PasteDomain {
  if (domain.state === 'trusted') schedulePasteDomainPlatformCheck(siteId, domain.domain);
  return domain;
}

export async function addPasteDomainAction(siteId: string, domain: string): Promise<PasteResult<PasteDomain>> {
  return authorized(siteId, 'settings', 'write', async (site) => fingerprintWhenTrusted(site.id, await addPasteDomain(site.id, domain)));
}

export async function removePasteDomainAction(siteId: string, domainId: string): Promise<PasteResult<null>> {
  return authorized(siteId, 'settings', 'write', async (site) => { await removePasteDomain(site.id, domainId); return null; });
}

export async function provePasteDomainAction(siteId: string, domainId: string): Promise<PasteResult<PasteDomain>> {
  return authorized(siteId, 'settings', 'write', async (site) => fingerprintWhenTrusted(site.id, await provePasteDomain(site.id, domainId)));
}

export async function provePasteDomainMetaAction(siteId: string, domainId: string): Promise<PasteResult<PasteDomain>> {
  return authorized(siteId, 'settings', 'write', async (site) => fingerprintWhenTrusted(site.id, await provePasteDomainMeta(site.id, domainId)));
}

export async function rotatePasteSecretAction(siteId: string): Promise<PasteResult<{ version: number; overlapUntil: string }>> {
  return authorized(siteId, 'store', 'write', (site) => rotatePasteSecret(site.id));
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
  return authorized(siteId, 'store', 'write', async (site) => {
    const password = typeof storefrontPassword === 'string' && storefrontPassword !== '' ? storefrontPassword : undefined;
    const connection = await getPasteConnection(site.id);
    const { checkPasteShop } = await import('@/lib/paste/shop-proof');
    return checkPasteShop(connection, { kind: 'owner', password });
  });
}

export async function getPasteInstallStatusAction(siteId: string): Promise<PasteResult<PasteInstallStatus>> {
  // Includes the complete billing state, so it is the owner's alone.
  return authorized(siteId, 'store', 'read', (site) => readPasteInstallStatus(site));
}
