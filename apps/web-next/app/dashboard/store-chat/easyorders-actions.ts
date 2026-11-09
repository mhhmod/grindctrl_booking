'use server';

import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireSiteAccess, UnauthorizedError } from '@/lib/messenger/provisioning';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { requireMerchantRateLimit, RequestRateLimitError } from '@/lib/request-rate-limit';
import { createInstallLink } from '@/lib/easyorders/install';
import { cancelInstall, confirmInstall, inspectInstall, readReturnState } from '@/lib/easyorders/activation';
import type { InstallState } from '@/lib/easyorders/state';
import { loadEasyOrdersConnection } from '@/lib/easyorders/store';
import { disconnectEasyOrdersConnection } from '@/lib/easyorders/disconnect';
import { syncEasyOrdersProducts } from '@/lib/easyorders/products';
import {
  EasyOrdersError, type EasyOrdersInstallResult, type EasyOrdersResult, type EasyOrdersSummary,
} from '@/lib/easyorders/types';

async function authorized<T>(siteId: string, mode: 'read' | 'write', work: (siteId: string, userId: string) => Promise<T>): Promise<EasyOrdersResult<T>> {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, code: 'forbidden' };
    const site = await requireSiteAccess(userId, siteId, 'store'); // owner only, including status/key operations
    await requireMerchantRateLimit(`easyorders:${site.id}:${userId}`, mode);
    return { ok: true, data: await work(site.id, userId) };
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof RoleNotAllowedError) return { ok: false, code: 'forbidden' };
    if (error instanceof EasyOrdersError) return { ok: false, code: error.code };
    if (error instanceof RequestRateLimitError) return { ok: false, code: error.status === 429 ? 'rate_limited' : 'unavailable', retryAfterSeconds: error.retryAfterSeconds };
    return { ok: false, code: 'unavailable' };
  }
}
export async function createEasyOrdersInstallLink(siteId: string): Promise<EasyOrdersResult<{ url: string }>> {
  return authorized(siteId, 'write', async (id, user) => ({ url: await createInstallLink(id, user) }));
}
export async function getEasyOrdersStatus(siteId: string): Promise<EasyOrdersResult<EasyOrdersSummary | null>> {
  return authorized(siteId, 'read', async (id) => {
    const c = await loadEasyOrdersConnection(id);
    if (!c) return null;
    const { store_id, store_name, status, connected_at, last_webhook_at, last_error, products_synced_at } = c;
    return { store_id, store_name, status, connected_at, last_webhook_at, last_error, products_synced_at };
  });
}
export async function disconnectEasyOrders(siteId: string): Promise<EasyOrdersResult<null>> {
  return authorized(siteId, 'write', async (id) => { await disconnectEasyOrdersConnection(id); return null; });
}
export async function syncEasyOrdersProductsAction(siteId: string): Promise<EasyOrdersResult<{ imported: number }>> {
  return authorized(siteId, 'write', async (id) => ({ imported: await syncEasyOrdersProducts(id) }));
}

/* Return-page steps. The signed state from the provider redirect names the
   site and the link's creator; identity comes from Clerk only. Ownership and
   creator checks live in lib/easyorders/activation.ts. */
async function installStep(state: unknown, mode: 'read' | 'write',
  work: (claims: InstallState, userId: string) => Promise<EasyOrdersInstallResult>): Promise<EasyOrdersInstallResult> {
  try {
    const { userId } = await auth();
    if (!userId) return { status: 'failed', reason: 'signed_out' };
    const claims = readReturnState(state);
    if (!claims) return { status: 'failed', reason: 'invalid_link' };
    await requireMerchantRateLimit(`easyorders:${claims.siteId}:${userId}`, mode);
    return await work(claims, userId);
  } catch (error) {
    if (error instanceof RequestRateLimitError) {
      return { status: 'failed', reason: error.status === 429 ? 'rate_limited' : 'unavailable', retryAfterSeconds: error.retryAfterSeconds };
    }
    console.error('[easyorders] install step unavailable');
    return { status: 'failed', reason: 'unavailable' };
  }
}
export async function inspectEasyOrdersInstall(state: string): Promise<EasyOrdersInstallResult> {
  return installStep(state, 'read', inspectInstall);
}
export async function confirmEasyOrdersInstall(state: string): Promise<EasyOrdersInstallResult> {
  return installStep(state, 'write', async (claims, userId) => {
    const { result, activated } = await confirmInstall(claims, userId);
    // First import is best effort and runs once, for the call that activated.
    // The sync action is the explicit retry path and shares the key budget.
    if (activated) {
      after(async () => {
        try { await syncEasyOrdersProducts(claims.siteId); }
        catch { console.error('[easyorders] initial product import unavailable'); }
      });
    }
    return result;
  });
}
export async function cancelEasyOrdersInstall(state: string): Promise<EasyOrdersInstallResult> {
  return installStep(state, 'write', cancelInstall);
}
