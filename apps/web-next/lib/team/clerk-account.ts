import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';

/** Shared with the linked-account hint. Clerk is the address source; never
 * send an owner alert to a shopper-supplied or placeholder profile email. */
export async function getClerkAccountEmail(userId: string): Promise<string | null> {
  const user = await (await clerkClient()).users.getUser(userId);
  return user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress
    ?? user.emailAddresses[0]?.emailAddress ?? null;
}
