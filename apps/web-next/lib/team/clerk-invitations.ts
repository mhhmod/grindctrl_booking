import 'server-only';

import { clerkClient } from '@clerk/nextjs/server';
import { INVITE_DAYS, type InvitationSender } from './invites';

/* Clerk sends the invitation email (N21). Its link lands on our sign-up
   page, where Clerk's own component reads the invitation ticket; someone
   who already has an account signs in instead. Either way, reaching the
   dashboard with that verified address joins the team (acceptPendingInvites). */
export function clerkInvitationSender(origin: string): InvitationSender {
  const redirectUrl = `${origin.replace(/\/+$/, '')}/sign-up`;
  return {
    async send(email) {
      const invitation = await (await clerkClient()).invitations.createInvitation({
        emailAddress: email,
        redirectUrl,
        notify: true,
        // Someone with an account already, or an earlier invitation, still gets this one.
        ignoreExisting: true,
        expiresInDays: INVITE_DAYS,
      });
      return { id: invitation.id };
    },
    async revoke(id) {
      await (await clerkClient()).invitations.revokeInvitation(id);
    },
  };
}
