import 'server-only';
import { after } from 'next/server';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { getPasteConnection } from '@/lib/paste/store';
import { storeHealthOwner } from '@/lib/store-health/owner';
import { buildStoreConnectedEmail } from './store-connected';
import { healthSmtpFailure } from './store-health-sender';
import { getSmtpFrom, getSmtpTransport, hasSmtpConfigured } from './transport';

/* "Your store is connected", sent once per store (widget site) the first
   time it goes live through any install path. widget_sites.connected_email_at
   (20261111_store_connected_email.sql) is the durable once-only claim, taken
   in one conditional update before SMTP, as store-health does: a crash after
   SMTP accepted the message leaves it claimed, preferring a missed email to
   a second one. Only a definite non-delivery gives the claim back. Nothing
   here may break the connect path that triggered it. */

export type StoreConnectPath = 'shopify_paste' | 'website_paste' | 'woocommerce' | 'shopify_app';
export type StoreConnectedOutcome = 'sent' | 'already_sent' | 'skipped' | 'retry' | 'unknown';

type SiteRow = { id: string; name: string | null; workspace_id: string; domain: string | null; connected_email_at: string | null };

function markerMissing(error: { code?: string | null; message?: string | null }): boolean {
  return (error.code === '42703' || error.code === 'PGRST204') && /\bconnected_email_at\b/.test(error.message ?? '');
}

async function deliver(to: string, siteId: string, email: ReturnType<typeof buildStoreConnectedEmail>): Promise<'sent' | 'retry' | 'unknown'> {
  const transport = getSmtpTransport({ connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 });
  const from = getSmtpFrom();
  if (!transport || !from) return 'retry';
  try {
    const result = await transport.sendMail({ from, to, ...email, textEncoding: 'base64',
      // One stable id per store: a mail system that sees it twice can drop the copy.
      messageId: `<store-connected-${siteId}@grindctrl.cloud>`,
      headers: { 'X-GrindCTRL-Notification': 'store-connected' },
    });
    if (result.rejected?.length || result.pending?.length) return 'retry';
    return result.accepted?.length ? 'sent' : 'unknown';
  } catch (error) {
    return healthSmtpFailure(error);
  } finally { transport.close(); }
}

export async function sendStoreConnectedEmail(siteId: string, input: { path: StoreConnectPath; host: string }): Promise<StoreConnectedOutcome> {
  const db = getMessengerServiceClient();
  const read = await db.from('widget_sites').select('id, name, workspace_id, domain, connected_email_at').eq('id', siteId).maybeSingle();
  if (read.error) {
    if (markerMissing(read.error)) return 'skipped'; // Before its migration: never send without the once-only marker.
    throw new Error('store connected email: site read failed');
  }
  const site = read.data as SiteRow | null;
  if (!site) return 'skipped';
  if (site.connected_email_at) return 'already_sent';
  // Leave the claim for a later trigger when nothing could be sent now.
  if (!hasSmtpConfigured() || !input.host) return 'skipped';
  // A Shopify paste shop can verify its storefront domain while the shop
  // itself still waits for its proof: only a website install is live here.
  if (input.path === 'website_paste' && (await getPasteConnection(siteId))?.platform !== 'website') return 'skipped';
  const owner = await storeHealthOwner(site);
  if (!owner) return 'skipped';

  const claimedAt = new Date().toISOString();
  const claim = await db.from('widget_sites').update({ connected_email_at: claimedAt })
    .eq('id', siteId).is('connected_email_at', null).select('id');
  if (claim.error) throw new Error('store connected email: claim failed');
  if (!claim.data?.length) return 'already_sent';

  const email = buildStoreConnectedEmail({ storeName: site.name ?? '', host: input.host, locale: owner.locale });
  const outcome = await deliver(owner.email, siteId, email).catch(() => 'unknown' as const);
  if (outcome === 'retry') {
    const release = await db.from('widget_sites').update({ connected_email_at: null }).eq('id', siteId).eq('connected_email_at', claimedAt);
    if (release.error) console.error('[store-connected] claim not released', { site: siteId });
  }
  return outcome;
}

/** Sends after the response, so the connect path never waits on SMTP or
 *  fails because of it. `site` may be resolved then too (a Shopify app shop
 *  names its site by domain). Never throws. */
export function scheduleStoreConnectedEmail(site: string | (() => Promise<string | null>),
  input: { path: StoreConnectPath; host: string }): void {
  const siteId = typeof site === 'string' ? site : null;
  const run = () => (siteId ? Promise.resolve(siteId) : (site as () => Promise<string | null>)()).then((id) =>
    id ? sendStoreConnectedEmail(id, input) : 'skipped' as const).then((outcome) => {
    if (outcome === 'sent') console.info('[store-connected] email sent', { site: siteId, path: input.path });
    else if (outcome === 'retry' || outcome === 'unknown') console.error('[store-connected] email failed', { site: siteId, path: input.path, outcome });
  }, () => {
    console.error('[store-connected] email failed', { site: siteId, path: input.path, outcome: 'error' });
  });
  try {
    after(run);
  } catch {
    console.error('[store-connected] email not scheduled', { site: siteId, path: input.path });
  }
}
