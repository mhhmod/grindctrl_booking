'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight02Icon,
} from '@hugeicons/core-free-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AmbientBackground } from '@/components/landing/ambient-background';
import { RenderReceiptFigure } from '@/components/landing/render-receipt-figure';
import { ConnectedSystemMap } from '@/components/landing/connected-system-map';
import { JourneyProofTabs } from '@/components/landing/journey-proof-tabs';
import { PlatformEvidenceSequence } from '@/components/landing/platform-evidence-sequence';
import { PlatformPillars } from '@/components/landing/platform-pillars';
import { Icon } from '@/components/icons';
import { Eyebrow } from '@/components/landing/eyebrow';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteHeader } from '@/components/landing/site-header';
import { HeroSystem } from '@/components/landing/proof/hero-system';
import { getProofCopy } from '@/components/landing/proof/proof-copy';
import { getRoiCopy } from '@/components/roi/roi-copy';
import { ShopifyMark } from '@/components/brand-marks';
import { trackClick } from '@/lib/analytics';
import { BOOKING_URL } from '@/lib/booking';
import type { PublicPlanCatalogItem } from '@/lib/try-on/public-catalog';

const DEMO_URL = '/try-on';

/* Testimonial quotes and photos are placeholders pending real client
   sign-off. Keep this false until verified quotes are approved. */
const ENABLE_TESTIMONIALS = false;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

