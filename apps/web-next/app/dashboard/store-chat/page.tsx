import { getRequestLocale } from '@/lib/auth/locale';
import { DisconnectNotice } from '@/components/dashboard/v16/store-chat/disconnect-notice';
import { StoreChatPage } from './store-chat-page';

export const dynamic = 'force-dynamic';

export default async function MessengerPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string; tab?: string; orders?: string; disconnected?: string; shop?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const page = await StoreChatPage({ params, tab: 'knows' });
  return <>{params.disconnected === '1' ? <DisconnectNotice locale={await getRequestLocale()} shop={params.shop} /> : null}{page}</>;
}
