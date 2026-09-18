'use client';

/* Shared shell + section primitives for the product pages (/shopping,
   /conversations, /operations, /integrations, /security). Each one reuses
   the exact tokens/classes already established on /pricing and /roi rather
   than inventing new layout rules — see components/pricing/pricing-page-content.tsx
   and components/roi/roi-page-content.tsx for the source patterns.

   The shape here — small components, fully-optional props, one fixed
   vertical-rhythm wrapper per section — is deliberately the same contract
   Launch UI (github.com/launch-ui/launch-ui, MIT) uses for its own
   Section/block components. This is that pattern's home in this repo; see
   AGENTS.md's "Landing and marketing pages" section before adding a new
   block, importing Launch UI's raw source, or reaching for another
   component library. */

import React from 'react';
import Link from 'next/link';
import { AmbientBackground } from '@/components/landing/ambient-background';
import { Eyebrow } from '@/components/landing/eyebrow';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteHeader } from '@/components/landing/site-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trackClick } from '@/lib/analytics';
import { BOOKING_URL } from '@/lib/booking';
import { cn } from '@/lib/utils';

export function MarketingPage({ children }: { children: React.ReactNode }) {
  const { locale, t } = useLandingLocale();
  return (
    <>
      <AmbientBackground />
      <SiteHeader locale={locale} t={t} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

export interface CtaLink {
  href: string;
  label: string;
  /** trackClick's `cta` field, e.g. 'try_on' | 'pricing' | 'operations'. */
  cta: string;
}

export function CtaRow({
  bookCallLabel,
  section,
  secondary = [],
  className,
}: {
  bookCallLabel: string;
  /** trackClick's `section` field, e.g. 'shopping_hero' | 'operations_closing'. */
  section: string;
  secondary?: CtaLink[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row', className)}>
      <Button
        asChild
        size="lg"
        className="h-12 rounded-full px-6 font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
      >
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackClick('cta_clicked', { cta: 'book_call', section })}
        >
          {bookCallLabel}
        </a>
      </Button>
      {secondary.map((item) => (
        <Button
          key={item.href}
          asChild
          variant="outline"
          size="lg"
          className="h-12 rounded-full border-border px-6 font-semibold"
        >
          <Link href={item.href} onClick={() => trackClick('cta_clicked', { cta: item.cta, section })}>
            {item.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

export function ProductHero({
  eyebrow,
  title,
  lead,
  cta,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  cta: {
    bookCallLabel: string;
    section: string;
    secondary?: CtaLink[];
  };
}) {
  const { locale } = useLandingLocale();
  return (
    <section className="relative overflow-hidden border-b border-border" aria-labelledby="product-hero-title">
      <div className="gc-hero-grid-warm pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-24">
        <div className="min-w-0 max-w-3xl">
          <Badge
            variant="secondary"
            className={cn(
              'gc-fade-in-up h-auto whitespace-normal rounded-full px-3 py-1 text-[11px] font-semibold',
              locale === 'ar' ? 'text-xs' : 'uppercase tracking-[0.16em]',
            )}
          >
            {eyebrow}
          </Badge>
          <h1
            id="product-hero-title"
            className="gc-fade-in-up mt-4 max-w-3xl text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight sm:mt-6"
          >
            {title}
          </h1>
          <p className="gc-fade-in-up mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {lead}
          </p>
          <CtaRow {...cta} className="gc-fade-in-up mt-8" />
        </div>
      </div>
    </section>
  );
}

export function ProductSection({
  id,
  eyebrow,
  title,
  body,
  className,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { locale } = useLandingLocale();
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      className={cn('scroll-mt-20 border-b border-border', className)}
      aria-labelledby={headingId}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mb-8 max-w-3xl sm:mb-10">
          <Eyebrow locale={locale}>{eyebrow}</Eyebrow>
          <h2
            id={headingId}
            className="mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl lg:text-[40px]"
          >
            {title}
          </h2>
          {body ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{body}</p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export interface NotLiveItem {
  label: string;
  /** Why it's not live yet, or what exists instead. */
  note?: string;
  /** Localized status word, e.g. t.integrationStatePlanned. */
  status: string;
}

/* Honest "not live yet" list — every /shopping, /conversations, /operations,
   /integrations page has one per phase4-plan.json so a claim never implies
   more than the evidence sweep verified. */
export function NotLiveList({ title, items }: { title?: string; items: NotLiveItem[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
      {title ? (
        <p className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground sm:px-6">
          {title}
        </p>
      ) : null}
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex min-w-0 flex-wrap items-start justify-between gap-3 p-5 sm:p-6"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              {item.note ? (
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{item.note}</p>
              ) : null}
            </div>
            <Badge variant="outline" className="shrink-0 rounded-full px-3 py-1 text-xs font-medium">
              {item.status}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
