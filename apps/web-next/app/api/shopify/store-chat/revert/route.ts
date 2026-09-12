// apps/web-next/app/api/shopify/store-chat/revert/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { merchantRateLimitResponse } from '@/lib/request-rate-limit';
import { ensureShopOwnedSite } from '@/lib/messenger/shop-provisioning';
import { shopProfileId } from '@/lib/messenger/shop-tenancy';
import { revertConfigForSite } from '@/lib/messenger/actions-core';

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
    console.error('[store-chat revert] failed to resolve shop-owned site', error);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  try {
    // Same synthetic shop-profile actor publish/route.ts uses — there is no
    // other actor available from a verified-shop-domain request.
    const result = await revertConfigForSite(site, shopProfileId(session.shop));
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    // revertConfigForSite throws raw infra errors by contract (see
    // actions-core.ts) — never forward error.message to an untrusted client.
    console.error('[store-chat revert] failed to revert', error);
    return NextResponse.json({ ok: false, error: 'Action failed. Please try again.' }, { status: 500 });
  }
}
