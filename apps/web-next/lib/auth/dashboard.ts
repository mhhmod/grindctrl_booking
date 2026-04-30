import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export function getDashboardRedirectPath(pathname: string) {
  const params = new URLSearchParams({ redirect_url: pathname });
  return `/sign-in?${params.toString()}`;
}

export async function requireDashboardUser(pathname: string) {
  const { userId } = await auth();
  if (!userId) {
    redirect(getDashboardRedirectPath(pathname));
  }
  return userId;
}
