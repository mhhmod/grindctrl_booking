import { StoreChatPage } from './store-chat-page';

export const dynamic = 'force-dynamic';

export default async function MessengerPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string; tab?: string }>;
}) {
  return StoreChatPage({ params: (await searchParams) ?? {}, tab: 'knows' });
}
