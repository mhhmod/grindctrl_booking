import { NextRequest } from 'next/server';
import { exportShopperData } from '@/lib/woo/privacy';
import { privacyJson, readPrivacyCall } from '@/lib/woo/privacy-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** WordPress "Export Personal Data" for one email, one page at a time.
 * Response: { ok: true, items: WpExportItem[], done: boolean }. */
export async function POST(request: NextRequest) {
  const call = await readPrivacyCall(request, 'privacy export');
  if (!call.ok) return call.response;
  try {
    const result = await exportShopperData(call.siteId, call.email, call.page);
    console.info('[woo] privacy export', {
      siteId: call.siteId,
      emailHash: call.emailHash,
      page: call.page,
      items: result.items.length,
      done: result.done,
    });
    return privacyJson({ ok: true, items: result.items, done: result.done });
  } catch {
    console.error('[woo] privacy export failed', { code: 'unavailable', siteId: call.siteId, emailHash: call.emailHash });
    return privacyJson({ error: 'unavailable' }, 503);
  }
}
