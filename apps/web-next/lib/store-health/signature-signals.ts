import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';

export type SignatureSignal = 'bad_signature' | 'stale_signature' | 'verified';

/** A rejected render is a health hint only. It never changes trust or auth.
 * Call only after origin validation and the existing per-site/IP limits. */
export async function recordSignatureHealth(siteId: string, outcome: SignatureSignal): Promise<void> {
  try {
    const { error } = await getMessengerServiceClient().rpc('record_store_signature_health', { p_site: siteId, p_outcome: outcome });
    if (error) throw new Error('signal write failed');
  } catch { console.error('[store-health] signature signal write failed', { siteId }); }
}

export async function readSignatureFailures(siteId: string, now: number): Promise<number> {
  const { data, error } = await getMessengerServiceClient().from('store_signature_health')
    .select('bad_count, stale_count, failed_at, verified_at').eq('site_id', siteId)
    .gte('day', new Date(now - 86400000).toISOString().slice(0, 10)).order('day', { ascending: false }).limit(2);
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code)) return 0;
    throw new Error('signature health read failed');
  }
  const rows = data ?? [];
  const verifiedAt = Math.max(0, ...rows.map((row) => Date.parse(row.verified_at ?? '') || 0));
  return rows.filter((row) => Date.parse(row.failed_at ?? '') > verifiedAt)
    .reduce((count, row) => count + Number(row.bad_count) + Number(row.stale_count), 0);
}
