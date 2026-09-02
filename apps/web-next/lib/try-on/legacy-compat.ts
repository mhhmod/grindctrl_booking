import 'server-only';

import { createHash } from 'node:crypto';

/**
 * Temporary rollout-only bridge for clients loaded before the signed
 * storefront transport reaches every theme. Compatibility sessions are
 * cryptographically distinct, shopless, and therefore never merchant-funded.
 * This is intentionally awkward to enable and defaults closed. Remove it
 * after backend -> extension -> enforcement rollout evidence is complete.
 */
export const LEGACY_STOREFRONT_COMPAT_ENV =
  'TRYON_TEMP_LEGACY_STOREFRONT_COMPAT';

export function legacyStorefrontCompatEnabled(): boolean {
  return (
    process.env[LEGACY_STOREFRONT_COMPAT_ENV] ===
    'allow-unsigned-nonbillable-storefront'
  );
}

export function warnLegacyStorefrontCompat(
  boundary: 'session_non_billable' | 'generation_non_billable',
  shop: string | null,
): void {
  const shopHash = shop
    ? createHash('sha256').update(shop, 'utf8').digest('hex').slice(0, 12)
    : 'shopless';
  // Never include request bodies, URLs, tokens, nonces, or request keys.
  console.warn('[try-on] temporary_legacy_storefront_compat_used', {
    boundary,
    shopHash,
  });
}
