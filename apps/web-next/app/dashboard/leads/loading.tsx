import React from 'react';

export default function DashboardLeadsLoading() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="h-7 w-48 animate-pulse rounded bg-zinc-800" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded bg-zinc-800" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-zinc-950" />
        <div className="mt-4 h-28 animate-pulse rounded-2xl bg-zinc-950" />
      </section>
      <div className="grid gap-6">
        <div className="h-36 animate-pulse rounded-3xl bg-zinc-900" />
        <div className="h-96 animate-pulse rounded-3xl bg-zinc-900" />
      </div>
    </div>
  );
}
