import { getRequestLocale } from '@/lib/auth/locale';
import { V16PageSkeleton } from '@/components/dashboard/v16/skeletons';

export default async function SitesLoading() {
  return <V16PageSkeleton locale={await getRequestLocale()} variant="card" />;
}
