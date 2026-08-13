'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { TryOnDemo } from '@/components/try-on/try-on-demo';
import { LocaleToggle } from '@/components/try-on/locale-toggle';
import { useTryOnLocale } from '@/components/try-on/locale-provider';
import { cn } from '@/lib/utils';

export function TryOnPageContent() {
  const { t, locale } = useTryOnLocale();

  return (
    <>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            /* min-w-0: without it this flex child never shrinks below its
               content's natural width, which blocks BrandLogo's own
               `truncate` from ever engaging — the header pushed the
               language/theme controls out of the viewport on a phone,
               worse with the longer Arabic heroBadge subtitle. */
            className="min-w-0 rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={t.brandHome}
          >
            <BrandLogo subtitle={t.heroBadge} />
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* The language switch is the header's one loud control: Arabic
                visitors must find it without hunting. */}
            <LocaleToggle className="border-foreground/25 px-3 text-sm" />
            <ThemeToggle locale={locale} />
            <Link
              href="/"
              className="hidden h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
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
          <div
            className={cn(
              /* py- not a fixed h-: the Arabic string below runs noticeably
                 longer than the English one and a fixed height clips it on
                 narrow phones instead of letting the pill grow. */
              'mx-auto mb-4 inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary',
              /* Same rule as components/landing/eyebrow.tsx: letter-spacing
                 breaks Arabic letter-joining, so uppercase+tracking is
                 English-only. */
              locale === 'ar' ? 'text-xs' : 'uppercase tracking-[0.2em]',
            )}
          >
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
