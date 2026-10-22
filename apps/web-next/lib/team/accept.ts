import 'server-only';

import { cache } from 'react';
import { currentUser } from '@clerk/nextjs/server';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { ensureProfile } from '@/lib/messenger/provisioning';
import { acceptPendingInvites } from './invites';

/** Whether any team has an invite waiting: one read of a partial index, so
 *  a page load while none is pending (nearly always) asks Clerk nothing. */
async function anyPendingInvite(): Promise<boolean> {
  const result = await getMessengerServiceClient()
    .from('workspace_invites')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  return !result.error && (result.count ?? 0) > 0;
}

/* Joins the signed-in person to every team that invited one of their
   verified addresses (N21), with the role they were invited with. Run by
   the dashboard layout and the onboarding page, so someone invited joins
   on their first visit whichever way they signed in. Never throws; returns
   the workspaces joined. Once per request. */
export const acceptInvitesForSignedIn = cache(async (): Promise<string[]> => {
  try {
    if (!(await anyPendingInvite())) return [];
    const user = await currentUser();
    if (!user) return [];
    const verified = user.emailAddresses
      .filter((address) => address.verification?.status === 'verified')
      .map((address) => address.emailAddress);
    const primary = user.primaryEmailAddress?.emailAddress ?? verified[0] ?? null;
    return await acceptPendingInvites({
      verifiedEmails: verified,
      ensureProfileId: async () => (await ensureProfile(user.id, primary)).id,
    });
  } catch (error) {
    console.error('[team] accepting invites failed:', error instanceof Error ? error.message : error);
    return [];
  }
});
