import { randomUUID } from 'crypto';
import type { Tier } from './rate-limiter';

export interface ResolvedTenant {
  tenantId: string;
  tier: Tier;
  /** Set whenever a fresh anon session cookie should be issued on the response
   *  (the cookie is a UX continuity handle, not the enforcement identity). */
  newSessionId?: string;
}

/* Anonymous budget enforcement keys on the network the request came from,
   not on a cookie the client fully controls. A self-declared session id can
   be rotated per request, which would make every "per visitor" cap purely
   decorative — so when the server can see an IP (rightmost x-forwarded-for
   entry added by our own proxy, or x-real-ip), THAT is the budget key and
   the cookie rides along only for continuity. When no proxy header exists
   (direct dev access), we degrade to the cookie id; if neither exists,
   everything shares one bucket — visible throttling beats silent bypass. */
export function resolveTenant(
  clerkUserId: string | null,
  existingSessionId: string | undefined,
  clientIp?: string | null,
): ResolvedTenant {
  if (clerkUserId) {
    return { tenantId: clerkUserId, tier: 'auth' };
  }

  const freshSessionId = randomUUID();
  const tenantId = clientIp
    ? `ip:${clientIp}`
    : `sid:${existingSessionId ?? freshSessionId}`;

  return {
    tenantId,
    tier: 'anon',
    ...(existingSessionId ? {} : { newSessionId: freshSessionId }),
  };
}
