import 'server-only';

import { cache } from 'react';
import { currentUser } from '@clerk/nextjs/server';
import { SIGNED_OUT_VIEWER, siteViewerFromUser, type SiteViewer } from './site-viewer';

/* One Clerk user read per request, shared by the root layout and the
   dashboard shell, which both need it on a dashboard page load. */
export const getRequestUser = cache(() => currentUser());

export async function getSiteViewer(userId: string | null): Promise<SiteViewer> {
  if (!userId) return SIGNED_OUT_VIEWER;
  /* The header state rests on the session, which is already known. A user
     read that fails costs only the avatar, never the page. */
  const user = await getRequestUser().catch(() => null);
  return siteViewerFromUser(user);
}
