import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardIntentsLoading() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className="rounded-3xl border bg-card p-6">
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="mt-3 h-4 w-80 rounded" />
        <Skeleton className="mt-6 h-64 rounded-2xl" />
        <Skeleton className="mt-4 h-24 rounded-2xl" />
      </section>
      <div className="grid gap-6">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    </div>
  );
}
