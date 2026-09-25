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
  /* The four public demo pieces on /try-on. Details describe only what the
     product image shows; no fabric or fit claims beyond it. */
  'demo-embroidered-abaya': {
    id: 'demo-embroidered-abaya',
    name: 'Embroidered abaya',
    category: 'abaya',
    imageUrl: '/try-on/demo/garment-abaya.webp',
    details: [
      'Black open-front abaya, full length',
      'Tonal black leaf embroidery down both front edges',
      'Matching embroidery at the sleeve cuffs',
      'Wide, straight long sleeves',
    ],
  },
  'demo-sage-linen-shirt': {
    id: 'demo-sage-linen-shirt',
    name: 'Sage linen shirt',
    category: 'shirt',
    imageUrl: '/try-on/demo/garment-linen-shirt.webp',
    details: [
      'Sage green button-front shirt with a point collar',
      'Relaxed, dropped-shoulder cut',
      'Long sleeves with buttoned cuffs',
      'Curved shirttail hem',
    ],
  },
  'demo-denim-overshirt': {
    id: 'demo-denim-overshirt',
    name: 'Denim overshirt',
    category: 'shirt',
    imageUrl: '/try-on/demo/garment-denim-overshirt.webp',
    details: [
      'Mid-blue denim with a point collar',
      'Snap front and two flap chest pockets',
      'Contrast topstitching',
      'Long sleeves with snap cuffs',
    ],
  },
  'demo-knit-polo': {
    id: 'demo-knit-polo',
    name: 'Knit polo',
    category: 'polo',
    imageUrl: '/try-on/demo/garment-knit-polo.webp',
    details: [
      'Navy textured knit polo',
      'Three-button placket and a flat knit collar',
      'Short sleeves with ribbed cuffs',
      'Ribbed hem',
    ],
  },
};

export const DEFAULT_PRODUCT_ID = 'premium-ringer-tee';

export function getProduct(productId: string): TryOnProduct | undefined {
  // hasOwnProperty guard: handles like "constructor" must not resolve
  // to inherited object members.
  return Object.prototype.hasOwnProperty.call(PRODUCTS, productId)
    ? PRODUCTS[productId]
    : undefined;
}

export function getDefaultProduct(): TryOnProduct {
  return PRODUCTS[DEFAULT_PRODUCT_ID];
}
