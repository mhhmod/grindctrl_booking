import 'server-only';

import { getMessengerServiceClient } from './db';
import { resolveMessengerConfig } from './config';
import { notifyHandoff } from './notify';
import { alertIsDue, readHandoffAlert } from './handoff-alert';

/* The retry worker for handoff alerts (v16 phase zero item 6).

   An alert that was throttled or whose send failed is 'pending'; so is one
   deferred to opening time after hours (n23_after_hours). Every few minutes
   this sends what is due, through the same notifyHandoff as the first try,
   so the claim still guarantees one email per handoff. A conversation a
   person already took over, or that someone was already alerted about, is
   never in the list. */

export const ALERT_RETRY_BATCH = 25;
/** Stop retrying a failing alert after this many tries (about two hours at
 *  one run every five minutes); the dashboard lists it as not delivered. */
export const ALERT_MAX_ATTEMPTS = 24;
/** A handoff older than this is past helping by email. */
export const ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface AlertRetrySummary {
  scanned: number;
  retried: number;
  sent: number;
  stillPending: number;
}

type WaitingRow = {
  id: string;
  widget_site_id: string;
  handoff_reason: string | null;
  handoff_summary: string | null;
  metadata: Record<string, unknown> | null;
};

export async function retryPendingAlerts(now: number = Date.now()): Promise<AlertRetrySummary> {
  const supabase = getMessengerServiceClient();
  const waiting = await supabase
    .from('widget_conversations')
    .select('id, widget_site_id, handoff_reason, handoff_summary, metadata')
    .eq('status', 'handoff_requested')
    .is('handoff_notified_at', null)
    .eq('metadata->handoff_alert->>status', 'pending')
    .limit(ALERT_RETRY_BATCH * 4);
  if (waiting.error) throw new Error(`pending alerts lookup failed: ${waiting.error.message}`);

  const rows = ((waiting.data ?? []) as WaitingRow[]).filter((row) => {
    const alert = readHandoffAlert(row.metadata);
    if (!alert || !alertIsDue(alert, now) || alert.attempts >= ALERT_MAX_ATTEMPTS) return false;
    // A deferred alert counts its age from when it fell due.
    const since = Date.parse(alert.dueAt ?? alert.at);
    return Number.isFinite(since) && now - since < ALERT_MAX_AGE_MS;
  }).slice(0, ALERT_RETRY_BATCH);

  const summary: AlertRetrySummary = { scanned: (waiting.data ?? []).length, retried: 0, sent: 0, stillPending: 0 };
  const sites = new Map<string, { id: string; name: string; workspace_id: string; settings_json: unknown } | null>();

  for (const row of rows) {
    if (!sites.has(row.widget_site_id)) {
      const site = await supabase
        .from('widget_sites')
        .select('id, name, workspace_id, settings_json')
        .eq('id', row.widget_site_id)
        .maybeSingle();
      sites.set(row.widget_site_id, site.error ? null : (site.data as never) ?? null);
    }
    const site = sites.get(row.widget_site_id);
    if (!site) continue;

    summary.retried += 1;
    const outcome = await notifyHandoff({
      site: {
        id: site.id,
        name: site.name,
        workspace_id: site.workspace_id,
        locale: 'en',
        notifications: resolveMessengerConfig(site.settings_json).notifications,
      },
      conversation: {
        id: row.id,
        handoff_reason: row.handoff_reason,
        handoff_summary: row.handoff_summary,
        metadata: row.metadata ?? {},
      },
    });
    if (outcome.status === 'sent') summary.sent += 1;
    if (outcome.status === 'pending') summary.stillPending += 1;
  }
  return summary;
}
