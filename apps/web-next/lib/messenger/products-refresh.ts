import 'server-only';
import { after } from 'next/server';
import { getMessengerServiceClient } from './db';
import { readProductsStatus, syncSiteProducts } from './products';

/* Reads a store's catalogue right after it first goes live (the same
   moments that send the "store connected" email), so product knowledge is
   ready without waiting for the nightly job. Runs after the response and
   never throws. Idempotent and bounded: syncSiteProducts takes a five minute
   lease, so repeated triggers collapse into one read, and a store that
   cannot be read yet (a password page) is left to the nightly job. */

const RETRY_AFTER_MS = 60 * 60_000;

async function refresh(siteId: string): Promise<void> {
  const read = await getMessengerServiceClient().from('widget_sites').select('id, embed_key, products_sync_attempted_at').eq('id', siteId).maybeSingle();
  if (read.error || !read.data) return;
  // The Shopify app path triggers on every admin load: read once, and not
  // again within the hour while the store has not been readable.
  const attempted = Date.parse(String(read.data.products_sync_attempted_at ?? ''));
  if (Number.isFinite(attempted) && Date.now() - attempted < RETRY_AFTER_MS) return;
  if ((await readProductsStatus(siteId))?.outcome === 'ok') return;
  try {
    await syncSiteProducts({ id: read.data.id as string, embed_key: read.data.embed_key as string });
  } catch (error) {
    // The outcome is already recorded for the merchant; a lease held by an
    // earlier trigger is the expected repeat.
    console.info('[products] refresh after go-live not completed', { site: siteId, reason: error instanceof Error ? error.message : 'unknown' });
  }
}

export function scheduleProductsRefresh(site: string | (() => Promise<string | null>)): void {
  const run = async () => {
    const siteId = typeof site === 'string' ? site : await site();
    if (siteId) await refresh(siteId);
  };
  try {
    after(() => run().catch(() => console.error('[products] refresh after go-live failed')));
  } catch {
    console.error('[products] refresh after go-live not scheduled');
  }
}
