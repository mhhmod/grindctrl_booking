'use server';

import { createHash, randomInt } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { requireSiteAccess, UnauthorizedError } from '@/lib/messenger/provisioning';
import {
  merchantActionFailure,
  RequestRateLimitError,
  requireMerchantRateLimit,
} from '@/lib/request-rate-limit';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';
import { getWooSiteConnection, type WooSiteConnectionSummary } from '@/lib/woo/connection';

const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PAIRING_CODE_LENGTH = 8;
const PAIRING_CODE_LIFETIME_MS = 15 * 60 * 1_000;

export type WooPairingCodeActionResult =
  | { ok: true; code: string; expiresAt: string }
  | {
      ok: false;
      code: 'forbidden' | 'rate_limited' | 'unavailable';
      message: string;
      retryAfterSeconds?: number;
    };

function generatePairingCode(): string {
  return Array.from(
    { length: PAIRING_CODE_LENGTH },
    () => PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)],
  ).join('');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export type WooConnectionReadResult = { ok: true; connection: WooSiteConnectionSummary | null } | { ok: false };

/** The site's WooCommerce connection, for the pairing panel that watches
 * for the plugin to pair while its code is on screen. Same people and same
 * data as Store setup's own read. */
export async function readWooConnectionAction(siteId: string): Promise<WooConnectionReadResult> {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false };
    const site = await requireSiteAccess(userId, siteId, 'settings');
    await requireMerchantRateLimit(`site:${site.id}`, 'read');
    return { ok: true, connection: await getWooSiteConnection(site.id) };
  } catch {
    return { ok: false };
  }
}

/** Creates a short-lived code for a site the signed-in merchant may manage.
 * Only its SHA-256 hash is persisted; the plaintext is returned once. */
export async function createWooPairingCodeAction(
  siteId: string,
): Promise<WooPairingCodeActionResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { ok: false, code: 'forbidden', message: 'You must sign in again.' };
    }
    const site = await requireSiteAccess(userId, siteId, 'settings');
    await requireMerchantRateLimit(`site:${site.id}`, 'write');

    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_LIFETIME_MS).toISOString();
    const { error } = await getMessengerServiceClient().from('woo_pairing_codes').insert({
      code_hash: sha256Hex(code),
      widget_site_id: site.id,
      created_by: userId,
      expires_at: expiresAt,
    });
    if (error) throw new Error('pairing_code_insert_failed');

    return { ok: true, code, expiresAt };
  } catch (error) {
    if (error instanceof RequestRateLimitError) return merchantActionFailure(error);
    if (error instanceof UnauthorizedError || error instanceof RoleNotAllowedError) {
      return {
        ok: false,
        code: 'forbidden',
        message: 'You do not have permission to connect this site.',
      };
    }
    // siteId is caller-supplied until requireSiteAccess passes, so it is logged
    // as data, not spliced into the message.
    console.error('[woo pairing] unavailable', { siteId: typeof siteId === 'string' ? siteId.slice(0, 64) : null });
    return {
      ok: false,
      code: 'unavailable',
      message: 'A connection code could not be created. Try again shortly.',
      retryAfterSeconds: 30,
    };
  }
}
