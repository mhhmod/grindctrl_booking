'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { requireSiteAccess } from '@/lib/messenger/provisioning';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { requireMerchantRateLimit } from '@/lib/request-rate-limit';

export async function setStoreHealthAlertsAction(siteId: string, enabled: boolean): Promise<{ ok: boolean; signedOut?: true }> {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, signedOut: true };
    if (typeof enabled !== 'boolean') return { ok: false };
    const site = await requireSiteAccess(userId, siteId, 'settings');
    await requireMerchantRateLimit(`store-health:${site.id}`, 'write');
    const { error } = await getMessengerServiceClient().rpc('set_store_health_alert_preference', { p_site: site.id, p_enabled: enabled });
    if (error) throw new Error('preference write failed');
    revalidatePath('/dashboard/store');
    return { ok: true };
  } catch { return { ok: false }; }
}
