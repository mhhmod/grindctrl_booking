import { Skeleton } from '@/components/ui/skeleton';

/* Without this, clicking Store Chat in the sidebar sat on the previous page
   until every query returned — the click read as ignored. */
export default function StoreChatLoading() {
  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {[64, 84, 110, 76, 96, 82].map((width) => (
          <Skeleton key={width} className="h-9 rounded-t-lg" style={{ width }} />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>

      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
