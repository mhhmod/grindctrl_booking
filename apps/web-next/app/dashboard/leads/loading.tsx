import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLeadsLoading() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <section className="rounded-3xl border bg-card p-6">
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="mt-3 h-4 w-80 rounded" />
        <Skeleton className="mt-6 h-64 rounded-2xl" />
        <Skeleton className="mt-4 h-28 rounded-2xl" />
      </section>
      <div className="grid gap-6">
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}
