'use client';

import React, { Fragment, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import { Shirt, ImageUp, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BrandLogo } from '@/components/brand-logo';
import { BRAND_MARKS } from '@/components/brand-marks';
import { AiOperationsChain } from '@/components/landing/ai-operations-chain';
import { AiVisionFigure } from '@/components/landing/ai-vision-figure';
import { AmbientBackground } from '@/components/landing/ambient-background';
import { AutomationsShowcase } from '@/components/landing/automations-showcase';
import { MessagingChannels } from '@/components/landing/messaging-channels';
import { RenderReceiptFigure } from '@/components/landing/render-receipt-figure';
import { CollaborationsMarquee } from '@/components/landing/collaborations-marquee';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { Icon } from '@/components/icons';
import { Eyebrow } from '@/components/landing/eyebrow';
import { LandingLocaleToggle, useLandingLocale } from '@/components/landing/landing-locale';
import { SiteHeader } from '@/components/landing/site-header';
import { StepMarker } from '@/components/landing/step-marker';
import { TryOnRevealFigure } from '@/components/landing/try-on-reveal-figure';
import { BOOKING_URL } from '@/lib/booking';
import type { PublicPlanCatalogItem } from '@/lib/try-on/public-catalog';

const DEMO_URL = '/try-on';

/* Literal depictions of each step: an actual garment, an actual photo upload,
   an actual cart — the copy says "add it to cart" / "السلة" in both locales, so
   the icon names the same object the sentence does. Same family so stroke
   weight stays consistent; mixing weights is how this treatment falls apart. */
const stepIcons = [Shirt, ImageUp, ShoppingCart];

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
  const { locale, t } = useLandingLocale();

  return (
    <>
      <AmbientBackground />

      <SiteHeader locale={locale} t={t} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden" aria-labelledby="landing-hero-title">
          <div className="pointer-events-none absolute inset-0 -z-10 gc-hero-grid-warm" aria-hidden="true" />
          <div
            className="gc-ambient-glow pointer-events-none absolute -end-32 top-16 -z-10 size-80 rounded-full bg-primary/6 blur-3xl"
            aria-hidden="true"
          />
          <div className="mx-auto grid w-full max-w-7xl gap-7 px-4 py-10 sm:px-6 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-x-16 lg:gap-y-6 lg:px-8 lg:py-28">
            {/* Mobile order: headline, then the proof, then the pitch. The
                visual has to land above the fold on a phone. */}
            <div className="order-1 flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:justify-end lg:gap-6">
              <Badge
                variant="secondary"
                /* This is a full sentence, not a one-word badge. Badge is
                   h-5 whitespace-nowrap by default, so it ran ~54px past a
                   320px viewport; h-auto + whitespace-normal lets it wrap.
                   Typography follows the same locale rule as Eyebrow —
                   letter-spacing breaks Arabic letter-joining. */
                className={`gc-fade-in-up h-auto whitespace-normal rounded-full px-3 py-1 text-start text-[11px] font-semibold ${
                  locale === 'ar' ? 'text-xs' : 'uppercase tracking-[0.16em]'
                }`}
              >
                {t.heroBadge}
              </Badge>
              <h1
                id="landing-hero-title"
                className="gc-fade-in-up text-[clamp(2.1rem,7vw,4.25rem)] font-bold leading-[1.06] tracking-tight"
                style={{ animationDelay: '0.05s' }}
              >
                {t.heroTitle}
              </h1>
            </div>

            <div className="order-2 min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
              <TryOnRevealFigure caption={t.heroRevealCaption} alt={t.heroRevealAlt} />
            </div>

            <div className="order-3 flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2 lg:gap-6">
              <p
                className="gc-fade-in-up max-w-xl text-base leading-[1.7] text-muted-foreground sm:text-lg"
                style={{ animationDelay: '0.12s' }}
              >
                {t.heroSubtitle}
              </p>
              <div
                className="gc-fade-in-up flex flex-col gap-3 sm:flex-row"
                style={{ animationDelay: '0.18s' }}
              >
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full px-6 text-sm font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                >
                  <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                    {t.heroPrimary}
                    <ArrowIcon />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-border px-6 text-sm font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                >
                  <Link href={DEMO_URL}>{t.heroSecondary}</Link>
                </Button>
              </div>
              <div
                className="gc-fade-in-up flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-muted-foreground"
                style={{ animationDelay: '0.24s' }}
              >
                {t.heroChips.map((chip) => (
                  <span key={chip} className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-foreground/40" aria-hidden="true" />
                    {chip}
                  </span>
                ))}
              </div>
            </div>
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

            <ol className="gc-how-sequence relative mt-14 grid min-w-0 gap-10 md:grid-cols-3 md:gap-8 lg:mt-20 lg:gap-12">
              {t.howSteps.map((step, i) => (
                <li
                  key={step.title}
                  className="gc-how-step relative z-10 min-w-0 ps-16 md:ps-0 md:pt-16"
                >
                  <div className="absolute start-0 top-0">
                    <StepMarker index={i} icon={stepIcons[i] ?? Shirt} />
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
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
                  <Link href={DEMO_URL}>
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
              <div className="grid min-w-0 border-y border-border sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-3 py-7 sm:pe-8">
                  <Eyebrow locale={locale}>{t.returnBenefitLabel}</Eyebrow>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.returnBenefitTitle}</h3>
                  <p className="text-[15px] leading-[1.7] text-muted-foreground">{t.returnBenefitBody}</p>
                </div>
                <div className="flex min-w-0 flex-col gap-3 border-t border-border py-7 sm:border-s sm:border-t-0 sm:ps-8">
                  <Eyebrow locale={locale}>{t.confidenceBenefitLabel}</Eyebrow>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.confidenceBenefitTitle}</h3>
                  <p className="text-[15px] leading-[1.7] text-muted-foreground">{t.confidenceBenefitBody}</p>
                </div>
              </div>

              <div className="mt-8 min-w-0">
                {t.merchantFeatures.map((feature, i) => (
                  <Fragment key={feature.title}>
                    {i > 0 ? <Separator /> : null}
                    <div className="grid min-w-0 gap-3 py-5 first:pt-0 last:pb-0 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-5">
                      <span className="grid size-10 place-items-center rounded-full border border-border bg-muted/40 text-foreground">
                        <Icon icon={CheckmarkCircle02Icon} size={19} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold">{feature.title}</h3>
                        <p className="mt-1 text-[15px] leading-[1.65] text-muted-foreground">
                          {feature.body}
                        </p>
                      </div>
                    </div>
                  </Fragment>
                ))}
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
              <Button asChild variant="outline" className="rounded-full px-5 font-semibold">
                <Link href={DEMO_URL}>
                  {t.proofButton}
                  <ArrowIcon />
                </Link>
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">{t.proofDisclaimer}</p>
            </div>
            <div className="min-w-0 lg:order-first">
              <AiVisionFigure
                alt={t.proofImageAlt}
                caption={t.proofCaption}
                className="gc-card-hover"
              />
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

        {/* Integrations */}
        <section aria-labelledby="integrations-title">
          <div className="gc-scroll-reveal mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
            <div className="min-w-0 flex max-w-2xl flex-col gap-3">
              <Eyebrow locale={locale}>{t.integrationsEyebrow}</Eyebrow>
              <h2 id="integrations-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t.integrationsTitle}
              </h2>
            </div>

            {/* Full width rather than sharing a row with the heading: twelve
                partners wrapped into a flex pile on a phone and read as a wall
                of pills. Moving rows show the same names in less height. */}
            <div className="mt-8">
              <CollaborationsMarquee />
            </div>
          </div>
        </section>

        {/* Other services */}
        <section className="bg-muted/30" aria-labelledby="other-services-title">
          <div className="gc-scroll-reveal mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-9 px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
              <div className="min-w-0 flex flex-col gap-3">
                <Eyebrow locale={locale}>{t.otherEyebrow}</Eyebrow>
                <h2
                  id="other-services-title"
                  className="text-[26px] font-bold leading-[1.14] tracking-tight sm:text-3xl lg:text-[38px] lg:leading-[1.08]"
                >
                  {t.otherTitle}
                </h2>
                <p className="text-base leading-[1.65] text-muted-foreground">{t.otherBody}</p>
              </div>

              <div className="min-w-0 flex flex-col gap-8">
                {/* The two claims above made concrete: the operations path
                    stays visible end to end, and the same voice answers on
                    every channel. Side by side on wide screens, stacked on
                    phones, same 4:3 card either way. */}
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <AiOperationsChain className="mx-auto sm:mx-0" />
                  <MessagingChannels className="mx-auto sm:mx-0" />
                </div>

                {/* A list, not another card triplet: these are capabilities
                    of one service, so they read better stacked than boxed. */}
                <ul className="min-w-0 flex flex-col gap-3">
                  {t.otherItems.map((item) => (
                    <li key={item} className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
                        <Icon icon={CheckmarkCircle02Icon} />
                      </span>
                      <span className="min-w-0 text-[15px] leading-[1.55]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="min-w-0">
              <Eyebrow locale={locale}>{t.automationsEyebrow}</Eyebrow>
              <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t.automationsTitle}</h3>
              <p className="mt-2 max-w-2xl text-[15px] leading-[1.65] text-muted-foreground">
                {t.automationsBody}
              </p>
              <div className="mt-7">
                <AutomationsShowcase
                  qualifiers={t.automationsQualifiers}
                  statLabels={{
                    automationsStatMessages: t.automationsStatMessages,
                    automationsStatLeads: t.automationsStatLeads,
                    automationsStatAutomations: t.automationsStatAutomations,
                    automationsStatResponse: t.automationsStatResponse,
                  }}
                  cards={t.automationsCards}
                />
              </div>
            </div>

            {/* The tools this actually runs on. Same chip treatment as the
                try-on integrations strip so the page reads as one system. */}
            <div className="flex min-w-0 flex-wrap gap-2.5 border-t border-border pt-7">
              {t.opsStack.map((name) => {
                const Mark = BRAND_MARKS[name];
                return (
                  <Badge
                    key={name}
                    variant="outline"
                    className="gc-integration-chip inline-flex items-center gap-1.5 rounded-full border-border bg-background px-3.5 text-[13px] font-medium"
                  >
                    {Mark ? <Mark className="shrink-0" /> : null}
                    {name}
                  </Badge>
                );
              })}
            </div>
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
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  {t.ctaButton}
                  <ArrowIcon />
                </a>
              </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-4 py-10 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size="sm" textClassName="text-xs" />
          <p className="text-xs">{t.footerTagline}</p>
          <div className="flex items-center gap-5 text-xs">
            <Link href="/" className="gc-tap transition-colors hover:text-foreground">{t.footerHome}</Link>
            <Link href={DEMO_URL} className="gc-tap transition-colors hover:text-foreground">{t.footerDemo}</Link>
            <Link href="/pricing" className="gc-tap transition-colors hover:text-foreground">{t.footerPricing}</Link>
          </div>
          {/* Language and theme left the top bar; the footer is their second route. */}
          <div className="flex items-center gap-2">
            <LandingLocaleToggle />
            <ThemeToggle locale={locale} />
          </div>
        </div>
      </footer>
    </>
  );
}
