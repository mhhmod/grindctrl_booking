'use server';

import {
  createShopLinkCode,
  type ShopLinkCode,
} from '@/lib/shopify/shop-links';

export async function generateShopLinkCode(): Promise<ShopLinkCode> {
  return createShopLinkCode();
}
