import { getRequestLocale } from '@/lib/auth/locale';
import { V16PageSkeleton } from '@/components/dashboard/v16/skeletons';

/* Without this, clicking Store Chat in the sidebar sat on the previous page
   until every query returned, and the click read as ignored. */
export default async function StoreChatLoading() {
  return <V16PageSkeleton locale={await getRequestLocale()} variant="tabs" />;
}
