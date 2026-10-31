import 'server-only';
import { coreCapabilitySecret } from '@/lib/security/capability-key';
import { resolveShopifyApp } from '@/lib/shopify/app-registry';
import type { VerifiedTryOnSession } from './storefront-context';

/** Separate trust domains: a core demo token cannot become a billable shop
 * capability; an app secret cannot mint a platform-neutral public demo. */
export function resolveTryOnSessionKey(verify: (secret: string) => VerifiedTryOnSession | null) {
  const core = coreCapabilitySecret();
  const demo = core ? verify(core) : null;
  if (demo?.purpose === 'public-demo') return { app: { clientId: 'grindctrl-core', secret: core! }, value: demo };
  const platform = resolveShopifyApp(verify);
  return platform && platform.value.purpose !== 'public-demo' ? platform : null;
}
