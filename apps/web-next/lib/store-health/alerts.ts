import 'server-only';
import { notifyStoreJourneyHealth } from '@/lib/email/store-journey-sender';
import { randomUUID } from 'node:crypto';
import { detectStoreProblems, storeHealthEmailsEnabled } from './problems';
import { storeHealthRepository, STORE_HEALTH_BATCH } from './alerts-store';
import { readAlertStoreFacts } from './alerts-data';
import { storeHealthOwner } from './owner';
import { sendStoreHealthEmail } from '@/lib/email/store-health-sender';

const defaults = { repository: storeHealthRepository, facts: readAlertStoreFacts, owner: storeHealthOwner, send: sendStoreHealthEmail };
export type HealthAlertDependencies = typeof defaults;

export async function runStoreHealthAlerts(deps: HealthAlertDependencies = defaults, now = Date.now()) {
  const repo = deps.repository();
  const token = randomUUID();
  const sites = (await repo.sites(token)).slice(0, STORE_HEALTH_BATCH);
  const summary = { checked: 0, sent: 0, pending: 0, abandoned: 0, unknown: 0, errors: 0 };
  const deadline = Date.now() + 180_000;
  for (const site of sites) {
    if (Date.now() >= deadline) break; // Unused leases expire, keeping oldest-first priority.
    try {
      const facts = await deps.facts(site, now);
      if (!facts) continue; // Disconnected/unsupported stores have no check; never invent recovery evidence.
      if (!(await repo.reconcile(site.id, token, detectStoreProblems(facts)))) continue;
      summary.checked++;
      if (!storeHealthEmailsEnabled(site.settings_json)) continue;
      await notifyStoreJourneyHealth(site, facts);
      const pending = await repo.pending(site.id);
      if (pending.length === 0) continue;
      const owner = await deps.owner(site);
      for (const candidate of pending) {
        if (Date.now() >= deadline) break;
        const sendToken = randomUUID();
        const row = await repo.claim(candidate, token, sendToken);
        if (!row) continue;
        let outcome: 'sent' | 'retry' | 'unknown' = 'retry';
        if (owner && facts.address) {
          const since = facts.code.lastSeenAt ?? row.opened_at;
          const sinceDay = new Intl.DateTimeFormat(owner.locale === 'ar' ? 'ar' : 'en-GB', { weekday: 'long', timeZone: facts.timeZone }).format(new Date(since));
          // A thrown sender may have crossed SMTP acceptance. Keep its claim.
          outcome = await deps.send({ problem: row.problem_key, recovery: row.resolved_at !== null,
            storeName: site.name, address: facts.address, locale: owner.locale, sinceDay,
            to: owner.email, deliveryId: `${row.id}-${row.resolved_at ? 'recovery' : 'problem'}` }).catch(() => 'unknown' as const);
        }
        await repo.finish(row, sendToken, outcome);
        const attempts = row.resolved_at ? row.recovery_attempts : row.alert_attempts;
        if (outcome === 'sent') summary.sent++;
        else if (outcome === 'unknown' || attempts >= 4) {
          summary[outcome === 'unknown' ? 'unknown' : 'abandoned']++;
          console.error('[store-health] delivery stopped', { id: row.id, recovery: row.resolved_at !== null, outcome, attempts });
        } else summary.pending++;
      }
    } catch {
      summary.errors++;
      console.error('[store-health] site check failed', { siteId: site.id });
    } finally {
      await repo.checked(site.id, token, new Date(now).toISOString());
    }
  }
  return summary;
}
