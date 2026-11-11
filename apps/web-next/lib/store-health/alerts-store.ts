import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import type { StoreHealthProblem } from './problems';

export const STORE_HEALTH_BATCH = 50;
export type HealthSite = { id: string; name: string; workspace_id: string; domain: string | null; settings_json: unknown };
export type HealthAlert = { id: string; site_id: string; problem_key: StoreHealthProblem; opened_at: string;
  resolved_at: string | null; alerted_at: string | null; alert_attempts: number; recovery_attempts: number };

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error('store health persistence failed');
  return data;
}

export function storeHealthRepository() {
  const db = getMessengerServiceClient();
  return {
    async sites(token: string): Promise<HealthSite[]> {
      return check(await db.rpc('claim_store_health_checks', { p_token: token, p_limit: STORE_HEALTH_BATCH })) ?? [];
    },
    async reconcile(site: string, token: string, keys: StoreHealthProblem[]): Promise<boolean> {
      return check(await db.rpc('reconcile_store_health_alerts', { p_site: site, p_token: token, p_keys: keys })) === true;
    },
    async pending(site: string): Promise<HealthAlert[]> {
      return check(await db.from('store_health_alerts')
        .select('id, site_id, problem_key, opened_at, resolved_at, alerted_at, alert_attempts, recovery_attempts')
        .eq('site_id', site).or('and(resolved_at.is.null,alert_delivery.eq.pending),and(resolved_at.not.is.null,recovery_delivery.eq.pending)')
        .order('opened_at').order('id').limit(10)) ?? [];
    },
    async claim(row: HealthAlert, checkToken: string, sendToken: string): Promise<HealthAlert | null> {
      const data = check(await db.rpc('claim_store_health_email', { p_id: row.id, p_site: row.site_id,
        p_check_token: checkToken, p_send_token: sendToken, p_recovery: row.resolved_at !== null }));
      return data?.[0] ?? null;
    },
    async finish(row: HealthAlert, token: string, outcome: 'sent' | 'retry' | 'unknown'): Promise<void> {
      const saved = check(await db.rpc('finish_store_health_email', { p_id: row.id, p_token: token, p_recovery: row.resolved_at !== null, p_outcome: outcome }));
      if (!saved) throw new Error('store health send outcome not recorded');
    },
    async checked(site: string, token: string, at: string): Promise<void> {
      check(await db.from('widget_sites').update({ store_health_checked_at: at, store_health_check_until: null, store_health_check_token: null })
        .eq('id', site).eq('store_health_check_token', token));
    },
  };
}
export type HealthRepository = ReturnType<typeof storeHealthRepository>;
