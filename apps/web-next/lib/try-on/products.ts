/* ─── Try-On Agent — Seeded Products ─── */

import type { TryOnProduct } from './types';

export const PRODUCTS: Record<string, TryOnProduct> = {
  'premium-ringer-tee': {
    id: 'premium-ringer-tee',
    name: 'Premium Ringer Tee',
    category: 't-shirt',
    imageUrl: '/try-on/premium-ringer-tee.png',
    details: [
      'Cream/off-white body',
      'Dark chocolate-brown ribbed crew neck',
      'Dark chocolate-brown ribbed sleeve cuffs',
      'Small left-chest embroidered emblem',
      'Premium athletic / muscle-fit silhouette',
      'Heavyweight soft cotton jersey',
    ],
  },
};

export const DEFAULT_PRODUCT_ID = 'premium-ringer-tee';

export function getProduct(productId: string): TryOnProduct | undefined {
  return PRODUCTS[productId];
}

export function getDefaultProduct(): TryOnProduct {
  return PRODUCTS[DEFAULT_PRODUCT_ID];
}
