import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { CHAT_RETENTION_BATCH_LIMIT, cleanupInactiveStoreChat } from '@/lib/shopify/chat-retention';

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
  try {
    const data = await cleanupInactiveStoreChat(CHAT_RETENTION_BATCH_LIMIT);
    if (data.failed > 0) {
      console.error('[store-chat-retention] failed', data);
      return NextResponse.json({ ok: false, error: 'Store Chat retention did not complete.', data }, { status: 500, headers });
    }
    console.info('[store-chat-retention] completed', data);
    return NextResponse.json({ ok: true, data }, { headers });
  } catch {
    console.error('[store-chat-retention] failed', { failed: 1 });
    return NextResponse.json({ ok: false, error: 'Store Chat retention did not complete.' }, { status: 500, headers });
  }
}
