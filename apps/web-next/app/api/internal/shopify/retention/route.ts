import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { CHAT_RETENTION_BATCH_LIMIT, cleanupInactiveStoreChat } from '@/lib/shopify/chat-retention';
import { redactDueWooSites, redactDuePasteSites } from '@/lib/woo/privacy';

export const runtime = 'nodejs';

function hasValidSecret(request: NextRequest): boolean {
  const expected = process.env.TRYON_CLEANUP_SECRET;
  const provided = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!expected || expected.length < 32 || !provided) return false;
  const expectedBytes = Buffer.from(expected, 'utf8');
  const providedBytes = Buffer.from(provided, 'utf8');
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!hasValidSecret(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401, headers });
  }
  // Independent jobs on one schedule: a failure in one never skips the other.
  let data: Awaited<ReturnType<typeof cleanupInactiveStoreChat>> | null = null;
  let woo: Awaited<ReturnType<typeof redactDueWooSites>> | null = null;
  let paste: Awaited<ReturnType<typeof redactDuePasteSites>> | null = null;
  try {
    data = await cleanupInactiveStoreChat(CHAT_RETENTION_BATCH_LIMIT);
  } catch {
    console.error('[store-chat-retention] failed', { failed: 1 });
  }
  try {
    woo = await redactDueWooSites();
  } catch {
    console.error('[woo-site-redaction] failed', { failed: 1 });
  }
  try {
    paste = await redactDuePasteSites();
  } catch {
    console.error('[paste-site-redaction] failed', { failed: 1 });
  }
  if (data && data.failed === 0 && woo && woo.failed === 0 && paste && paste.failed === 0) {
    console.info('[store-chat-retention] completed', data);
    if (woo.sites > 0 || woo.storageRemoved > 0) console.info('[woo-site-redaction] completed', woo);
    return NextResponse.json({ ok: true, data, woo, paste }, { headers });
  }
  if (data && data.failed > 0) console.error('[store-chat-retention] failed', data);
  if (woo && woo.failed > 0) console.error('[woo-site-redaction] failed', woo);
  if (paste && paste.failed > 0) console.error('[paste-site-redaction] failed', paste);
  return NextResponse.json(
    { ok: false, error: 'Store Chat retention did not complete.', ...(data ? { data } : {}), ...(woo ? { woo } : {}), ...(paste ? { paste } : {}) },
    { status: 500, headers },
  );
}
