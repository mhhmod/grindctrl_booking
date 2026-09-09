import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import type { AuthCopy } from '@/lib/auth/auth-i18n';
import { getDir, type SiteLocale } from '@/lib/landing/landing-i18n';

/* Split-screen auth: brand statement pane (always warm-dark, independent
   of the theme toggle) + form pane on the app theme. On mobile the brand
   pane collapses to a slim strip so the form is immediately reachable. */
export function AuthShell({
  locale,
  copy,
  title,
  subtitle,
  footerPrompt,
  footerCtaLabel,
  footerCtaHref,
  children,
}: {
  locale: SiteLocale;
  copy: AuthCopy;
  title: string;
  subtitle: string;
  footerPrompt: string;
  footerCtaLabel: string;
  footerCtaHref: string;
  children: React.ReactNode;
}) {
  return (
    <main
      dir={getDir(locale)}
      lang={locale}
      className="grid min-h-dvh grid-cols-1 bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <section className="gc-auth-brand relative flex flex-col justify-between gap-6 overflow-hidden px-5 py-5 sm:px-8 lg:px-12 lg:py-12">
        <div className="pointer-events-none absolute inset-0 gc-hero-grid-warm" aria-hidden="true" />
        <Link href="/" className="relative inline-flex w-fit items-center rounded-lg">
          <BrandLogo size="sm" />
        </Link>
        <div className="relative hidden max-w-xl space-y-5 lg:block">
          <h2 className="text-[clamp(1.9rem,3.4vw,3.1rem)] font-bold leading-[1.08] tracking-tight">
            {copy.brandHeadline}
          </h2>
          <p className="text-base leading-[1.7] opacity-70">{copy.brandBody}</p>
        </div>
        <p className="relative hidden text-xs opacity-50 lg:block">grindctrl.cloud</p>
        <p className="relative text-sm leading-snug opacity-70 lg:hidden">{copy.brandTagline}</p>
      </section>

      <section className="gc-auth-form-pane flex min-w-0 flex-col justify-center px-4 py-10 sm:px-8 lg:py-12">
        <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
          </div>

          {/* min-h reserves the form's approximate footprint before Clerk's
              JS bundle finishes loading and clerk.js initialises client-side
              — without it this div collapses to zero height and the visitor
              sees a hard empty gap for a few seconds instead of a stable
              loading state. Paired with the skeleton in ClerkLoading
              (components/auth/auth-clerk.tsx) so that gap has content in it,
              not just reserved space. */}
          {/* Explicit zero-minimum grid tracks and shrinkable containers let
              Clerk fit narrow screens instead of sizing the page to the
              form's intrinsic width. Do not mask this with overflow-x-hidden. */}
          <div className="min-h-[420px] min-w-0 max-w-full [&_.cl-rootBox]:mx-auto [&_.cl-rootBox]:w-full [&_.cl-rootBox]:max-w-full [&_.cl-cardBox]:max-w-full [&_.cl-card]:w-full [&_.cl-card]:max-w-full">
            {children}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {footerPrompt}{' '}
            <Link href={footerCtaHref} className="font-medium text-foreground underline-offset-4 hover:underline">
              {footerCtaLabel}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
