import 'server-only';
import { after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { storeHealthOwner } from '@/lib/store-health/owner';
import type { HealthSite } from '@/lib/store-health/alerts-store';
import type { YourStoreFacts } from '@/lib/dashboard/your-store-model';
import { intlLocale } from '@/lib/copy/rules';
import { buildStoreJourneyEmail, type StoreJourneyEmailInput } from './store-journey';
import { healthSmtpFailure } from './store-health-sender';
import { getSmtpFrom, getSmtpTransport } from './transport';

/** Durable event claim before SMTP. Unknown acceptance keeps the claim;
 * only definite non-delivery releases it. A missing migration never sends. */
export async function sendStoreJourneyEmail(siteId: string, eventKey: string, to: string, input: StoreJourneyEmailInput) {
  const transport = getSmtpTransport({ connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 });
  const from = getSmtpFrom();
  if (!transport || !from) { console.error('[store-journey] SMTP unavailable', { siteId, event: input.event }); return; }
  const token = randomUUID();
  try {
    const db = getMessengerServiceClient();
    const claim = await db.from('store_journey_emails').upsert({ site_id: siteId, event_key: eventKey, claim_token: token },
      { onConflict: 'site_id,event_key', ignoreDuplicates: true }).select('claim_token');
    if (claim.error) throw new Error('email claim failed');
    if (!claim.data?.some((row) => row.claim_token === token)) return;
    let outcome: 'sent' | 'retry' | 'unknown';
    try {
      const result = await transport.sendMail({ from, to, ...buildStoreJourneyEmail(input), textEncoding: 'base64',
        messageId: `<store-journey-${siteId}-${eventKey.replace(/[^a-zA-Z0-9-]/g, '-')}@grindctrl.cloud>`,
        headers: { 'X-GrindCTRL-Notification': `store-${input.event}` } });
      outcome = result.rejected?.length || result.pending?.length ? 'retry' : result.accepted?.length ? 'sent' : 'unknown';
    } catch (error) { outcome = healthSmtpFailure(error); }
    if (outcome === 'retry') {
      const release = await db.from('store_journey_emails').delete().eq('site_id', siteId).eq('event_key', eventKey).eq('claim_token', token);
      if (release.error) console.error('[store-journey] claim release failed', { siteId });
    }
    if (outcome !== 'sent') console.error('[store-journey] email failed', { siteId, event: input.event, outcome });
  } catch { console.error('[store-journey] email failed', { siteId, event: input.event }); }
  finally { transport.close(); }
}

/** The existing store-health job provides tenant-scoped facts and locale.
 * Recurring events share one UTC date claim per store even across workers. */
export async function notifyStoreJourneyHealth(site: HealthSite, facts: YourStoreFacts): Promise<void> {
  try {
    const tryOn = facts.tryOn;
    const low = tryOn && tryOn.planActive && tryOn.looksLeft > 0 && tryOn.looksIncluded > 0 && tryOn.looksLeft / tryOn.looksIncluded <= 0.2;
    if (!facts.signatureFailures && !tryOn?.dailyLimitReached && !low) return;
    const owner = await storeHealthOwner(site);
    if (!owner || !facts.address) return;
    const day = new Date(facts.now).toISOString().slice(0, 10);
    const common = { storeName: site.name, address: facts.address, locale: owner.locale };
    if (facts.signatureFailures) await sendStoreJourneyEmail(site.id, `signature:${day}`, owner.email, { ...common, event: 'signature' });
    if (tryOn?.dailyLimitReached && tryOn.dailyResetAt) {
      const resetTime = new Intl.DateTimeFormat(intlLocale(owner.locale), { hour: 'numeric', minute: '2-digit', timeZone: facts.timeZone }).format(new Date(tryOn.dailyResetAt));
      await sendStoreJourneyEmail(site.id, `daily_limit:${day}`, owner.email, { ...common, event: 'daily_limit', resetTime, globalLimit: tryOn.dailyLimitCause === 'global' });
    }
    if (low) await sendStoreJourneyEmail(site.id, `low_looks:${day}`, owner.email, { ...common, event: 'low_looks', looksLeft: tryOn!.looksLeft });
  } catch { console.error('[store-journey] health notification failed', { siteId: site.id }); }
}

/** Recipient must be captured before disconnect transfers workspace ownership. */
export function scheduleStoreDisconnectedEmail(siteId: string, eventKey: string, to: string, input: Omit<StoreJourneyEmailInput, 'event'>) {
  try { after(() => sendStoreJourneyEmail(siteId, `disconnected:${eventKey}`, to, { ...input, event: 'disconnected' }).catch(() => { console.error('[store-journey] disconnect email failed', { siteId }); })); }
  catch { console.error('[store-journey] disconnect email not scheduled', { siteId }); }
}
