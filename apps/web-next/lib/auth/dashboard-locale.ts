import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/** The cookie still decides the dashboard language. Remember that resolved
 * value on this authenticated person's existing profile for scheduled mail.
 * Failure (including a not-yet-applied migration) must not break navigation. */
export async function rememberDashboardLocale(clerkUserId: string, locale: SiteLocale): Promise<void> {
  try {
    const { error } = await getMessengerServiceClient().from('profiles').update({ dashboard_locale: locale })
      .eq('clerk_user_id', clerkUserId).neq('dashboard_locale', locale);
    if (error) console.error('[dashboard] locale persistence failed', { code: error.code });
  } catch { console.error('[dashboard] locale persistence unavailable'); }
}
