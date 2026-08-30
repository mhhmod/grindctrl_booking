// apps/web-next/app/api/shopify/store-chat/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import { publishConfigForSite } from '@/lib/messenger/actions-core';

export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat publish] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  try {
    // The audit trail needs an actor. Before a claim, that IS the synthetic
    // shop profile Phase 1 provisions — the same identity ensureShopOwnedSite
    // just resolved `site` under. There is no other actor available from a
    // verified-shop-domain request.
    const result = await publishConfigForSite(site, shopProfileId(session.shop));
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    // publishConfigForSite throws raw infra errors by contract (see
    // actions-core.ts) — never forward error.message to an untrusted client.
    console.error('[store-chat publish] failed to publish', error);
    return NextResponse.json({ ok: false, error: 'Action failed. Please try again.' }, { status: 500 });
  }
}
