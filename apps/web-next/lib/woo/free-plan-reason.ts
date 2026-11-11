import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { registrableDomain } from './free-plan';

/** Read the actual apex holder without trying to grant a plan on a status poll.
 * Never expose the other account or its site id to the merchant. */
export async function freePlanReason(siteId: string, verifiedHosts: string[]): Promise<'no_verified_domain' | 'apex_taken' | null> {
  const apexes = [...new Set(verifiedHosts.map(registrableDomain).filter((host): host is string => !!host))];
  if (!apexes.length) return 'no_verified_domain';
  const { data, error } = await getMessengerServiceClient().from('tryon_free_plan_apexes')
    .select('widget_site_id').in('apex', apexes).neq('widget_site_id', siteId).limit(1);
  if (error) throw new Error('free plan claim read failed');
  return data?.length ? 'apex_taken' : null;
}
