import { NextRequest, NextResponse } from 'next/server';
import { consumeShopLinkCode } from '@/lib/shopify/shop-links';
import { authenticateShopifyRequest } from '@/lib/shopify/session-token';

const authenticate = authenticateShopifyRequest;

export async function POST(request: NextRequest) {
  const session = authenticate(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as { code?: string };
  const outcome = await consumeShopLinkCode(String(body.code ?? ''), session.shop);
  return NextResponse.json({ outcome });
}
