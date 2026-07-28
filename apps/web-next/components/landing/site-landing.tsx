'use client';

import React, { Fragment, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight02Icon,
  Camera01Icon,
  CheckmarkCircle02Icon,
  ClothesIcon,
  ImageUploadIcon,
  ShoppingBagCheckIcon,
} from '@hugeicons/core-free-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { Icon } from '@/components/icons';
import { LandingLocaleToggle, useLandingLocale } from '@/components/landing/landing-locale';
import { BOOKING_URL } from '@/lib/booking';
import type { PublicPlanCatalogItem } from '@/lib/try-on/public-catalog';
import { cn } from '@/lib/utils';

const DEMO_URL = '/try-on';

const stepIcons = [ClothesIcon, ImageUploadIcon, ShoppingBagCheckIcon];

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
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mb-10 flex max-w-3xl flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="text-[28px] font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[44px] lg:leading-[1.05]">
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

function getPlanCopyKey(planKey: string): string {
  if (planKey.startsWith('free-')) return 'free-v1';
  if (planKey.startsWith('launch-')) return 'launch-v1';
  if (planKey.startsWith('dfy-')) return 'dfy-v1';
  return planKey;
}

function formatPlanPrice(
  priceMinor: number,
  currency: string,
  locale: 'en' | 'ar',
): string {
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(priceMinor / 100);
  } catch {
    return `${currency} ${Math.round(priceMinor / 100)}`;
  }
}

