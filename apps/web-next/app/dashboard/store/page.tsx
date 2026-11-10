import { getRequestLocale } from '@/lib/auth/locale';
import { getActiveStore, getActiveStoreRole, getActiveStoreTimeZone } from '@/lib/dashboard/active-store-server';
import { getYourStoreFacts } from '@/lib/dashboard/your-store-data';
import { buildYourStoreView } from '@/lib/dashboard/your-store-model';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { V16YourStore } from '@/components/dashboard/v16/your-store/v16-your-store';
import { StoreChatPage } from '@/app/dashboard/store-chat/store-chat-page';
import { roleCan } from '@/lib/rbac/dashboard-policy';
import { setTryOnButtonAction } from '@/app/dashboard/try-on/actions';
import { setMessengerEnabled } from '@/app/dashboard/store-chat/actions';
import { checkPasteDomainAction } from '@/app/dashboard/store-chat/paste-actions';

export const dynamic = 'force-dynamic';

/* Store setup (Pack A handoff, A4 to A6): connect the store, a switch per
   product and the Store check. Everyone who sees Store
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
  /* Connect your store comes first: it is the whole page until a store is
     connected, then a one-line card above the switches and the check. */
  const connect = <StoreChatPage params={{}} tab="install" />;
  if (!facts) return connect;
  return (
    <V16YourStore
      connect={connect}
      view={buildYourStoreView(facts, getYourStoreCopy(locale), locale)}
      canChange={canChange}
      locale={locale}
      actions={{ setTryOnButton: setTryOnButtonAction, setStoreChat: setMessengerEnabled, checkDomain: checkPasteDomainAction }}
    />
  );
}
