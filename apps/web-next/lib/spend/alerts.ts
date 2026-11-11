import 'server-only';
import { pasteRedis } from '@/lib/paste/redis';
import { sendSpendEmail } from '@/lib/email/spend-sender';
import type { SpendEmailInput } from '@/lib/email/spend';
import { readSpendSnapshot, type SpendSnapshot } from './snapshot';
import { DAILY_COUNTER_TTL } from './daily-counter';

let missingAddressLogged = false;
const defaults = {
  snapshot: readSpendSnapshot,
  claim: async (key: string) => (await pasteRedis().set(key, '1', { nx: true, ex: DAILY_COUNTER_TTL })) === 'OK',
  send: sendSpendEmail,
};
export type SpendAlertDependencies = typeof defaults;

export function spendAlertCandidates(snapshot: SpendSnapshot): Array<{ key: string; email: SpendEmailInput }> {
  const candidates: Array<{ key: string; email: SpendEmailInput }> = [];
  const topStores = new Map<string, Array<{ store: string; used: number }>>();
  const top = (feature: string) => {
    let rows = topStores.get(feature);
    if (!rows) {
      rows = snapshot.stores.filter(row => row.feature === feature && row.used > 0)
        .sort((a, b) => b.used - a.used).slice(0, 3).map(row => ({ store: row.store!, used: row.used }));
      topStores.set(feature, rows);
    }
    return rows;
  };
  for (const row of snapshot.global) {
    for (const threshold of [80, 100] as const) {
      if (row.used >= row.limit * threshold / 100) candidates.push({ key: 'global:' + row.feature + ':' + threshold,
        email: { ...row, threshold, topStores: top(row.feature) } });
    }
  }
  for (const row of snapshot.stores) {
    if (row.used >= row.limit) candidates.push({ key: 'store:' + row.store,
      email: { ...row, threshold: 100, topStores: top(row.feature) } });
  }
  return candidates;
}

export async function runSpendAlerts(deps: SpendAlertDependencies = defaults, now = new Date()) {
  const to = process.env.PLATFORM_ALERT_EMAIL?.trim();
  if (!to) {
    if (!missingAddressLogged) { console.info('[spend-alerts] PLATFORM_ALERT_EMAIL unset; skipping'); missingAddressLogged = true; }
    return { sent: 0, skipped: true, failed: 0 };
  }
  const snapshot = await deps.snapshot(now);
  let sent = 0, failed = 0;
  for (const candidate of spendAlertCandidates(snapshot)) {
    const key = 'gc-spend-alert:{' + now.toISOString().slice(0, 10) + '}:' + candidate.key;
    if (!(await deps.claim(key))) continue;
    // Keep even an uncertain SMTP claim: at most one attempt per threshold/day.
    const outcome = await deps.send(candidate.email, to).catch(() => 'unknown');
    if (outcome === 'sent') sent++;
    else { failed++; console.error('[spend-alerts] delivery failed', { key: candidate.key, outcome }); }
  }
  return { sent, skipped: false, failed };
}
