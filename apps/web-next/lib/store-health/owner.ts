import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { getSiteAssigneeProfileId } from '@/lib/messenger/provisioning';
import { getShopOwnerClerkUserId } from '@/lib/shopify/shop-links';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { getClerkAccountEmail } from '@/lib/team/clerk-account';
import { isPlaceholderEmail } from '@/lib/messenger/emails';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/** Same workspace owner as handoffs/team assignment, or the canonical
 * linked Clerk owner for a shop-first installation. Never fall back to an admin. */
export async function storeHealthOwner(site: { workspace_id: string; domain: string | null }): Promise<{ email: string; locale: SiteLocale } | null> {
  const db = getMessengerServiceClient();
  const shop = normalizeShopDomain(site.domain);
  const linked = shop ? await getShopOwnerClerkUserId(shop) : null;
  const query = db.from('profiles').select('clerk_user_id, dashboard_locale');
  const result = await (linked ? query.eq('clerk_user_id', linked) : query.eq('id', await getSiteAssigneeProfileId(site.workspace_id))).maybeSingle();
  if (result.error) throw new Error('store health owner read failed');
  const owner = result.data as { clerk_user_id: string; dashboard_locale: string } | null;
  if (!owner || owner.clerk_user_id.startsWith('shop-')) return null;
  const email = await getClerkAccountEmail(owner.clerk_user_id);
  return email && !isPlaceholderEmail(email) ? { email, locale: owner.dashboard_locale === 'ar' ? 'ar' : 'en' } : null;
}
