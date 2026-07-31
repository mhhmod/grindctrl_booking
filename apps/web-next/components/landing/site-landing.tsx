'use client';

import React, { Fragment, useRef, useState } from 'react';
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
import { AmbientBackground } from '@/components/landing/ambient-background';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { Icon } from '@/components/icons';
import { Eyebrow } from '@/components/landing/eyebrow';
import { LandingLocaleToggle, useLandingLocale } from '@/components/landing/landing-locale';
import { StepMarker } from '@/components/landing/step-marker';
import { BOOKING_URL } from '@/lib/booking';
import type { LandingTranslator, SiteLocale } from '@/lib/landing/landing-i18n';
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

function BeforeAfterSlider({
  locale,
  t,
}: {
  locale: SiteLocale;
  t: LandingTranslator;
}) {
  const [reveal, setReveal] = useState(58);
  const activePointerRef = useRef<number | null>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const hiddenPercent = 100 - reveal;
  const resultClip = locale === 'ar'
    ? `inset(0 0 0 ${hiddenPercent}%)`
    : `inset(0 ${hiddenPercent}% 0 0)`;

  function clamp(value: number) {
    return Math.min(100, Math.max(0, value));
  }

  function updateFromClientX(clientX: number, element: HTMLDivElement) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width === 0) return;

    const physicalPercent = clamp(((clientX - bounds.left) / bounds.width) * 100);
    const logicalPercent = locale === 'ar' ? 100 - physicalPercent : physicalPercent;
    setReveal(Math.round(clamp(logicalPercent)));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    handleRef.current?.focus({ preventScroll: true });
    updateFromClientX(event.clientX, event.currentTarget);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    updateFromClientX(event.clientX, event.currentTarget);
  }

  function finishPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId) return;

    updateFromClientX(event.clientX, event.currentTarget);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerRef.current = null;
  }

  function cancelPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerRef.current = null;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 10 : 2;
    let next = reveal;

    switch (event.key) {
      case 'ArrowRight':
        next += locale === 'ar' ? -step : step;
        break;
      case 'ArrowLeft':
        next += locale === 'ar' ? step : -step;
        break;
      case 'ArrowUp':
        next += step;
        break;
      case 'ArrowDown':
        next -= step;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 100;
        break;
      default:
        return;
    }

    event.preventDefault();
    setReveal(clamp(next));
  }

  return (
    <figure className="gc-fade-in-up min-w-0 lg:self-center" style={{ animationDelay: '0.1s' }}>
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1">
          {t.heroPreviewLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">{t.heroPreviewType}</span>
      </div>

      <div
        className="gc-compare-frame relative isolate aspect-square min-w-0 touch-none select-none overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--gc-landing-shadow)]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={cancelPointer}
      >
        <Image
          src="/try-on/premium-ringer-tee.png"
          alt={t.heroProductAlt}
          fill
          priority
          draggable={false}
          sizes="(max-width: 1024px) calc(100vw - 2rem), 560px"
          className="pointer-events-none object-cover"
        />

        <div
          className="pointer-events-none absolute inset-0 will-change-[clip-path]"
          style={{ clipPath: resultClip }}
        >
          <Image
            src="/try-on/mock-result.png"
            alt={t.heroResultAlt}
            fill
            priority
            draggable={false}
            sizes="(max-width: 1024px) calc(100vw - 2rem), 560px"
            className="object-cover"
          />
        </div>

        <span className="pointer-events-none absolute start-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
          {t.heroAfterLabel}
        </span>
        <span className="pointer-events-none absolute end-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
          {t.heroBeforeLabel}
        </span>

        <span
          className="gc-compare-divider pointer-events-none absolute inset-block-0 z-10 w-px"
          style={{ insetInlineStart: `${reveal}%` }}
          aria-hidden="true"
        />
        <button
          ref={handleRef}
          type="button"
          role="slider"
          aria-label={t.heroSliderLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={reveal}
          aria-valuetext={t.heroSliderValue(reveal)}
          aria-orientation="horizontal"
          onKeyDown={handleKeyDown}
          className="gc-compare-handle absolute z-20 grid size-12 cursor-ew-resize place-items-center rounded-full border border-border bg-background text-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{
            insetInlineStart: `clamp(1.5rem, ${reveal}%, calc(100% - 1.5rem))`,
          }}
        >
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="h-4 w-px rounded-full bg-current/55" />
            <span className="h-4 w-px rounded-full bg-current/55" />
          </span>
        </button>
      </div>

      <figcaption className="mt-3 flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{t.heroSliderHint}</span>
        <span>{t.heroPreviewNote}</span>
      </figcaption>
    </figure>
  );
}

