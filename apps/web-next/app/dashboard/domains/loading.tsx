import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardDomainsLoading() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <section className="rounded-3xl border bg-card p-6">
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="mt-3 h-4 w-72 rounded" />
        <Skeleton className="mt-6 h-28 rounded-2xl" />
        <div className="mt-4 grid gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </section>
      <div className="grid gap-6">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    </div>
  );
}
