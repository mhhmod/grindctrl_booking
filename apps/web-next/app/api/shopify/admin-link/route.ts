import { NextRequest, NextResponse } from 'next/server';
import { requireManagedTryOnShop } from '@/lib/shopify/shops';
import { getShopToken } from '@/lib/shopify/tokens';
import { merchantRateLimitResponse } from '@/lib/request-rate-limit';
export async function GET(request: NextRequest) {
  let shop: string;
  try { shop = await requireManagedTryOnShop(request.nextUrl.searchParams.get('shop')); }
  catch { return NextResponse.json({ error: 'unauthorized' }, { status: 403 }); }
  const limited = await merchantRateLimitResponse(`shop:${shop}`, 'read');
  if (limited) return limited;
  const token = await getShopToken(shop);
  if (!token) return NextResponse.json({ error: 'installation_selection_or_reauthorization_required' }, { status: 409 });
  return NextResponse.redirect(`https://${shop}/admin/apps/${encodeURIComponent(token.appClientId)}`);
}
