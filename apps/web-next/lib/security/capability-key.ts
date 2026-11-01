import 'server-only';

/** Core-owned capabilities must not depend on any platform registration.
 * Configure an independent random secret before rollout; missing fails closed.
 * Rotation invalidates short-lived links; never silently try Shopify keys. */
export function coreCapabilitySecret(): string | null {
  const value = process.env.GRINDCTRL_CAPABILITY_SECRET?.trim();
  return value && Buffer.byteLength(value, 'utf8') >= 32 ? value : null;
}
