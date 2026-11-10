import { getRequestLocale } from '@/lib/auth/locale';
import { EasyOrdersReturn } from '@/components/dashboard/v16/store-chat/easyorders-return';
import { inspectEasyOrdersInstall } from '../../easyorders-actions';

export const dynamic = 'force-dynamic';

/* EasyOrders' redirect_url (lib/easyorders/install.ts). The middleware sends a
   signed-out visitor to sign in and back here with the same state. Loading
   the page never connects a store; the Connect button does. */
export default async function EasyOrdersReturnPage({
  searchParams,
}: {
  searchParams?: Promise<{ state?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const state = typeof params.state === 'string' ? params.state : '';
  const [locale, initial] = await Promise.all([getRequestLocale(), inspectEasyOrdersInstall(state)]);
  return <EasyOrdersReturn locale={locale} state={state} initial={initial} />;
}