function TestimonialAvatar({
  photo,
  name,
  size = 44,
  className = '',
}: {
  photo?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!photo || errored) {
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-full border border-border bg-background text-sm font-semibold uppercase ${className}`}
        style={{ width: size, height: size }}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full border border-border ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={photo}
        alt={name}
        fill
        sizes={`${size}px`}
        className="object-cover"
        onError={() => setErrored(true)}
      />
    </span>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  body,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body?: string;
}) {
  const { locale } = useLandingLocale();
  return (
    <div className="mb-10 flex max-w-3xl flex-col gap-3">
      <Eyebrow locale={locale}>{eyebrow}</Eyebrow>
      <h2 id={id} className="text-[28px] font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[44px] lg:leading-[1.05]">
        {title}
      </h2>
      {body ? (
        <p className="text-base leading-[1.65] text-muted-foreground sm:text-lg">{body}</p>
      ) : null}
    </div>
  );
}

function ArrowIcon() {
  return (
    <span data-icon="inline-end" aria-hidden="true">
      <Icon icon={ArrowRight02Icon} className="rtl:-scale-x-100" />
    </span>
  );
}

/* getPlanCopyKey and formatPlanPrice went with the pricing teaser. The pricing
   page has its own, and they are the ones that resolve currency per visitor. */

export function SiteLanding() {
  const { locale, dir, t } = useLandingLocale();
  const p = getProofCopy(locale);
  const roi = getRoiCopy(locale);

  return (
    <>
      <AmbientBackground />

      <SiteHeader locale={locale} t={t} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden" aria-labelledby="landing-hero-title">
          <div className="pointer-events-none absolute inset-0 -z-10 gc-hero-grid-warm" aria-hidden="true" />
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-center xl:gap-14 xl:pb-24 xl:pt-20">
            <div className="flex min-w-0 flex-col gap-5 xl:gap-6">
              <Badge
                variant="secondary"
                /* A full sentence, not a one-word badge: h-auto and
                   whitespace-normal let it wrap on narrow phones. Letter
                   spacing breaks Arabic joining, so tracking is Latin only. */
                className={`gc-fade-in-up h-auto w-fit whitespace-normal rounded-full px-3 py-1 text-start text-[11px] font-semibold ${
                  locale === 'ar' ? 'text-xs' : 'uppercase tracking-[0.16em]'
                }`}
              >
                {t.heroBadge}
              </Badge>
              <h1
                id="landing-hero-title"
                className="gc-fade-in-up max-w-[14ch] text-[clamp(2.1rem,6.4vw,4rem)] font-bold leading-[1.05] tracking-tight"
                style={{ animationDelay: '0.05s' }}
              >
                {t.heroTitle}
              </h1>
              <p
                className="gc-fade-in-up max-w-xl text-base leading-[1.7] text-muted-foreground sm:text-lg"
                style={{ animationDelay: '0.1s' }}
              >
                {p.heroSubtitle}
              </p>
              <div className="gc-fade-in-up flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '0.15s' }}>
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full px-6 text-sm font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                >
                  <a href="#see-it-working">
                    {p.heroPrimary}
                    <ArrowIcon />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-border px-6 text-sm font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                >
                  <a
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackClick('cta_clicked', { cta: 'book_call', section: 'hero' })}
                  >
                    {p.heroSecondary}
                  </a>
                </Button>
              </div>
              <ul className="gc-fade-in-up flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground" style={{ animationDelay: '0.2s' }}>
                {p.heroTrust.map((item, i) => (
                  <li key={item} className="flex items-center gap-1.5">
                    {i === 0 ? (
                      <ShopifyMark className="size-4" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-foreground/40" aria-hidden="true" />
                    )}
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <HeroSystem locale={locale} copy={p} />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20" aria-labelledby="how-title">
          <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-32 lg:pt-24">
            <div className="gc-scroll-reveal grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-end lg:gap-16">
              <div className="min-w-0 flex flex-col gap-3">
                <Eyebrow locale={locale}>{t.howEyebrow}</Eyebrow>
                <h2 id="how-title" className="text-[28px] font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[44px] lg:leading-[1.05]">
                  {t.howTitle}
                </h2>
              </div>
              <p className="min-w-0 max-w-2xl text-base leading-[1.7] text-muted-foreground sm:text-lg lg:justify-self-end">
                {t.howBody}
              </p>
            </div>

            <div className="mt-10 lg:mt-14">
              <ConnectedSystemMap columns={t.howMapColumns} rows={t.howMapRows} />
            </div>
          </div>
        </section>

        {/* Live demo */}
        <section id="demo" className="scroll-mt-20 bg-muted/35" aria-labelledby="demo-title">
          <div className="gc-scroll-reveal mx-auto grid w-full max-w-7xl min-w-0 items-center gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-16 lg:px-8 lg:py-20">
              <div className="min-w-0 flex flex-col items-start justify-center gap-5 lg:py-8">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.demoEyebrow}
                </Badge>
                <h2 id="demo-title" className="max-w-2xl text-[30px] font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-[48px]">
                  {t.demoTitle}
                </h2>
                <p className="max-w-xl text-base leading-[1.7] text-muted-foreground sm:text-lg">
                  {t.demoBody}
                </p>
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full px-6 font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                >
                  <Link
                    href={DEMO_URL}
                    onClick={() => trackClick('cta_clicked', { cta: 'try_on', section: 'demo' })}
                  >
                    {t.demoButton}
                    <ArrowIcon />
                  </Link>
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">{t.demoNote}</p>
              </div>
              <div className="relative min-w-0">
                <RenderReceiptFigure className="shadow-[var(--gc-landing-shadow)]" />
              </div>
          </div>
        </section>

        {/* Merchant benefits */}
        <section id="benefits" className="scroll-mt-20" aria-labelledby="benefits-title">
          <div className="gc-scroll-reveal mx-auto grid w-full max-w-7xl min-w-0 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)] lg:gap-20 lg:px-8 lg:py-32">
            <div className="min-w-0 lg:pt-4">
              <SectionHeading
                id="benefits-title"
                eyebrow={t.benefitsEyebrow}
                title={t.benefitsTitle}
                body={t.benefitsBody}
              />
            </div>

            <div className="min-w-0">
              <PlatformPillars items={t.platformPillars} />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.benefitsStatusNote}</p>
            </div>
          </div>
        </section>

        {/* Business case: surfaces the existing /roi scenario calculator, which
            was previously reachable only from the footer link. The card shows
            the calculator's inputs and its formula line, never numbers; the
            real, editable calculator lives on /roi. */}
        <section id="roi" className="scroll-mt-20 bg-muted/35" aria-labelledby="roi-title">
          <div className="gc-scroll-reveal mx-auto grid w-full max-w-7xl min-w-0 items-center gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-16 lg:px-8 lg:py-20">
              <div className="min-w-0 flex flex-col items-start justify-center gap-5 lg:py-8">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.roiTeaserEyebrow}
                </Badge>
                <h2 id="roi-title" className="max-w-2xl text-[30px] font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-[48px]">
                  {t.roiTeaserTitle}
                </h2>
                <p className="max-w-xl text-base leading-[1.7] text-muted-foreground sm:text-lg">
                  {t.roiTeaserBody}
                </p>
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full px-6 font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                >
                  <Link href="/roi">
                    {t.roiTeaserButton}
                    <ArrowIcon />
                  </Link>
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">{t.roiTeaserNote}</p>
              </div>
              <div className="relative min-w-0">
                <div className="gc-landing-card gc-card-hover rounded-3xl border p-6 sm:p-8">
                  <Eyebrow locale={locale}>{t.roiTeaserInputsLabel}</Eyebrow>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {t.roiTeaserInputs.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                  {/* The calculator's own formula line, read from roi-copy.ts so this
                      teaser can never describe different math than /roi runs. */}
                  <div className="mt-6 border-t border-border pt-5">
                    <Eyebrow locale={locale}>{roi.formulaTitle}</Eyebrow>
                    <p className="mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
                      {roi.thesis}
                    </p>
                  </div>
                </div>
              </div>
          </div>
        </section>

        {/* Pricing lives on /pricing only.

            This teaser rendered the raw catalog, which after EGP rows were
            added meant every plan twice — USD and EGP stacked on one page with
            no currency resolution. The pricing page resolves currency per
            visitor; the home page has no business quoting numbers it cannot
            adapt. Nav links straight to /pricing. */}

        {/* Product proof */}
        <section id="proof" aria-labelledby="proof-title">
          <div className="gc-scroll-reveal mx-auto grid w-full max-w-7xl min-w-0 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1.14fr)_minmax(0,0.86fr)] lg:gap-16 lg:px-8 lg:py-28">
            <div className="min-w-0 flex flex-col items-start gap-5 lg:ps-6">
              <Eyebrow locale={locale}>{t.proofEyebrow}</Eyebrow>
              <h2 id="proof-title" className="text-[28px] font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[44px] lg:leading-[1.05]">
                {t.proofTitle}
              </h2>
              <p className="text-base leading-[1.7] text-muted-foreground sm:text-lg">{t.proofBody}</p>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-5 font-semibold">
                <Link
                  href={DEMO_URL}
                  onClick={() => trackClick('cta_clicked', { cta: 'try_on', section: 'proof' })}
                >
                  {t.proofButton}
                  <ArrowIcon />
                </Link>
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">{t.proofDisclaimer}</p>
            </div>
            <div className="min-w-0 lg:order-first">
              <JourneyProofTabs dir={dir} label={t.proofJourneyLabel} stages={t.proofJourneyStages} />
            </div>
          </div>
        </section>

        {/* Testimonials remain disabled until the placeholder quotes are replaced. */}
        {ENABLE_TESTIMONIALS && t.testimonials.length > 0 && (
          <section id="clients" className="bg-muted/30" aria-labelledby="clients-title">
            <div className="gc-scroll-reveal mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
              <SectionHeading
                id="clients-title"
                eyebrow={t.testimonialsEyebrow}
                title={t.testimonialsTitle}
                body={t.testimonialsBody}
              />
              <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
                <figure className="gc-landing-card gc-card-hover flex flex-col justify-between rounded-3xl border p-8 sm:p-10">
                  <blockquote className="text-xl font-medium leading-[1.5] text-foreground sm:text-2xl">
                    {t.testimonials[0].quote}
                  </blockquote>
                  <figcaption className="mt-8 flex items-center gap-4 border-t border-border pt-6">
                    <TestimonialAvatar photo={t.testimonials[0].photo} name={t.testimonials[0].name} size={56} />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold text-foreground">{t.testimonials[0].name}</span>
                      <span className="block truncate text-sm text-muted-foreground">{t.testimonials[0].role}</span>
                    </span>
                  </figcaption>
                </figure>

                <div className="flex flex-col divide-y divide-border">
                  {t.testimonials.slice(1).map((item) => (
                    <div key={item.name} className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
                      <TestimonialAvatar photo={item.photo} name={item.name} size={40} className="mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[15px] leading-[1.6] text-foreground">{item.quote}</p>
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{item.name}</span> · {item.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* One evidence-led sequence replaces the repeated operations,
            automation-preview and integration sections. */}
        <section id="operations" className="bg-muted/30" aria-labelledby="platform-evidence-title">
          <div className="gc-scroll-reveal mx-auto w-full max-w-7xl min-w-0 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <SectionHeading
              id="platform-evidence-title"
              eyebrow={t.platformEvidenceEyebrow}
              title={t.platformEvidenceTitle}
              body={t.platformEvidenceBody}
            />
            <PlatformEvidenceSequence
              label={t.platformEvidenceLabel}
              items={t.platformEvidenceItems}
              integrationLabels={{
                implemented: t.integrationStateImplemented,
                'setup-required': t.integrationStateSetupRequired,
                'evidence-required': t.integrationStateEvidenceRequired,
                planned: t.integrationStatePlanned,
                infrastructure: t.integrationStateInfrastructure,
              }}
            />
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-primary text-primary-foreground" aria-labelledby="final-cta-title">
          <div className="gc-scroll-reveal mx-auto grid w-full max-w-7xl min-w-0 gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16 lg:px-8 lg:py-20">
              <div className="flex min-w-0 max-w-3xl flex-col gap-3">
                <h2 id="final-cta-title" className="text-[28px] font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[42px]">
                  {t.ctaTitle}
                </h2>
                <p className="text-base leading-[1.65] text-primary-foreground/70 sm:text-lg">{t.ctaBody}</p>
              </div>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="h-12 rounded-full px-7 text-sm font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
              >
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackClick('cta_clicked', { cta: 'book_call', section: 'final_cta' })}
                >
                  {t.ctaButton}
                  <ArrowIcon />
                </a>
              </Button>
          </div>
        </section>
      </main>

      <SiteFooter withConsentControl withLauncherSpacing />
    </>
  );
}
