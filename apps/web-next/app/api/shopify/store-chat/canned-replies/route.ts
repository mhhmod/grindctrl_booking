import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { merchantRateLimitResponse } from '@/lib/request-rate-limit';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import {
  addCannedReply,
  removeCannedReply,
  setCannedReplyStatus,
} from '@/lib/messenger/canned-replies';

type CannedReplyBody =
  | { op: 'add'; title: string; content: string }
  | { op: 'status'; replyId: string; status: 'active' | 'disabled' }
  | { op: 'delete'; replyId: string };

export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const limited = await merchantRateLimitResponse(
    `shop:${session.shop}`, 'write',
  );
  if (limited) return limited;

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat canned-replies] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const actorClerkUserId = shopProfileId(session.shop);
  const body = (await request.json()) as CannedReplyBody;

  try {
    switch (body.op) {
      case 'add': {
        const reply = await addCannedReply({ site, actorClerkUserId, title: body.title, content: body.content });
        return NextResponse.json({ ok: true, reply });
      }
      case 'status':
        await setCannedReplyStatus({ site, replyId: body.replyId, status: body.status });
        return NextResponse.json({ ok: true });
      case 'delete':
        await removeCannedReply({ site, actorClerkUserId, replyId: body.replyId });
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ ok: false, error: 'Unknown operation.' }, { status: 400 });
    }
  } catch (error) {
    // A canned reply has no URL-fetch failure mode, so there is no safe
    // merchant-facing message to carve out — a raw Postgres/Supabase error
    // must never reach an untrusted client verbatim. Genericize it instead.
    console.error('[store-chat canned-replies] mutation failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'Action failed. Please try again.' }, { status: 400 });
  }
}
