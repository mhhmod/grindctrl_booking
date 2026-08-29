import 'server-only';

/* Leaf module, deliberately dependency-free: the placeholder check is needed
   by both provisioning.ts (which pulls in @clerk/nextjs/server) and
   notify.ts (which must not). Keeping it here means a caller that only
   needs isPlaceholderEmail never drags Clerk in, and there's exactly one
   place that knows the suffix — a test can't drift from it. */

export const PLACEHOLDER_EMAIL_SUFFIX = '@users.noreply.clerk.dev';

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || email.endsWith(PLACEHOLDER_EMAIL_SUFFIX);
}
