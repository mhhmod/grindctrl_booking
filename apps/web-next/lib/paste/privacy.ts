import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { drainWooPrivacyStorageQueue, eraseShopperData, exportShopperData, parsePrivacyRequest } from '@/lib/woo/privacy';
import { getPasteConnection } from './store';
import { PasteError } from './types';

/** Call after owner authorization. Install kind is the stored connection,
 * including website and Shopify paste installs, regardless of site.domain. */
export async function pasteShopperPrivacy(siteId: string, operation: 'export' | 'erase', raw: unknown) {
  const request = parsePrivacyRequest(raw);
  if (!request) throw new PasteError('invalid_request');
  if (!(await getPasteConnection(siteId))) throw new PasteError('not_found');
  if (operation === 'export') return exportShopperData(siteId, request.email, request.page);
  const result = await eraseShopperData(siteId, request.email);
  const storage = await drainWooPrivacyStorageQueue();
  if (storage.failed) throw new PasteError('unavailable');
  return result;
}

/** Returns false for a non-paste site; otherwise disconnects and durably
 * schedules shopper redaction with the same 48-hour grace as plugin uninstall. */
export async function disconnectPasteSite(siteId: string, actorUserId: string): Promise<boolean> {
  if (!(await getPasteConnection(siteId))) return false;
  const result = await getMessengerServiceClient().rpc('disconnect_paste_site', {
    p_site: siteId, p_actor_user_id: actorUserId,
  });
  if (result.error || result.data !== true) throw new PasteError('unavailable');
  return true;
}
