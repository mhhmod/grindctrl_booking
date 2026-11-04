import { NextRequest } from 'next/server';
import { drainWooPrivacyStorageQueue, eraseShopperData } from '@/lib/woo/privacy';
import { privacyJson, readPrivacyCall } from '@/lib/woo/privacy-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** WordPress "Erase Personal Data" for one email. Each call removes one batch;
 * WordPress calls again while done is false. The page number is accepted for
 * contract parity but unused: erased rows leave the result set, so every call
 * simply takes the next batch.
 * Response: { ok: true, removed: number, done: boolean, counts: Record<string, number> }. */
export async function POST(request: NextRequest) {
  const call = await readPrivacyCall(request, 'privacy erase');
  if (!call.ok) return call.response;
  try {
    const result = await eraseShopperData(call.siteId, call.email);
    // The rows are already gone. A storage failure keeps the objects queued
    // for the retention job, so it must not fail (and re-run) the erase.
    const storage = await drainWooPrivacyStorageQueue().catch(() => ({ removed: 0, failed: 1 }));
    console.info('[woo] privacy erase', {
      siteId: call.siteId,
      emailHash: call.emailHash,
      removed: result.removed,
      done: result.done,
      storageFailed: storage.failed,
    });
    return privacyJson({ ok: true, removed: result.removed, done: result.done, counts: result.counts });
  } catch {
    console.error('[woo] privacy erase failed', { code: 'unavailable', siteId: call.siteId, emailHash: call.emailHash });
    return privacyJson({ error: 'unavailable' }, 503);
  }
}
