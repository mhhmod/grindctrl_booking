import { NextRequest, NextResponse } from 'next/server';
import { consumeShopLinkCode, getShopOwnerClerkUserId } from '@/lib/shopify/shop-links';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';
import { ensureMessengerSite, transferShopSite } from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';

const authenticate = authenticateShopifyRequest;

/* One connect step for the merchant: the code links Try-On, and the same
   account then adopts this store's Store Chat, so the dashboard shows both.
   On a re-link by the store's admin, Store Chat moves too. On a first link,
   Store Chat owned by another real account is left where it is; the
   Try-On link still succeeds. */
async function adoptStoreChat(
  shop: string,
  replace: boolean,
): Promise<'adopted' | 'owned_elsewhere' | 'failed'> {
  try {
    const owner = await getShopOwnerClerkUserId(shop);
    if (!owner) return 'failed';
    // A re-link by the store's admin moves the store's Store Chat with it.
    if (replace) await transferShopSite(shop, owner);
    await ensureMessengerSite(owner, shop, shop);
    return 'adopted';
  } catch (error) {
    if (error instanceof StoreOwnedByAnotherAccountError) return 'owned_elsewhere';
    console.error('[shopify] link: store chat adoption failed', {
      shop,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return 'failed';
  }
}

export async function POST(request: NextRequest) {
  const session = authenticate(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as { code?: string; replace?: boolean };
  const replace = body.replace === true;
  const outcome = await consumeShopLinkCode(String(body.code ?? ''), session.shop, { replace });
  if (outcome !== 'linked') return NextResponse.json({ outcome });
  const storeChat = await adoptStoreChat(session.shop, replace);
  return NextResponse.json({ outcome, storeChat });
}
