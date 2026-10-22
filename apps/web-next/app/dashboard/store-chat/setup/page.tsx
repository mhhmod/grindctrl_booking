import { StoreChatPage } from '../store-chat-page';

export const dynamic = 'force-dynamic';

export default async function StoreChatSetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string; tab?: string }>;
}) {
  return StoreChatPage({ params: (await searchParams) ?? {}, tab: 'setup' });
}
