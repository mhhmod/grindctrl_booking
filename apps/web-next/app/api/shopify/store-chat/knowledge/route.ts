import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import {
  addManualKnowledge,
  addUrlKnowledge,
  removeKnowledge,
  reSyncKnowledge,
  setKnowledgeStatus,
} from '@/lib/messenger/knowledge';

type KnowledgeBody =
  | { op: 'add'; title: string; content: string }
  | { op: 'addUrl'; url: string }
  | { op: 'status'; entryId: string; status: 'active' | 'disabled' }
  | { op: 'delete'; entryId: string }
  | { op: 'sync'; entryId: string };

export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat knowledge] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const actorClerkUserId = shopProfileId(session.shop);
  const body = (await request.json()) as KnowledgeBody;

  try {
    switch (body.op) {
      case 'add': {
        const entry = await addManualKnowledge({ site, actorClerkUserId, title: body.title, content: body.content });
        return NextResponse.json({ ok: true, entry });
      }
      case 'addUrl': {
        const entry = await addUrlKnowledge({ site, actorClerkUserId, url: body.url });
        return NextResponse.json({ ok: true, entry });
      }
      case 'status':
        await setKnowledgeStatus({ site, entryId: body.entryId, status: body.status });
        return NextResponse.json({ ok: true });
      case 'delete':
        await removeKnowledge({ site, actorClerkUserId, entryId: body.entryId });
        return NextResponse.json({ ok: true });
      case 'sync':
        await reSyncKnowledge({ site, entryId: body.entryId });
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ ok: false, error: 'Unknown operation.' }, { status: 400 });
    }
  } catch (error) {
    // Same filter actions.ts's addKnowledge/syncKnowledge apply: only the
    // fetch-a-URL failure messages are safe and useful to a merchant.
    // Anything else (a raw Postgres/Supabase error, for instance) must not
    // reach an untrusted client verbatim — genericize it instead.
    const raw = error instanceof Error ? error.message : '';
    // Word-boundary match: a plain substring test would let a raw Postgres
    // error through whenever a column or constraint name merely contains
    // "url" as part of a longer identifier (e.g. "source_url").
    const message = /\b(https?|url|page|readable)\b/i.test(raw) ? raw : 'Action failed. Please try again.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
