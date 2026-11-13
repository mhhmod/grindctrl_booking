/* Who is looking at a public page, as the marketing header needs it.

   Resolved on the server (app/layout.tsx already reads the session for
   every request), so the header is right in the first paint: a signed-in
   person never sees "Sign in" flash before it turns into their dashboard
   link. Only what the header draws is kept: initials and a photo address,
   never the email or the Clerk id. */

import { DEFAULT_SIGNED_IN_PATH } from './redirect';

export type SiteViewer =
  | { signedIn: false }
  | { signedIn: true; initials: string | null; imageUrl: string | null };

export const SIGNED_OUT_VIEWER: SiteViewer = { signedIn: false };

/** Where "Open dashboard" and the signed-in CTAs go. The dashboard itself
 *  sends a new account to onboarding and a merchant to their last store. */
export const SIGNED_IN_HOME = DEFAULT_SIGNED_IN_PATH;

type ViewerUser = {
  firstName?: string | null;
  lastName?: string | null;
  hasImage?: boolean;
  imageUrl?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
};

function initialsOf(user: ViewerUser): string | null {
  const names = [user.firstName, user.lastName].map((part) => part?.trim()).filter(Boolean) as string[];
  const letters = names.length > 0
    ? names.slice(0, 2).map((name) => Array.from(name)[0]).join('')
    : Array.from(user.primaryEmailAddress?.emailAddress.trim() ?? '')[0] ?? '';
  return letters ? letters.toLocaleUpperCase() : null;
}

/** A signed-in viewer from the Clerk user. A user that could not be read
 *  is still signed in: the header then shows a plain person mark. */
export function siteViewerFromUser(user: ViewerUser | null): SiteViewer {
  if (!user) return { signedIn: true, initials: null, imageUrl: null };
  const imageUrl = user.hasImage && user.imageUrl?.startsWith('https://') ? user.imageUrl : null;
  return { signedIn: true, initials: initialsOf(user), imageUrl };
}
