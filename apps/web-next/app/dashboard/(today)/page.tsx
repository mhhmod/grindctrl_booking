import { getRequestLocale } from '@/lib/auth/locale';
import { flagStoreOf, type ActiveStore } from '@/lib/dashboard/active-store';
import { getActiveStore, getActiveStoreRole, getActiveStoreTimeZone, getPendingPasteShop } from '@/lib/dashboard/active-store-server';
import { storeFlags } from '@/lib/flags/store-flags';
import { getTodayFacts } from '@/lib/dashboard/today-data';
import { buildTodayView } from '@/lib/dashboard/today-model';
import { getTodayCopy } from '@/lib/dashboard/today-copy';
import { V16Today } from '@/components/dashboard/v16/today/v16-today';
import { V16FinishConfirming, V16NoStore } from '@/components/dashboard/v16/states';
import { getTodaySetupFacts } from '@/lib/dashboard/today-setup-data';
import { buildTodaySetupView } from '@/lib/dashboard/today-setup-model';
import { getTodaySetupCopy } from '@/lib/dashboard/today-setup-copy';
import { V16TodaySetup } from '@/components/dashboard/v16/today/v16-today-setup';
import { getYourStoreFacts } from '@/lib/dashboard/your-store-data';
import { buildTodayStoreCard } from '@/lib/dashboard/your-store-model';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { V16YourStoreTodayCard } from '@/components/dashboard/v16/your-store/v16-your-store';
import { createPreviewLink, setLaunchState } from '@/app/dashboard/try-on/launch-actions';
import { roleCan, type DashboardWorkspaceRole } from '@/lib/rbac/dashboard-policy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export const dynamic = 'force-dynamic';

/** The Your store card for Today, or nothing when no store is connected.
 *  A failed read leaves the card out rather than blanking Today. */
async function yourStoreCard(activeStore: ActiveStore, role: DashboardWorkspaceRole, timeZone: string, locale: SiteLocale) {
  try {
    const facts = await getYourStoreFacts({ activeStore, role, timeZone });
    if (!facts) return null;
    return <V16YourStoreTodayCard card={buildTodayStoreCard(facts, getYourStoreCopy(locale), locale)} locale={locale} />;
  } catch (error) {
    console.error('[today] your store card failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export default async function DashboardOverviewPage() {
  const activeStore = await getActiveStore();
  const [locale, role] = await Promise.all([getRequestLocale(), getActiveStoreRole(activeStore)]);
  // A new account has no store to report on yet: say how to connect one.
  const flagStore = flagStoreOf(activeStore);
  if (!flagStore) return <V16NoStore locale={locale} />;

  // Days follow the active store's calendar, not UTC's (item 32).
  const timeZone = await getActiveStoreTimeZone(activeStore);
  const [flags, card, pending] = await Promise.all([storeFlags(flagStore), yourStoreCard(activeStore, role, timeZone, locale),
    getPendingPasteShop(activeStore)]);
  // Pasted code still being confirmed: the one step left leads the page.
  const storeCard = pending ? <><V16FinishConfirming locale={locale} shop={pending} />{card}</> : card;
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
          storeCard={storeCard}
        />
      );
    }
  }
  const facts = await getTodayFacts({ activeStore, role, timeZone });
  return <V16Today view={buildTodayView(facts, getTodayCopy(locale), locale)} locale={locale} storeCard={storeCard} />;
}
