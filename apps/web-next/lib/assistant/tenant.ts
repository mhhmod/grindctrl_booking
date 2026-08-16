import { randomUUID } from 'crypto';
import type { Tier } from './rate-limiter';

export interface ResolvedTenant {
  tenantId: string;
  tier: Tier;
  /** Set only when a fresh anon session cookie needs to be issued on the response. */
  newSessionId?: string;
}

export function resolveTenant(clerkUserId: string | null, existingSessionId: string | undefined): ResolvedTenant {
  if (clerkUserId) {
    return { tenantId: clerkUserId, tier: 'auth' };
  }

  if (existingSessionId) {
    return { tenantId: existingSessionId, tier: 'anon' };
  }

  const newSessionId = randomUUID();
  return { tenantId: newSessionId, tier: 'anon', newSessionId };
}
