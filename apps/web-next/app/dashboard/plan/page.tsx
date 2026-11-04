import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { getActiveStore, getActiveStoreRole, getActiveStoreTimeZone, listDashboardShops } from '@/lib/dashboard/active-store-server';
import { activeTenantKey } from '@/lib/dashboard/active-store';
import { shopChoices } from '@/lib/dashboard/shell-model';
import { roleCan } from '@/lib/rbac/dashboard-policy';
import { CURRENCY_COOKIE, resolveCurrency } from '@/lib/pricing/currency';
import { getPlanFacts } from '@/lib/dashboard/plan-data';
import { buildPlanView, type PlanView } from '@/lib/dashboard/plan-model';
import { getPlanCopy } from '@/lib/dashboard/plan-copy';
import { V16Plan, V16PlanError } from '@/components/dashboard/v16/plan/v16-plan';
import { V16NeedsStore } from '@/components/dashboard/v16/states';

export const dynamic = 'force-dynamic';

/* The v16 Plan page (04-dashboard.md), for the owner of the active store.
   Admins and members are sent to Today, on the server, not only by the nav
   (item 12). A plan belongs to a Shopify store or a paired WooCommerce
   store, so a Store Chat site with neither, or a new account, is told to
   connect one. A WooCommerce store's paid plans are arranged with GRINDCTRL
   and activated by the platform operator (no checkout), which is what this
   page already tells every store. */
export default async function DashboardPlanPage() {
  await requireDashboardUser('/dashboard/plan');
  const activeStore = await getActiveStore();
  const shop = activeTenantKey(activeStore);
  if (!roleCan(await getActiveStoreRole(activeStore), 'billing')) redirect('/dashboard');
  if (!shop) {
    const [locale, shops] = await Promise.all([getRequestLocale(), listDashboardShops().catch(() => [])]);
    return <V16NeedsStore locale={locale} feature="plan" shops={shopChoices(shops)} />;
  }

  const [locale, timeZone, cookieStore] = await Promise.all([getRequestLocale(), getActiveStoreTimeZone(activeStore), cookies()]);
  // A store on a paid plan lists plans in its own currency; on Free, in the one chosen on the pricing page.
  const currency = resolveCurrency({ cookie: cookieStore.get(CURRENCY_COOKIE)?.value ?? null, country: null });
  let view: PlanView | null = null;
  try {
    view = buildPlanView(await getPlanFacts({ shop, timeZone, currency }), getPlanCopy(locale), locale);
  } catch (error) {
    console.error('[plan] failed:', error instanceof Error ? error.message : error);
  }
  return view ? <V16Plan view={view} locale={locale} /> : <V16PlanError locale={locale} />;
}
