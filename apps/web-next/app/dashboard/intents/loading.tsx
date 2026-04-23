import React from 'react';

export default function DashboardIntentsLoading() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="h-7 w-48 animate-pulse rounded bg-zinc-800" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded bg-zinc-800" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-zinc-950" />
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-zinc-950" />
      </section>
      <div className="grid gap-6">
        <div className="h-40 animate-pulse rounded-3xl bg-zinc-900" />
        <div className="h-56 animate-pulse rounded-3xl bg-zinc-900" />
      </div>
    </div>
  );
}
