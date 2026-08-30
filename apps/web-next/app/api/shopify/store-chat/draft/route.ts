import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { saveDraftSectionForSite } from '@/lib/messenger/actions-core';
import type { MessengerSection } from '@/lib/messenger/config';

/* Embedded equivalent of the dashboard's saveDraftSection server action.
   The site is always resolved from the verified session token's shop —
   never from the request body — the same invariant admin/settings and
   claim/start already document and enforce. */

export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat draft] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const body = (await request.json()) as { section?: MessengerSection; payload?: object };
  const result = await saveDraftSectionForSite(site, body.section as MessengerSection, body.payload ?? {});
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
