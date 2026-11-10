import { getRequestLocale } from '@/lib/auth/locale';
import { getActiveStore, getActiveStoreRole, getActiveStoreTimeZone } from '@/lib/dashboard/active-store-server';
import { getYourStoreFacts } from '@/lib/dashboard/your-store-data';
import { buildYourStoreView } from '@/lib/dashboard/your-store-model';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { V16YourStore, V16YourStoreNotConnected } from '@/components/dashboard/v16/your-store/v16-your-store';
import { roleCan } from '@/lib/rbac/dashboard-policy';
import { setTryOnButtonAction } from '@/app/dashboard/try-on/actions';
import { setMessengerEnabled } from '@/app/dashboard/store-chat/actions';
import { checkPasteDomainAction } from '@/app/dashboard/store-chat/paste-actions';

export const dynamic = 'force-dynamic';

/* Your store (Pack A handoff, A5 and A6): how GRINDCTRL is on the active
   store, a switch per product and the Store check. Everyone who sees Store
   Chat and Try-On sees it; the switches save through the same actions as
   their Set up pages, which check the person's role again. A failed read
   throws to the dashboard's error state. */
export default async function YourStorePage() {
  const activeStore = await getActiveStore();
  const [locale, role, timeZone] = await Promise.all([
    getRequestLocale(),
    getActiveStoreRole(activeStore),
    getActiveStoreTimeZone(activeStore),
  ]);
  const canChange = roleCan(role, 'settings');
  const facts = await getYourStoreFacts({ activeStore, role, timeZone });
  if (!facts) return <V16YourStoreNotConnected locale={locale} canChange={canChange} />;
  return (
    <V16YourStore
      view={buildYourStoreView(facts, getYourStoreCopy(locale), locale)}
      canChange={canChange}
      locale={locale}
      actions={{ setTryOnButton: setTryOnButtonAction, setStoreChat: setMessengerEnabled, checkDomain: checkPasteDomainAction }}
    />
  );
}
