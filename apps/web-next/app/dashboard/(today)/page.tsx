import { getRequestLocale } from '@/lib/auth/locale';
import { getTryOnOverview } from '@/lib/dashboard/overview-data';
import { getActiveStore, getActiveStoreRole, getActiveStoreTimeZone } from '@/lib/dashboard/active-store-server';
import { TryOnOverviewView } from '@/components/dashboard/tryon-overview-view';
import { storeFlags } from '@/lib/flags/store-flags';
import { getTodayFacts } from '@/lib/dashboard/today-data';
import { buildTodayView } from '@/lib/dashboard/today-model';
import { getTodayCopy } from '@/lib/dashboard/today-copy';
import { V16Today } from '@/components/dashboard/v16/today/v16-today';
import { getTodaySetupFacts } from '@/lib/dashboard/today-setup-data';
import { buildTodaySetupView } from '@/lib/dashboard/today-setup-model';
import { getTodaySetupCopy } from '@/lib/dashboard/today-setup-copy';
import { V16TodaySetup } from '@/components/dashboard/v16/today/v16-today-setup';
import { createPreviewLink, setLaunchState } from '@/app/dashboard/try-on/launch-actions';
import { roleCan } from '@/lib/rbac/dashboard-policy';

export const dynamic = 'force-dynamic';

export default async function DashboardOverviewPage() {
  const activeStore = await getActiveStore();
  // Days follow the active store's calendar, not UTC's (item 32).
  const timeZone = await getActiveStoreTimeZone(activeStore);
  const flagStore = activeStore.shopDomain
    ? { shopDomain: activeStore.shopDomain }
    : activeStore.siteId
      ? { widgetSiteId: activeStore.siteId }
      : null;

  /* The v16 Today (04-dashboard.md) for a store whose v16_dashboard flag is
     on, inside the v16 shell the layout draws for the same flag. */
  const flags = flagStore ? await storeFlags(flagStore) : [];
  if (flags.includes('v16_dashboard')) {
    const [locale, role] = await Promise.all([getRequestLocale(), getActiveStoreRole(activeStore)]);
    /* While the store is not live yet (n5_preview_mode), its owner and
       admins, who can take each step, get the setup checklist instead
       (Today-Setup). */
    if (flags.includes('n5_preview_mode') && roleCan(role, 'settings')) {
      const setup = await getTodaySetupFacts({ activeStore, holdoutAvailable: flags.includes('n6_holdout') });
      if (setup) {
        return (
          <V16TodaySetup
            view={buildTodaySetupView(setup, getTodaySetupCopy(locale))}
            locale={locale}
            shop={setup.shop}
            actions={{ setLaunchState, createPreviewLink }}
          />
        );
      }
    }
    const facts = await getTodayFacts({ activeStore, role, timeZone });
    return <V16Today view={buildTodayView(facts, getTodayCopy(locale), locale)} locale={locale} />;
  }

  const [locale, overview] = await Promise.all([getRequestLocale(), getTryOnOverview({ timeZone })]);
  return <TryOnOverviewView overview={overview} locale={locale} />;
}
