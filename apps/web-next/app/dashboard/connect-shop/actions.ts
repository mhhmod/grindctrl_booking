'use server';

import { auth } from '@clerk/nextjs/server';
import { requireMerchantRateLimit } from '@/lib/request-rate-limit';
import {
  createShopLinkCode,
  shopLinkedByCode,
  type ShopLinkCode,
} from '@/lib/shopify/shop-links';

export async function generateShopLinkCode(): Promise<ShopLinkCode> {
  return createShopLinkCode();
}

/** Whether the open code panel's code has connected a shop yet. The panel
 *  reads this every few seconds; any failure reads as "not yet" and the
 *  next read tries again, so the panel never shows a wrong success. */
export async function shopLinkCodeStatus(code: string): Promise<{ linkedShop: string | null }> {
  if (typeof code !== 'string' || !/^[A-Za-z0-9-]{4,32}$/.test(code)) return { linkedShop: null };
  try {
    const { userId } = await auth();
    if (!userId) return { linkedShop: null };
    await requireMerchantRateLimit(`shop-link:${userId}`, 'read');
    return { linkedShop: await shopLinkedByCode(code) };
  } catch {
    return { linkedShop: null };
  }
}