export function SiteLanding({ plans }: { plans: PublicPlanCatalogItem[] }) {
  const { locale, t } = useLandingLocale();
  const sortedPlans = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <AmbientBackground />

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
            </div>

            <div className="order-2 min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
              <BeforeAfterSlider locale={locale} t={t} />
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
                <Image
                  src="/try-on/mock-result.png"
                  alt={t.demoImageAlt}
                  width={1024}
                  height={1024}
                  sizes="(max-width: 1024px) 100vw, 430px"
                  className="h-auto max-w-full rounded-3xl border border-border shadow-[var(--gc-landing-shadow)]"
                />
                <Badge className="absolute end-3 top-3 rounded-full sm:end-5 sm:top-5">
                  {t.demoPreviewLabel}
                </Badge>
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

        {/* Pricing teaser */}
        <section id="pricing" className="scroll-mt-20 bg-muted/30" aria-labelledby="pricing-title">
          <div className="gc-scroll-reveal mx-auto grid w-full max-w-7xl min-w-0 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1.38fr)] lg:gap-16 lg:px-8 lg:py-24">
            <div className="min-w-0">
              <SectionHeading id="pricing-title" eyebrow={t.pricingEyebrow} title={t.pricingTitle} body={t.pricingBody} />
            </div>

            <div className="min-w-0">
              {/* The pricing page owns the full comparison. This teaser uses the public plan catalog. */}
              <div className="overflow-hidden border-y border-border">
                {sortedPlans.map((plan, i) => {
                  const copyKey = getPlanCopyKey(plan.planKey);
                  const name = t.pricingPlanNames[copyKey] ?? plan.name;
                  const line = copyKey === 'dfy-v1'
                    ? t.pricingManagedLine(plan.rendersIncluded)
                    : t.pricingRenderLine(plan.rendersIncluded);

                  return (
                    <Fragment key={plan.planKey}>
                      {i > 0 ? <Separator /> : null}
                      <div className="grid min-w-0 gap-2 py-5 sm:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1.35fr)] sm:items-center sm:gap-6 sm:py-6">
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
              <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-relaxed text-muted-foreground">{t.pricingNote}</p>
                <Button asChild variant="outline" className="rounded-full px-5 font-semibold">
                  <Link href="/pricing">
                    {t.pricingLink}
                    <ArrowIcon />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

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
            <figure className="gc-landing-card gc-card-hover min-w-0 overflow-hidden rounded-3xl border lg:order-first">
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
            <div className="flex min-w-0 flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex max-w-2xl flex-col gap-3">
                <Eyebrow locale={locale}>{t.integrationsEyebrow}</Eyebrow>
                <h2 id="integrations-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t.integrationsTitle}
                </h2>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2.5">
                {t.integrations.map((name) => {
                  /* Shopify and Gemini are real products, so they carry their
                     own mark. The rest are surfaces, not brands, and stay
                     text-only. Matching on the untranslated brand name works
                     because both stay Latin script in the Arabic copy too. */
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

              {/* A list, not another card triplet: these are capabilities of
                  one service, so they read better stacked than boxed. */}
              <ul className="min-w-0 flex flex-col gap-3 lg:pt-9">
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
        </div>
      </footer>
    </>
  );
}
