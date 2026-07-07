import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

/* Split-screen auth: brand statement pane (always warm-dark, independent
   of the theme toggle) + form pane on the app theme. On mobile the brand
   pane collapses to a slim strip so the form is immediately reachable. */
export function AuthShell({
  title,
  subtitle,
  footerPrompt,
  footerCtaLabel,
  footerCtaHref,
  children,
}: {
  title: string;
  subtitle: string;
  footerPrompt: string;
  footerCtaLabel: string;
  footerCtaHref: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh bg-background text-foreground lg:grid-cols-[1fr_1.1fr]">
      <section className="gc-auth-brand relative flex flex-col justify-between gap-6 overflow-hidden px-5 py-5 sm:px-8 lg:px-12 lg:py-12">
        <div className="pointer-events-none absolute inset-0 gc-hero-grid-warm" aria-hidden="true" />
        <Link href="/" className="relative inline-flex w-fit items-center rounded-lg">
          <BrandLogo size="sm" />
        </Link>
        <div className="relative hidden max-w-xl space-y-5 lg:block">
          <h2 className="text-[clamp(1.9rem,3.4vw,3.1rem)] font-bold leading-[1.08] tracking-tight">
            We build, run, and maintain your AI.
          </h2>
          <p className="text-base leading-[1.7] opacity-70">
            You watch every workflow, lead, and conversation from one dashboard.
          </p>
        </div>
        <p className="relative hidden text-xs opacity-50 lg:block">grindctrl.cloud</p>
        <p className="relative text-sm leading-snug opacity-70 lg:hidden">
          Done-for-you AI automation, watched from one dashboard.
        </p>
      </section>

      <section className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:py-12">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
          </div>

          <div className="[&_.cl-rootBox]:mx-auto [&_.cl-rootBox]:w-full [&_.cl-card]:w-full">
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
