'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { TryOnDemo } from '@/components/try-on/try-on-demo';
import { LocaleToggle } from '@/components/try-on/locale-toggle';
import { useTryOnLocale } from '@/components/try-on/locale-provider';

export function TryOnPageContent() {
  const { t } = useTryOnLocale();

  return (
    <>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={t.brandHome}
            >
              <BrandLogo />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5 rtl:-scale-x-100" />
              {t.home}
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
        {/* Hero section */}
        <div className="gc-fade-in-up mx-auto mb-12 max-w-2xl space-y-4 text-center">
          <div className="mx-auto mb-4 inline-flex h-7 items-center rounded-full bg-primary/10 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {t.heroBadge}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {t.heroTitle}
          </h1>
          <p className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t.heroSubtitle}
          </p>
        </div>

        {/* Demo component */}
        <TryOnDemo />
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" textClassName="text-xs" />
          </div>
          <p className="text-xs">{t.footerTagline}</p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/" className="transition-colors hover:text-foreground">
              {t.footerHome}
            </Link>
            <Link href="/sign-up" className="transition-colors hover:text-foreground">
              {t.footerSignUp}
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