export function SiteLanding({ plans }: { plans: PublicPlanCatalogItem[] }) {
  const { locale, t } = useLandingLocale();
  const sortedPlans = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label={t.brandHome} className="min-w-0 rounded-lg">
            <BrandLogo textClassName="hidden sm:block" />
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
            <a href="#how" className="transition-colors hover:text-foreground">{t.navHow}</a>
            <a href="#demo" className="transition-colors hover:text-foreground">{t.navDemo}</a>
            <a href="#benefits" className="transition-colors hover:text-foreground">{t.navBenefits}</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">{t.navPricing}</a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LandingLocaleToggle />
            <ThemeToggle />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden rounded-full px-3 text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Link href="/sign-in">{t.signIn}</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden rounded-full px-4 font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0 lg:inline-flex"
            >
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">{t.bookCall}</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border" aria-labelledby="landing-hero-title">
          <div className="pointer-events-none absolute inset-0 -z-10 gc-hero-grid-warm" aria-hidden="true" />
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-8 lg:py-24">
            <div className="min-w-0 flex flex-col gap-7">
              <Badge
                variant="secondary"
                className="gc-fade-in-up h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.18em]"
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

            <figure
              className="gc-fade-in-up min-w-0 lg:self-center"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1">
                  {t.heroPreviewLabel}
                </Badge>
                <span className="text-xs text-muted-foreground">{t.heroPreviewType}</span>
              </div>

              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                    {t.heroBeforeLabel}
                  </div>
                  <Image
                    src="/try-on/premium-ringer-tee.png"
                    alt={t.heroProductAlt}
                    width={1024}
                    height={1024}
                    sizes="(max-width: 1024px) 42vw, 250px"
                    className="h-auto max-w-full"
                  />
                  <div className="flex min-w-0 items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    <Icon icon={Camera01Icon} size={14} className="shrink-0" />
                    <span className="min-w-0">{t.heroPhotoInput}</span>
                  </div>
                </div>

                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground shadow-sm sm:size-10"
                  aria-hidden="true"
                >
                  <Icon icon={ArrowRight02Icon} size={18} className="rtl:-scale-x-100" />
                </span>

                <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--gc-landing-shadow)]">
                  <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                    {t.heroAfterLabel}
                  </div>
                  <Image
                    src="/try-on/mock-result.png"
                    alt={t.heroResultAlt}
                    width={1024}
                    height={1024}
                    priority
                    sizes="(max-width: 1024px) 42vw, 250px"
                    className="h-auto max-w-full"
                  />
                  <div className="border-t border-border px-3 py-2 text-xs font-medium text-foreground">
                    {t.heroResultLabel}
                  </div>
                </div>
              </div>

              <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {t.heroPreviewNote}
              </figcaption>
            </figure>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-b border-border" aria-labelledby="how-title">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div id="how-title">
              <SectionHeading eyebrow={t.howEyebrow} title={t.howTitle} body={t.howBody} />
            </div>
            <div className="gc-landing-panel grid overflow-hidden rounded-2xl border md:grid-cols-3">
              {t.howSteps.map((step, i) => (
                <div
                  key={step.title}
                  className={cn(
                    'min-w-0 p-6 sm:p-8',
                    i > 0 && 'border-t border-border md:border-s md:border-t-0',
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="grid size-11 place-items-center rounded-xl border border-border bg-background">
                      <Icon icon={stepIcons[i] ?? ClothesIcon} size={20} />
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live demo */}
        <section id="demo" className="scroll-mt-20 border-b border-border bg-muted/20" aria-labelledby="demo-title">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="gc-landing-card gc-card-hover grid min-w-0 overflow-hidden rounded-3xl border lg:grid-cols-[1fr_0.72fr]">
              <div className="min-w-0 flex flex-col items-start justify-center gap-5 p-7 sm:p-10 lg:p-14">
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
              <div className="relative min-w-0 border-t border-border bg-muted/30 p-4 sm:p-6 lg:border-s lg:border-t-0">
                <Image
                  src="/try-on/mock-result.png"
                  alt={t.demoImageAlt}
                  width={1024}
                  height={1024}
                  sizes="(max-width: 1024px) 100vw, 430px"
                  className="h-auto max-w-full rounded-2xl border border-border"
                />
                <Badge className="absolute end-7 top-7 rounded-full sm:end-9 sm:top-9">
                  {t.demoPreviewLabel}
                </Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Merchant benefits */}
        <section id="benefits" className="scroll-mt-20 border-b border-border" aria-labelledby="benefits-title">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div id="benefits-title">
              <SectionHeading
                eyebrow={t.benefitsEyebrow}
                title={t.benefitsTitle}
                body={t.benefitsBody}
              />
            </div>
            <div className="grid min-w-0 gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14">
              <div className="gc-landing-card min-w-0 rounded-3xl border p-7 sm:p-10">
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t.returnBenefitLabel}
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.returnBenefitTitle}</h3>
                  <p className="text-[15px] leading-[1.7] text-muted-foreground">{t.returnBenefitBody}</p>
                </div>
                <Separator className="my-8" />
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t.confidenceBenefitLabel}
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.confidenceBenefitTitle}</h3>
                  <p className="text-[15px] leading-[1.7] text-muted-foreground">{t.confidenceBenefitBody}</p>
                </div>
              </div>

              <div className="min-w-0">
                {t.merchantFeatures.map((feature, i) => (
                  <Fragment key={feature.title}>
                    {i > 0 ? <Separator /> : null}
                    <div className="grid min-w-0 gap-3 py-6 first:pt-0 last:pb-0 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-5">
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

        {/* Pricing teaser */}
        <section id="pricing" className="scroll-mt-20 border-b border-border bg-muted/20" aria-labelledby="pricing-title">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div id="pricing-title">
              <SectionHeading eyebrow={t.pricingEyebrow} title={t.pricingTitle} body={t.pricingBody} />
            </div>
            {/* The pricing page owns the full comparison. This teaser uses the public plan catalog. */}
            <div className="gc-landing-card overflow-hidden rounded-2xl border">
              {sortedPlans.map((plan, i) => {
                const copyKey = getPlanCopyKey(plan.planKey);
                const name = t.pricingPlanNames[copyKey] ?? plan.name;
                const line = copyKey === 'dfy-v1'
                  ? t.pricingManagedLine(plan.rendersIncluded)
                  : t.pricingRenderLine(plan.rendersIncluded);

                return (
                  <Fragment key={plan.planKey}>
                    {i > 0 ? <Separator /> : null}
                    <div className="grid min-w-0 gap-2 p-5 sm:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1.35fr)] sm:items-center sm:gap-6 sm:p-6">
                      <h3 className="min-w-0 text-lg font-semibold">{name}</h3>
                      <p className="text-xl font-bold tabular-nums sm:text-end">
                        {formatPlanPrice(plan.priceMinor, plan.currency, locale)}
                      </p>
                      <p className="min-w-0 text-sm leading-relaxed text-muted-foreground">{line}</p>
                    </div>
                  </Fragment>
                );
              })}
            </div>
            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-relaxed text-muted-foreground">{t.pricingNote}</p>
              <Button asChild variant="outline" className="rounded-full px-5 font-semibold">
                <Link href="/pricing">
                  {t.pricingLink}
                  <ArrowIcon />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Product proof */}
        <section id="proof" className="border-b border-border" aria-labelledby="proof-title">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14 lg:px-8 lg:py-24">
            <div className="min-w-0 flex flex-col items-start gap-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t.proofEyebrow}
              </p>
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
            <figure className="gc-landing-card min-w-0 overflow-hidden rounded-2xl border">
              <Image
                src="/try-on/mock-result.png"
                alt={t.proofImageAlt}
                width={1024}
                height={1024}
                sizes="(max-width: 1024px) 100vw, 640px"
                className="h-auto max-w-full"
              />
              <figcaption className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                {t.proofCaption}
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Testimonials remain disabled until the placeholder quotes are replaced. */}
        {ENABLE_TESTIMONIALS && t.testimonials.length > 0 && (
          <section id="clients" className="border-b border-border bg-muted/20">
            <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
              <SectionHeading
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
        <section className="border-b border-border" aria-labelledby="integrations-title">
          <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex min-w-0 flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex max-w-2xl flex-col gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {t.integrationsEyebrow}
                </p>
                <h2 id="integrations-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t.integrationsTitle}
                </h2>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2.5">
                {t.integrations.map((name) => (
                  <Badge key={name} variant="outline" className="rounded-full border-border bg-background px-3.5 py-1.5 text-[13px] font-medium">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Other services */}
        <section className="border-b border-border bg-muted/20" aria-labelledby="other-services-title">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="min-w-0 flex max-w-2xl flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t.otherEyebrow}
              </p>
              <h2 id="other-services-title" className="text-2xl font-bold tracking-tight">{t.otherTitle}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{t.otherBody}</p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {t.otherItems.map((item) => (
                <Badge key={item} variant="secondary" className="rounded-full px-3.5 py-1.5 text-[13px]">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-b border-border" aria-labelledby="final-cta-title">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="gc-landing-card flex flex-col items-center gap-6 rounded-3xl border p-8 text-center sm:p-14">
              <div className="flex max-w-2xl flex-col gap-3">
                <h2 id="final-cta-title" className="text-[28px] font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[42px]">
                  {t.ctaTitle}
                </h2>
                <p className="text-base leading-[1.65] text-muted-foreground sm:text-lg">{t.ctaBody}</p>
              </div>
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full px-7 text-sm font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
              >
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  {t.ctaButton}
                  <ArrowIcon />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-4 py-10 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size="sm" textClassName="text-xs" />
          <p className="text-xs">{t.footerTagline}</p>
          <div className="flex items-center gap-5 text-xs">
            <Link href="/" className="transition-colors hover:text-foreground">{t.footerHome}</Link>
            <Link href={DEMO_URL} className="transition-colors hover:text-foreground">{t.footerDemo}</Link>
            <Link href="/pricing" className="transition-colors hover:text-foreground">{t.footerPricing}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
