import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { UnauthorizedError } from '@/lib/messenger/provisioning';

/* No session at all, as opposed to a signed-in person without access. It
   extends UnauthorizedError so any handler that already treats that as a
   refusal still refuses; handlers that check this first can answer with a
   signed-out result (lib/auth/session-ended.ts) instead. */
export class SignedOutError extends UnauthorizedError {
  constructor() {
    super();
    this.name = 'SignedOutError';
  }
}

export async function requireSessionUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new SignedOutError();
  return userId;
}
