import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardInstallLoading() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </section>
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </section>
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
