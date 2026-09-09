import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { requireOwnedSite, UnauthorizedError } from '@/lib/messenger/provisioning';
import { merchantActionFailure, requireMerchantRateLimit } from '@/lib/request-rate-limit';

/** Legacy service-role RPCs do not verify the Clerk ID they receive. Even a
 * server-bound action context must be checked against the current session;
 * neither a stale binding nor a direct invocation is an authority source. */
export async function authorizeDashboardAction(
  context: { clerkUserId: string; siteId: string },
): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (!userId || !context || context.clerkUserId !== userId
      || typeof context.siteId !== 'string' || !context.siteId.trim()) {
      throw new UnauthorizedError();
    }

    const site = await requireOwnedSite(userId, context.siteId);
    const identity = site.domain && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(site.domain)
      ? `shop:${site.domain}`
      : `account:${userId}`;
    // A caller must prove ownership before consuming this merchant's bucket.
    await requireMerchantRateLimit(identity);
    return null;
  } catch (error) {
    if (error instanceof UnauthorizedError) return 'You do not have permission to change this site. Please sign in to the correct account.';
    return merchantActionFailure(error).message;
  }
}
