'use server';
import { revalidatePath } from 'next/cache';
import { requireTryOnPlatformOperator, PlatformOperatorRequiredError } from '@/lib/shopify/platform-operator';
import { requireMerchantRateLimit } from '@/lib/request-rate-limit';
import { storeExists, flagStoreForTenant } from '@/lib/flags/store-flags';
import { normalizeTenantKey } from '@/lib/tenancy/tenant-key';
import { validSpendLimit, SPEND_LIMIT_KEYS, type SpendLimitKey } from '@/lib/spend/limits';
import { writeSpendLimit } from '@/lib/spend/store';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';

export async function setStoreSpendLimit(input: { tenant: string; key: SpendLimitKey; value: number | null }): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    const operator = await requireTryOnPlatformOperator();
    const tenant = normalizeTenantKey(input.tenant);
    if (!tenant || !SPEND_LIMIT_KEYS.includes(input.key) || (input.value !== null && !validSpendLimit(input.value))) return { ok: false, code: 'invalid' };
    await requireMerchantRateLimit('operator:' + operator);
    if (!(await storeExists(flagStoreForTenant(tenant)))) return { ok: false, code: 'unknown_store' };
    await writeSpendLimit(tenant, input.key, input.value, operator);
    invalidateProxyConfig(tenant);
    revalidatePath('/dashboard', 'layout');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof PlatformOperatorRequiredError ? 'forbidden' : 'unavailable' };
  }
}
