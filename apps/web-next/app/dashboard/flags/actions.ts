'use server';

import { revalidatePath } from 'next/cache';
import { requireTryOnPlatformOperator, PlatformOperatorRequiredError } from '@/lib/shopify/platform-operator';
import { requireMerchantRateLimit, merchantActionFailure, type MerchantActionFailure } from '@/lib/request-rate-limit';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';
import {
  isStoreFlag,
  storeExists,
  storeFlags,
  writeStoreFlag,
  type FlagStore,
  type StoreFlag,
} from '@/lib/flags/store-flags';

export type StoreFlagActionResult =
  | { ok: true; flags: StoreFlag[] }
  | MerchantActionFailure
  | { ok: false; code: 'invalid'; message: string };

const FORBIDDEN: MerchantActionFailure = {
  ok: false,
  code: 'forbidden',
  message: 'You do not have permission to perform this action.',
};

function toStore(input: { kind: unknown; key: unknown }): FlagStore | null {
  if (typeof input.key !== 'string') return null;
  if (input.kind === 'shop') return { shopDomain: input.key };
  if (input.kind === 'site') return { widgetSiteId: input.key };
  return null;
}

/**
 * Turns one v16 feature on or off for one store. Only the platform operator
 * may, never a merchant: a flag can switch on a feature whose costs or
 * promises the owner has not agreed for that store.
 */
export async function setStoreFlag(input: {
  kind: 'shop' | 'site';
  key: string;
  flag: string;
  enabled: boolean;
}): Promise<StoreFlagActionResult> {
  try {
    const operator = await requireTryOnPlatformOperator();
    const store = toStore(input);
    if (!store || !isStoreFlag(input.flag) || typeof input.enabled !== 'boolean') {
      return { ok: false, code: 'invalid', message: 'Unknown store or flag.' };
    }
    await requireMerchantRateLimit(`operator:${operator}`);
    if (!(await storeExists(store))) {
      return { ok: false, code: 'invalid', message: 'Unknown store or flag.' };
    }
    await writeStoreFlag(store, input.flag, input.enabled, operator);
    // The storefront scripts read the flags from the App Proxy config.
    if ('shopDomain' in store) invalidateProxyConfig(store.shopDomain);
    revalidatePath('/dashboard/try-on');
    revalidatePath('/dashboard/store-chat');
    return { ok: true, flags: await storeFlags(store) };
  } catch (error) {
    if (error instanceof PlatformOperatorRequiredError) return FORBIDDEN;
    return merchantActionFailure(error);
  }
}
