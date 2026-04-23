import React from 'react';

export default function DashboardInstallLoading() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="h-40 animate-pulse rounded-3xl bg-zinc-900" />
        <div className="h-40 animate-pulse rounded-3xl bg-zinc-900" />
      </section>
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="h-80 animate-pulse rounded-3xl bg-zinc-900" />
        <div className="h-80 animate-pulse rounded-3xl bg-zinc-900" />
      </section>
      <div className="h-56 animate-pulse rounded-3xl bg-zinc-900" />
      <div className="h-48 animate-pulse rounded-3xl bg-zinc-900" />
    </div>
  );
}
