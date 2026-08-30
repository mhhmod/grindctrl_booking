import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import { setMessengerEnabledForSite } from '@/lib/messenger/actions-core';

export async function POST(request: NextRequest) {
  const session = authenticateShopifyRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let site;
  try {
    site = await ensureShopOwnedSite(session.shop);
  } catch (error) {
    console.error('[store-chat enable] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const body = (await request.json()) as { enabled?: unknown };
  try {
    const result = await setMessengerEnabledForSite(site, shopProfileId(session.shop), body.enabled === true);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    // setMessengerEnabledForSite throws raw infra errors by contract (see
    // actions-core.ts) — never forward error.message to an untrusted client.
    console.error('[store-chat enable] failed to toggle status', error);
    return NextResponse.json({ ok: false, error: 'Action failed. Please try again.' }, { status: 500 });
  }
}
