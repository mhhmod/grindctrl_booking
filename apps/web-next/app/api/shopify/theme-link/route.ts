import { NextRequest, NextResponse } from 'next/server';
import { requireManagedTryOnShop } from '@/lib/shopify/shops';
import { getShopToken } from '@/lib/shopify/tokens';
import { merchantRateLimitResponse } from '@/lib/request-rate-limit';
import { appEmbedActivationUrl, productBlockAddUrl } from '@/lib/shopify/app-identity';

export async function GET(request: NextRequest) {
  let shop: string;
  try { shop = await requireManagedTryOnShop(request.nextUrl.searchParams.get('shop'), { capability: 'settings' }); }
  catch { return NextResponse.json({ error: 'unauthorized' }, { status: 403 }); }
  const limited = await merchantRateLimitResponse(`shop:${shop}`, 'read');
  if (limited) return limited;
  const block = request.nextUrl.searchParams.get('block');
  if (!block || !['tryon', 'tryon-catalog', 'messenger'].includes(block)) {
    return NextResponse.json({ error: 'invalid_block' }, { status: 400 });
  }
  const token = await getShopToken(shop);
  if (!token) return NextResponse.json({ error: 'installation_selection_or_reauthorization_required' }, { status: 409 });
  const link = request.nextUrl.searchParams.get('mode') === 'product'
    ? productBlockAddUrl(shop, block, token.appClientId) : appEmbedActivationUrl(shop, block, token.appClientId);
  return NextResponse.redirect(link);
}
