import 'server-only';
import { createHash } from 'node:crypto';
import { getMessengerServiceClient } from './db';
import { checkLauncherIcon, ICON_EXTENSIONS, type LauncherIconResult } from './launcher-icon-check';

/* A merchant's own launcher icon. The widget draws it from a plain https
   URL on someone else's storefront, so it lives in the one public-read
   bucket (messenger-icons, supabase/20261112_messenger_icons_bucket.sql);
   nothing else is public. Writes are service-role only and happen here,
   after the caller has been authorised for this store. */

export const ICON_BUCKET = 'messenger-icons';

/** Named by the file's own hash under the site's id: the same icon uploaded
 *  twice is one object, and a replaced icon never changes under a published
 *  widget that still points at the old one. */
export async function storeLauncherIcon(siteId: string, bytes: Uint8Array): Promise<LauncherIconResult> {
  const checked = checkLauncherIcon(bytes);
  if (!checked.ok) return { ok: false, error: checked.problem };
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  const path = `${siteId}/${hash}.${ICON_EXTENSIONS[checked.mime]}`;
  const storage = getMessengerServiceClient().storage.from(ICON_BUCKET);
  const upload = await storage.upload(path, bytes, { contentType: checked.mime, cacheControl: '31536000', upsert: true });
  if (upload.error) {
    console.error('[messenger] launcher icon upload failed', { site: siteId, message: upload.error.message });
    return { ok: false, error: 'failed' };
  }
  return { ok: true, url: storage.getPublicUrl(path).data.publicUrl };
}
