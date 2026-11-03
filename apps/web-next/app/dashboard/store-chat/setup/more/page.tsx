import { StoreChatPage } from '../../store-chat-page';

export const dynamic = 'force-dynamic';

/* The editors Set up does not cover yet (saved replies, opening hours, the
   widget's language, a custom icon, the launcher size), and where Shopify's
   order access grant returns. */
export default async function StoreChatMoreSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string; section?: string; orders?: string }>;
}) {
  return StoreChatPage({ params: (await searchParams) ?? {}, tab: 'more' });
}
